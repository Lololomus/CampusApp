import os
import base64
import uuid
import json
import posixpath
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urlparse

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

try:
    from pillow_heif import register_heif_opener
except Exception:
    register_heif_opener = None

# ================= CONFIG =================

UPLOADS_ROOT = Path(os.getenv("UPLOADS_DIR", "uploads")).resolve()
ALLOWED_UPLOAD_KINDS = {"images", "avatars", "videos", "thumbs"}

MAX_IMAGE_SIZE = 2048
MAX_AVATAR_SIZE = 512
MIN_SHORT_SIDE = 40
MIN_TOTAL_PIXELS = 10_000
WEBP_QUALITY = 88
WEBP_METHOD = 6
MAX_FILE_SIZE = 20 * 1024 * 1024
READ_CHUNK_SIZE = 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000

# HEIF/HEIC brands for ISO BMFF.
HEIF_BRANDS = {
    b"heic",
    b"heix",
    b"hevc",
    b"hevx",
    b"heim",
    b"heis",
    b"mif1",
    b"msf1",
}

if register_heif_opener:
    register_heif_opener()

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
os.makedirs(UPLOADS_ROOT / "images", exist_ok=True)
os.makedirs(UPLOADS_ROOT / "avatars", exist_ok=True)
os.makedirs(UPLOADS_ROOT / "videos", exist_ok=True)
os.makedirs(UPLOADS_ROOT / "thumbs", exist_ok=True)

# ================= LOGIC =================


def detect_image_format(file_content: bytes) -> Optional[str]:
    if len(file_content) < 12:
        return None
    if file_content.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if file_content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if file_content.startswith(b"GIF87a") or file_content.startswith(b"GIF89a"):
        return "gif"
    if file_content[:4] == b"RIFF" and file_content[8:12] == b"WEBP":
        return "webp"
    if file_content[4:8] == b"ftyp" and file_content[8:12] in HEIF_BRANDS:
        return "heif"
    return None


def verify_magic_bytes(file_content: bytes) -> bool:
    return detect_image_format(file_content) is not None


def _kind_or_default(kind: str) -> str:
    return kind if kind in ALLOWED_UPLOAD_KINDS else "images"


def _extract_upload_parts(value: str, default_kind: str = "images") -> Optional[Tuple[str, str]]:
    raw = str(value or "").strip().replace("\\", "/")
    if not raw:
        return None

    clean = raw.split("#")[0].split("?")[0]
    parsed = urlparse(clean)
    if parsed.scheme and parsed.netloc:
        clean = parsed.path

    clean = clean.strip().lstrip("/")
    if not clean:
        return None

    normalized = posixpath.normpath(clean)
    if normalized in {"", ".", ".."}:
        return None
    if normalized.startswith("../") or "/../" in normalized:
        return None

    parts = normalized.split("/")
    detected_kind = _kind_or_default(default_kind)
    relative_path = normalized

    if len(parts) >= 3 and parts[0] == "uploads" and parts[1] in ALLOWED_UPLOAD_KINDS:
        detected_kind = parts[1]
        relative_path = "/".join(parts[2:])
    elif len(parts) >= 2 and parts[0] in ALLOWED_UPLOAD_KINDS:
        detected_kind = parts[0]
        relative_path = "/".join(parts[1:])

    relative_path = posixpath.normpath(relative_path).lstrip("/")
    if not relative_path or relative_path in {".", ".."}:
        return None
    if relative_path.startswith("../") or "/../" in relative_path:
        return None

    return detected_kind, relative_path


def get_storage_key(value: str, kind: str = "images") -> str:
    parts = _extract_upload_parts(value, default_kind=kind)
    if not parts:
        return ""
    _, relative_path = parts
    return relative_path


