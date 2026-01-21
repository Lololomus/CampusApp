# ===== 📄 ФАЙЛ: backend/app/utils.py =====

import os
import base64
import uuid
import json
import shutil
from typing import List, Optional, Dict, Union
from PIL import Image
from io import BytesIO
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

# ================= CONFIG =================

# Базовый URL (важно для формирования ссылок на картинки)
# Для эмулятора Android: "http://10.0.2.2:8000"
# Для iOS/Web: "http://127.0.0.1:8000" или "http://localhost:8000"
BASE_URL = "http://127.0.0.1:8000"

UPLOAD_DIR = "uploads/images"
MAX_IMAGE_SIZE = 1200  # Макс размер стороны (px)
MIN_IMAGE_SIZE = 100   # Мин размер
IMAGE_QUALITY = 85     # Качество JPEG/WEBP
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Ограничение для защиты от "Zip Bomb" атак
Image.MAX_IMAGE_PIXELS = 90_000_000

# Создаем папки при старте
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Сигнатуры файлов (Magic Bytes)
MAGIC_BYTES = {
    b'\xff\xd8\xff': 'jpg',
    b'\x89\x50\x4e\x47': 'png',
    b'\x47\x49\x46\x38': 'gif',
    b'\x52\x49\x46\x46': 'webp',
}

# ================= LOGIC =================

def verify_magic_bytes(file_content: bytes) -> bool:
    """Проверка реального типа файла по заголовку"""
    if len(file_content) < 4:
        return False
    for magic, ext in MAGIC_BYTES.items():
        if file_content.startswith(magic):
            return True
    return False

def process_image_sync(content: bytes) -> dict:
    """
    Синхронная обработка изображения (CPU-bound).
    Изменяет размер, удаляет EXIF, конвертирует и сохраняет.
    Возвращает метаданные: url, width, height.
    """
    if not verify_magic_bytes(content):
        raise ValueError("Invalid image format (check magic bytes)")

    try:
        img = Image.open(BytesIO(content))
        
        # Защита от очень маленьких картинок
        if img.width < MIN_IMAGE_SIZE or img.height < MIN_IMAGE_SIZE:
            raise ValueError(f"Image too small (min {MIN_IMAGE_SIZE}px)")

        # Конвертация RGBA/P -> RGB (для сохранения в JPG)
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1]) # Используем альфа-канал как маску
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Ресайз (с сохранением пропорций)
        if img.width > MAX_IMAGE_SIZE or img.height > MAX_IMAGE_SIZE:
            img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)

        # Удаление EXIF (создаем новую картинку без метаданных)
        data = list(img.getdata())
        clean_img = Image.new(img.mode, img.size)
        clean_img.putdata(data)
        
        # Генерируем уникальное имя
        filename = f"{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(UPLOAD_DIR, filename)

        # Сохраняем
        with open(filepath, "wb") as f:
            clean_img.save(f, format="JPEG", quality=IMAGE_QUALITY, optimize=True)

        return {
            "url": filename,
            "w": clean_img.width,
            "h": clean_img.height
        }

    except Exception as e:
        print(f"❌ Error in process_image_sync: {e}")
        raise ValueError("Failed to process image")

async def process_uploaded_files(files: List[UploadFile]) -> List[dict]:
    """
    Асинхронная обертка для обработки списка загружаемых файлов.
    Использует ThreadPool для тяжелых операций с изображениями.
    """
    saved_files_meta = []
    
    for file in files:
        if not file.filename:
            continue
            
        # Читаем асинхронно
        content = await file.read()
        
        if len(content) > MAX_FILE_SIZE:
            # Очищаем уже загруженное при ошибке
            delete_images(saved_files_meta)
            raise ValueError(f"File {file.filename} is too large (>10MB)")

        try:
            # Обрабатываем в отдельном потоке (чтобы не блочить сервер)
            meta = await run_in_threadpool(process_image_sync, content)
            saved_files_meta.append(meta)
        except Exception as e:
            delete_images(saved_files_meta)
            raise ValueError(f"Error processing {file.filename}: {str(e)}")
            
    return saved_files_meta

def process_base64_images(base64_list: List[str]) -> List[dict]:
    """
    Обработка Base64 строк (для легаси или JSON запросов).
    """
    saved_files_meta = []
    
    for b64_str in base64_list:
        try:
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]
            
            content = base64.b64decode(b64_str)
            
            # Запускаем синхронную функцию (здесь можно без threadpool, если их мало)
            meta = process_image_sync(content)
            saved_files_meta.append(meta)
        except Exception as e:
            delete_images(saved_files_meta)
            raise ValueError(f"Invalid Base64 image: {str(e)}")
            
    return saved_files_meta

def delete_images(images_data: Union[List[dict], List[str], str]):
    """
    Удаление изображений с диска.
    Принимает JSON строку, список строк или список словарей (metadata).
    """
    if not images_data:
        return

    # Если пришла JSON строка
    if isinstance(images_data, str):
        try:
            images_data = json.loads(images_data)
        except:
            return

    target_list = images_data if isinstance(images_data, list) else [images_data]

    for item in target_list:
        filename = None
        if isinstance(item, dict):
            filename = item.get("url")
        elif isinstance(item, str):
            # Если полный URL -> вытаскиваем имя файла
            filename = item.split("/")[-1]
        
        if filename:
            path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    print(f"⚠️ Failed to delete {path}: {e}")

def get_image_urls(images_json: Union[str, List]) -> List[dict]:
    """
    Преобразует хранящиеся данные (JSON или List) в список объектов с полными URL.
    Гарантирует формат: [{"url": "http...", "w": 100, "h": 100}, ...]
    """
    if not images_json:
        return []
    
    data = images_json
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except:
            return []
            
    result = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, str):
                # Старый формат (просто имя файла)
                fname = item.split("/")[-1]
                result.append({
                    "url": f"{BASE_URL}/uploads/images/{fname}",
                    "w": 800, # Fake dimensions for legacy
                    "h": 800
                })
            elif isinstance(item, dict):
                # Новый формат (метаданные)
                fname = item.get("url", "").split("/")[-1]
                result.append({
                    "url": f"{BASE_URL}/uploads/images/{fname}",
                    "w": item.get("w", 800),
                    "h": item.get("h", 800)
                })
    return result