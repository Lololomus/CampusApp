import os
import base64
import uuid
import json
from typing import List, Optional, Dict, Union
from PIL import Image
from io import BytesIO
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

# Конфигурация
UPLOAD_DIR = "uploads/images"
BASE_URL = "http://127.0.0.1:8000"

# Параметры обработки изображений
MAX_IMAGE_SIZE = 1200
MIN_IMAGE_SIZE = 100
IMAGE_QUALITY = 85
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Ограничение для защиты от Decompression Bomb
Image.MAX_IMAGE_PIXELS = 90_000_000

ALLOWED_FORMATS = {'jpg', 'jpeg', 'png', 'webp'}

# Сигнатуры файлов
MAGIC_BYTES = {
    b'\xff\xd8\xff': 'jpg',
    b'\x89\x50\x4e\x47': 'png',
    b'\x47\x49\x46\x38': 'gif',
    b'\x52\x49\x46\x46': 'webp',
}

os.makedirs(UPLOAD_DIR, exist_ok=True)


def verify_magic_bytes(image_bytes: bytes) -> Optional[str]:
    """Определяет реальный формат файла по заголовку."""
    for magic, fmt in MAGIC_BYTES.items():
        if image_bytes.startswith(magic):
            return fmt
    return None


def remove_exif(image: Image.Image) -> Image.Image:
    """Удаляет метаданные EXIF, пересоздавая изображение."""
    if not hasattr(image, '_getexif'):
        return image
        
    data = list(image.getdata())
    image_without_exif = Image.new(image.mode, image.size)
    image_without_exif.putdata(data)
    return image_without_exif


def resize_image(image: Image.Image, max_size: int = MAX_IMAGE_SIZE) -> Image.Image:
    """Изменяет размер изображения с сохранением пропорций."""
    width, height = image.size
    
    if width <= max_size and height <= max_size:
        return image
    
    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return image


def process_image_sync(image_data: bytes) -> Dict[str, Union[str, int]]:
    """
    Синхронная обработка изображения: валидация, очистка, ресайз, сохранение.
    Выполняется в отдельном потоке.
    """
    # Проверка формата
    detected_format = verify_magic_bytes(image_data)
    if not detected_format:
        raise ValueError("Недопустимый формат файла")

    try:
        img = Image.open(BytesIO(image_data))
        width, height = img.size
        
        # Проверка размеров
        if width < MIN_IMAGE_SIZE or height < MIN_IMAGE_SIZE:
            raise ValueError(f"Изображение слишком маленькое (мин. {MIN_IMAGE_SIZE}px)")
            
        aspect_ratio = width / height
        if aspect_ratio > 3.0 or aspect_ratio < 0.33:
            raise ValueError("Нестандартные пропорции изображения")

        # Обработка
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        img = remove_exif(img)
        img = resize_image(img)
        
        # Финальные размеры
        final_width, final_height = img.size

        # Сохранение
        ext = 'jpg'
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        with open(filepath, 'wb') as f:
            img.save(f, format='JPEG', quality=IMAGE_QUALITY, optimize=True)

        return {
            "url": filename,
            "w": final_width,
            "h": final_height
        }

    except Exception as e:
        raise ValueError(f"Ошибка обработки: {str(e)}")


async def process_uploaded_files(files: List[UploadFile]) -> List[Dict[str, Union[str, int]]]:
    """
    Основная функция загрузки файлов.
    Читает асинхронно, обрабатывает в пуле потоков.
    """
    processed_images = []

    for file in files:
        try:
            content = await file.read()
            
            if len(content) > MAX_FILE_SIZE:
                raise ValueError(f"Файл {file.filename} превышает лимит {MAX_FILE_SIZE // (1024*1024)}MB")

            image_meta = await run_in_threadpool(process_image_sync, content)
            processed_images.append(image_meta)

        except Exception as e:
            delete_images(processed_images)
            raise ValueError(f"Ошибка с файлом {file.filename}: {str(e)}")

    return processed_images


def process_base64_images(base64_images: List[str]) -> List[Dict[str, Union[str, int]]]:
    """Обработка Base64 строк (для обратной совместимости)."""
    processed_images = []
    
    for b64 in base64_images:
        try:
            if ',' in b64:
                b64 = b64.split(',', 1)[1]
            
            content = base64.b64decode(b64)
            # Выполняем синхронно, так как обычно вызывается не в async контексте
            image_meta = process_image_sync(content)
            processed_images.append(image_meta)
            
        except Exception as e:
            delete_images(processed_images)
            raise ValueError(f"Ошибка обработки Base64: {str(e)}")
            
    return processed_images


def delete_images(images_data: List[Union[str, Dict]]):
    """
    Удаляет изображения с диска.
    Поддерживает старый формат (список строк) и новый (список словарей).
    """
    for item in images_data:
        filename = item.get('url') if isinstance(item, dict) else item
            
        if not filename:
            continue

        filepath = os.path.join(UPLOAD_DIR, filename)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"Ошибка удаления файла {filename}: {e}")


def get_image_urls(images_json: str) -> List[Dict[str, Union[str, int]]]:
    """
    Парсит JSON поле images и возвращает список объектов с полными URL.
    Обеспечивает совместимость со старым форматом данных.
    """
    if not images_json:
        return []

    try:
        raw_data = json.loads(images_json)
        result = []
        
        for item in raw_data:
            if isinstance(item, str):
                # Старый формат: возвращаем заглушки размеров
                result.append({
                    "url": f"{BASE_URL}/uploads/images/{item}",
                    "w": 1000,
                    "h": 1000
                })
            elif isinstance(item, dict):
                # Новый формат
                result.append({
                    "url": f"{BASE_URL}/uploads/images/{item['url']}",
                    "w": item.get('w', 1000),
                    "h": item.get('h', 1000)
                })
                
        return result
    except Exception as e:
        print(f"Ошибка парсинга JSON изображений: {e}")
        return []