def _make_storage_paths(kind: str) -> Tuple[str, Path, Path]:
    safe_kind = _kind_or_default(kind)
    now = datetime.utcnow()
    rel_dir = f"{now.year}/{now.month:02d}"
    filename = f"{uuid.uuid4().hex}.webp"
    relative_path = f"{rel_dir}/{filename}"

    absolute_dir = UPLOADS_ROOT / safe_kind / rel_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)

    final_path = absolute_dir / filename
    temp_path = absolute_dir / f".tmp_{uuid.uuid4().hex}.webp"
    return relative_path, temp_path, final_path


def _prepare_image(img: Image.Image, max_side: int) -> Image.Image:
    if getattr(img, "is_animated", False):
        img.seek(0)

    img = ImageOps.exif_transpose(img)

    short_side = min(img.width, img.height)
    total_pixels = img.width * img.height
    if short_side < MIN_SHORT_SIDE and total_pixels < MIN_TOTAL_PIXELS:
        raise ValueError(
            f"Image too small (short side < {MIN_SHORT_SIDE}px and area < {MIN_TOTAL_PIXELS}px)"
        )

    if img.width > max_side or img.height > max_side:
        img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    has_alpha = "A" in img.getbands() or (
        img.mode == "P" and "transparency" in (img.info or {})
    )
    target_mode = "RGBA" if has_alpha else "RGB"
    if img.mode != target_mode:
        img = img.convert(target_mode)
    return img


def process_image_sync(content: bytes, kind: str = "images", max_side: int = MAX_IMAGE_SIZE) -> dict:
    if not verify_magic_bytes(content):
        raise ValueError("Unsupported image format")

    relative_path, temp_path, final_path = _make_storage_paths(kind)
    clean_img: Optional[Image.Image] = None

    try:
        with Image.open(BytesIO(content)) as img:
            img.load()
            clean_img = _prepare_image(img, max_side=max_side)

            with open(temp_path, "wb") as f:
                clean_img.save(
                    f,
                    format="WEBP",
                    quality=WEBP_QUALITY,
                    method=WEBP_METHOD,
                    optimize=True,
                    exif=b"",
                )

        os.replace(temp_path, final_path)
        file_size = final_path.stat().st_size
        return {
            "url": relative_path,
            "w": clean_img.width,
            "h": clean_img.height,
            "format": "webp",
            "size_bytes": file_size,
        }
    except (UnidentifiedImageError, OSError) as exc:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise ValueError("Failed to decode image") from exc
    except ValueError:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise ValueError("Failed to process image") from exc


async def _read_upload_content_limited(file: UploadFile) -> bytes:
    total_size = 0
    chunks: List[bytes] = []
    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise ValueError(f"File {file.filename} is too large (>20MB)")
        chunks.append(chunk)
    return b"".join(chunks)


async def process_uploaded_files(
    files: List[UploadFile],
    kind: str = "images",
    max_side: Optional[int] = None,
) -> List[dict]:
    saved_files_meta: List[dict] = []
    final_max_side = max_side or (MAX_AVATAR_SIZE if kind == "avatars" else MAX_IMAGE_SIZE)

    for file in files:
        if not file.filename:
            continue

        try:
            content = await _read_upload_content_limited(file)
            meta = await run_in_threadpool(
                process_image_sync,
                content,
                kind=kind,
                max_side=final_max_side,
            )
            saved_files_meta.append(meta)
        except Exception as exc:
            delete_images(saved_files_meta, default_kind=kind)
            raise ValueError(f"Error processing {file.filename}: {str(exc)}") from exc
        finally:
            await file.close()

    return saved_files_meta


def process_base64_images(base64_list: List[str], kind: str = "images") -> List[dict]:
    saved_files_meta: List[dict] = []

    for b64_str in base64_list:
        try:
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]

            content = base64.b64decode(b64_str)
            meta = process_image_sync(content, kind=kind)
            saved_files_meta.append(meta)
        except Exception as exc:
            delete_images(saved_files_meta, default_kind=kind)
            raise ValueError(f"Invalid Base64 image: {str(exc)}") from exc

    return saved_files_meta


