# ===== 📄 ФАЙЛ: utils.py =====

import os
import base64
import uuid
from typing import List, Optional
from PIL import Image
from io import BytesIO


# Настройки
UPLOAD_DIR = "uploads/images"
BASE_URL = "http://127.0.0.1:8000"  # Измени на свой URL в продакшене

# Константы обработки
MAX_IMAGE_SIZE = 1200  # Максимальная ширина/высота в px
IMAGE_QUALITY = 85  # Качество сжатия (1-100)
ALLOWED_FORMATS = {'jpg', 'jpeg', 'png', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB в байтах

# Magic bytes для проверки реальных форматов
MAGIC_BYTES = {
    b'\xff\xd8\xff': 'jpg',  # JPEG
    b'\x89\x50\x4e\x47': 'png',  # PNG
    b'\x47\x49\x46\x38': 'gif',  # GIF
    b'\x52\x49\x46\x46': 'webp',  # WebP (начинается с RIFF)
}


# Создаем папку при импорте модуля
os.makedirs(UPLOAD_DIR, exist_ok=True)



def verify_magic_bytes(image_bytes: bytes) -> Optional[str]:
    """
    Проверка magic bytes (сигнатуры файла).
    Защита от переименованных файлов (fake.txt → fake.jpg).
    """
    for magic, fmt in MAGIC_BYTES.items():
        if image_bytes.startswith(magic):
            return fmt
    return None



def validate_image(image_bytes: bytes) -> bool:
    """Проверка что файл - это изображение (через Pillow)"""
    try:
        img = Image.open(BytesIO(image_bytes))
        img.verify()  # Проверяет что файл не повреждён
        return True
    except Exception:
        return False



def remove_exif(image: Image.Image) -> Image.Image:
    """
    Удаление EXIF метаданных (геолокация, модель телефона, дата съёмки).
    КРИТИЧНО для confessions (анонимность).
    """
    # Создаём новое изображение БЕЗ EXIF
    data = list(image.getdata())
    image_without_exif = Image.new(image.mode, image.size)
    image_without_exif.putdata(data)
    return image_without_exif



def resize_image(image: Image.Image, max_size: int = MAX_IMAGE_SIZE) -> Image.Image:
    """
    Resize изображения с сохранением пропорций.
    Если обе стороны <= max_size → не меняем.
    """
    width, height = image.size
    
    # Если изображение уже меньше лимита - пропускаем
    if width <= max_size and height <= max_size:
        return image
    
    # Вычисляем новые размеры (сохраняя пропорции)
    if width > height:
        new_width = max_size
        new_height = int((max_size / width) * height)
    else:
        new_height = max_size
        new_width = int((max_size / height) * width)
    
    return image.resize((new_width, new_height), Image.Resampling.LANCZOS)



def process_base64_images(base64_images: List[str]) -> List[str]:
    """
    Принимает список Base64 строк, валидирует и сохраняет изображения.
    
    ✅ НОВОЕ:
    - Resize до 1200px
    - EXIF удаление
    - Оптимизация качества (85%)
    - Magic bytes проверка
    
    Возвращает список имён файлов.
    """
    saved_filenames = []
    
    for base64_str in base64_images:
        try:
            # Убираем префикс data:image/...;base64,
            if ',' in base64_str:
                base64_str = base64_str.split(',', 1)[1]
            
            # Декодируем Base64
            image_data = base64.b64decode(base64_str)
            
            # 🔒 ПРОВЕРКА 1: Размер файла
            if len(image_data) > MAX_FILE_SIZE:
                raise ValueError(f"Файл слишком большой: {len(image_data) / (1024*1024):.1f}MB (макс 5MB)")
            
            # 🔒 ПРОВЕРКА 2: Magic bytes (реальный формат)
            detected_format = verify_magic_bytes(image_data)
            if not detected_format:
                raise ValueError("Недопустимый формат файла (не изображение)")
            
            # 🔒 ПРОВЕРКА 3: Pillow validation
            if not validate_image(image_data):
                raise ValueError("Повреждённое изображение")
            
            # Открываем изображение
            img = Image.open(BytesIO(image_data))
            
            # Конвертируем RGBA → RGB (для JPEG/WebP без прозрачности)
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # ✅ ШАГ 1: Удаляем EXIF (приватность)
            img = remove_exif(img)
            
            # ✅ ШАГ 2: Resize до 1200px
            img = resize_image(img, MAX_IMAGE_SIZE)
            
            # Определяем формат для сохранения
            original_format = img.format or detected_format.upper()
            save_format = 'JPEG' if original_format.upper() in ('JPG', 'JPEG') else original_format.upper()
            
            # Расширение файла
            ext = 'jpg' if save_format == 'JPEG' else detected_format.lower()
            if ext not in ALLOWED_FORMATS:
                raise ValueError(f"Неподдерживаемый формат: {ext}")
            
            # Генерируем уникальное имя файла
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            # ✅ ШАГ 3: Сохраняем с оптимизацией
            with open(filepath, 'wb') as f:
                if save_format == 'JPEG':
                    img.save(f, format='JPEG', quality=IMAGE_QUALITY, optimize=True)
                elif save_format == 'PNG':
                    img.save(f, format='PNG', optimize=True)
                elif save_format == 'WEBP':
                    img.save(f, format='WEBP', quality=IMAGE_QUALITY, method=6)
                else:
                    img.save(f, format=save_format)
            
            saved_filenames.append(filename)
            print(f"✅ Изображение обработано: {filename} ({img.size[0]}x{img.size[1]}px)")
            
        except Exception as e:
            # Если одно изображение не удалось загрузить - откатываем всё
            delete_images(saved_filenames)
            raise ValueError(f"Ошибка загрузки изображения: {str(e)}")
    
    return saved_filenames


async def process_uploaded_files(files: List) -> List[str]:
    """
    Принимает список UploadFile из multipart form.
    Валидирует, оптимизирует и сохраняет изображения.
    Возвращает список имён файлов.
    """
    from fastapi import UploadFile
    
    saved_filenames = []
    
    for file in files:
        if not isinstance(file, UploadFile):
            continue
        
        try:
            # Читаем файл в память
            image_data = await file.read()
            
            # Проверка размера файла
            if len(image_data) > MAX_FILE_SIZE:
                raise ValueError(f"Файл слишком большой: {len(image_data) / (1024*1024):.1f}MB (макс 5MB)")
            
            # Magic bytes (реальный формат)
            detected_format = verify_magic_bytes(image_data)
            if not detected_format:
                raise ValueError("Недопустимый формат файла (не изображение)")
            
            # Pillow validation
            if not validate_image(image_data):
                raise ValueError("Повреждённое изображение")
            
            # Открываем изображение
            img = Image.open(BytesIO(image_data))
            
            # Конвертируем RGBA → RGB (для JPEG/WebP без прозрачности)
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Удаляем EXIF (приватность)
            img = remove_exif(img)
            
            # Resize до 1200px
            img = resize_image(img, MAX_IMAGE_SIZE)
            
            # Определяем формат для сохранения
            original_format = img.format or detected_format.upper()
            save_format = 'JPEG' if original_format.upper() in ('JPG', 'JPEG') else original_format.upper()
            
            # Расширение файла
            ext = 'jpg' if save_format == 'JPEG' else detected_format.lower()
            if ext not in ALLOWED_FORMATS:
                raise ValueError(f"Неподдерживаемый формат: {ext}")
            
            # Генерируем уникальное имя файла
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            # Сохраняем с оптимизацией
            with open(filepath, 'wb') as f:
                if save_format == 'JPEG':
                    img.save(f, format='JPEG', quality=IMAGE_QUALITY, optimize=True)
                elif save_format == 'PNG':
                    img.save(f, format='PNG', optimize=True)
                elif save_format == 'WEBP':
                    img.save(f, format='WEBP', quality=IMAGE_QUALITY, method=6)
                else:
                    img.save(f, format=save_format)
            
            saved_filenames.append(filename)
            print(f"✅ Изображение обработано: {filename} ({img.size[0]}x{img.size[1]}px)")
            
        except Exception as e:
            # Если одно изображение не удалось загрузить - откатываем всё
            delete_images(saved_filenames)
            raise ValueError(f"Ошибка загрузки изображения: {str(e)}")
    
    return saved_filenames


def delete_images(filenames: List[str]):
    """Удалить файлы изображений с диска"""
    for filename in filenames:
        filepath = os.path.join(UPLOAD_DIR, filename)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"🗑 Удалено: {filename}")
        except Exception as e:
            print(f"⚠️ Ошибка удаления {filename}: {e}")