def parse_keep_file_list(raw_value: Optional[str], kind: str = "images") -> List[str]:
    if not raw_value:
        return []

    try:
        data = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid keep payload: expected JSON array") from exc

    if not isinstance(data, list):
        raise ValueError("Invalid keep payload: expected JSON array")

    result: List[str] = []
    for item in data:
        candidate: Optional[str] = None
        if isinstance(item, str):
            candidate = item
        elif isinstance(item, dict):
            candidate = item.get("url")

        key = get_storage_key(candidate or "", kind=kind)
        if key and key not in result:
            result.append(key)

    return result


def delete_all_media(media_data: Union[List[dict], List[str], str]) -> None:
    """
    Удаляет все медиа из списка: изображения через delete_images, видео через delete_video.
    Используется при полном удалении поста/товара.
    """
    from app.video_utils import delete_video

    if not media_data:
        return

    if isinstance(media_data, str):
        try:
            media_data = json.loads(media_data)
        except Exception:
            return

    target_list = media_data if isinstance(media_data, list) else [media_data]

    images = [item for item in target_list if not (isinstance(item, dict) and item.get("type") == "video")]
    videos = [item for item in target_list if isinstance(item, dict) and item.get("type") == "video"]

    if images:
        delete_images(images)
    for video in videos:
        try:
            delete_video(video)
        except Exception:
            pass


def delete_images(images_data: Union[List[dict], List[str], str], default_kind: str = "images"):
    if not images_data:
        return

    if isinstance(images_data, str):
        try:
            images_data = json.loads(images_data)
        except Exception:
            return

    target_list = images_data if isinstance(images_data, list) else [images_data]

    for item in target_list:
        raw_path = None
        if isinstance(item, dict):
            raw_path = item.get("url")
        elif isinstance(item, str):
            raw_path = item

        parsed = _extract_upload_parts(raw_path or "", default_kind=default_kind)
        if not parsed:
            continue

        kind, relative_path = parsed
        base_dir = (UPLOADS_ROOT / kind).resolve()
        target = (base_dir / relative_path).resolve()

        if base_dir not in target.parents and target != base_dir:
            continue

        if target.exists():
            try:
                target.unlink()
            except Exception:
                pass


def normalize_uploads_path(value: str, kind: str = "images") -> str:
    parsed = _extract_upload_parts(value, default_kind=kind)
    if not parsed:
        return ""
    detected_kind, relative_path = parsed
    return f"/uploads/{detected_kind}/{relative_path}"


def get_image_urls(images_json: Union[str, List]) -> List[dict]:
    if not images_json:
        return []

    data = images_json
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            return []

    result: List[dict] = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, str):
                normalized_url = normalize_uploads_path(item, "images")
                if not normalized_url:
                    continue
                result.append({
                    "url": normalized_url,
                    "w": 800,
                    "h": 800,
                })
            elif isinstance(item, dict):
                media_type = item.get("type", "image")
                url_kind = "videos" if media_type == "video" else "images"
                normalized_url = normalize_uploads_path(item.get("url", ""), url_kind)
                if not normalized_url:
                    continue

                image_meta: Dict[str, Any] = {
                    "type": media_type,
                    "url": normalized_url,
                    "w": item.get("w", 800),
                    "h": item.get("h", 800),
                }
                if item.get("format"):
                    image_meta["format"] = item.get("format")
                if item.get("size_bytes") is not None:
                    image_meta["size_bytes"] = item.get("size_bytes")
                # Видео-поля
                if media_type == "video":
                    thumb_url = normalize_uploads_path(item.get("thumbnail_url", ""), "thumbs")
                    if thumb_url:
                        image_meta["thumbnail_url"] = thumb_url
                    if item.get("duration") is not None:
                        image_meta["duration"] = item.get("duration")
                    if item.get("thumbnail_w") is not None:
                        image_meta["thumbnail_w"] = item.get("thumbnail_w")
                    if item.get("thumbnail_h") is not None:
                        image_meta["thumbnail_h"] = item.get("thumbnail_h")
                result.append(image_meta)

    return result