def get_image_urls(images_json: str) -> List[str]:
    """
    Преобразовать JSON с именами файлов в список полных URL.
    Пример: ["abc123.jpg"] -> ["http://127.0.0.1:8000/uploads/images/abc123.jpg"]
    """
    import json
    
    if not images_json:
        return []
    
    try:
        filenames = json.loads(images_json)
        return [f"{BASE_URL}/uploads/images/{filename}" for filename in filenames]
    except Exception:
        return []
    
async def process_uploaded_files(files: List) -> List[str]:
    """
    Обработка файлов из multipart form (FastAPI UploadFile).
    Валидирует и сохраняет изображения асинхронно.
    """
    import aiofiles
    
    saved_filenames = []
    
    for file in files:
        try:
            # Читаем содержимое
            content = await file.read()
            
            # Валидация
            if not validate_image(content):
                raise ValueError(f"Недопустимый формат: {file.filename}")
            
            # Определяем расширение
            img = Image.open(BytesIO(content))
            ext = img.format.lower()
            
            if ext == 'jpeg':
                ext = 'jpg'
            
            if ext not in ['jpg', 'png', 'gif', 'webp']:
                raise ValueError(f"Неподдерживаемый формат: {ext}")
            
            # Генерируем имя
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            # Сохраняем асинхронно
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(content)
            
            saved_filenames.append(filename)
            
        except Exception as e:
            delete_images(saved_filenames)
            raise ValueError(f"Ошибка загрузки {file.filename}: {str(e)}")
    
    return saved_filenames