# ===== FILE: video_utils.py =====
# Пайплайн обработки видео: валидация, сжатие через FFmpeg, генерация превью.
# По аналогии с utils.py для изображений, но с subprocess вместо Pillow.

import json
import os
import posixpath
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from app.utils import UPLOADS_ROOT, _extract_upload_parts

# ================= CONFIG =================

MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024   # 100 MB
MAX_VIDEO_DURATION = 60                    # секунд
MAX_VIDEO_DIMENSION = 1080                 # макс. сторона после сжатия
VIDEO_CRF = 23                             # качество H.264 (меньше = лучше, больше файл)
AUDIO_BITRATE = "128k"
FFMPEG_TIMEOUT = 120                       # секунд — kill если превышено
THUMB_TIMESTAMP = "00:00:01"              # кадр для превью
THUMB_MAX_SIDE = 720
READ_CHUNK_SIZE = 1024 * 1024             # 1 MB чанки при чтении

# Поддерживаемые форматы по magic bytes
# MP4/MOV: bytes[4:8] == b"ftyp"
# WebM: начинается с EBML header b"\x1a\x45\xdf\xa3"
ALLOWED_VIDEO_FORMATS = {"mp4", "mov", "webm"}


# ================= MAGIC BYTES =================


@lru_cache(maxsize=2)
def _resolve_media_binary(name: str) -> str:
    """
    Resolves ffmpeg/ffprobe path using env vars, PATH and common Windows paths.
    """
    if name not in {"ffmpeg", "ffprobe"}:
        raise ValueError(f"Unsupported binary name: {name}")

    env_var = "FFMPEG_BINARY" if name == "ffmpeg" else "FFPROBE_BINARY"
    env_path = os.getenv(env_var)
    if env_path and Path(env_path).exists():
        return env_path

    bin_dir = os.getenv("FFMPEG_BIN_DIR")
    exe_name = f"{name}.exe" if os.name == "nt" else name
    if bin_dir:
        candidate = Path(bin_dir) / exe_name
        if candidate.exists():
            return str(candidate)

    from_path = shutil.which(name)
    if from_path:
        return from_path

    if os.name == "nt":
        candidates = [
            Path("C:/Program Files/ffmpeg/bin") / exe_name,
            Path("C:/ffmpeg/bin") / exe_name,
        ]
        winget_root = (
            Path.home()
            / "AppData/Local/Microsoft/WinGet/Packages"
            / "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        )
        if winget_root.exists():
            for build_dir in sorted(winget_root.glob("ffmpeg-*/bin"), reverse=True):
                candidates.append(build_dir / exe_name)

        for candidate in candidates:
            if candidate.exists():
                return str(candidate)

    raise FileNotFoundError(f"{name} binary was not found")

def detect_video_format(file_content: bytes) -> Optional[str]:
    """Определяет формат видео по magic bytes. Возвращает 'mp4', 'mov', 'webm' или None."""
    if len(file_content) < 12:
        return None
    # WebM / Matroska — EBML header
    if file_content[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    # MP4 / MOV / 3GP — ISO Base Media File Format (ftyp box)
    if file_content[4:8] == b"ftyp":
        brand = file_content[8:12]
        # MOV (QuickTime) использует бренды qt__ / moov
        if brand in (b"qt  ", b"moov"):
            return "mov"
        return "mp4"
    return None


def verify_video_magic_bytes(file_content: bytes) -> bool:
    return detect_video_format(file_content) is not None


# ================= STORAGE PATHS =================

def _make_video_storage_paths(kind: str, ext: str) -> Tuple[str, Path, Path]:
    """
    Аналог _make_storage_paths() из utils.py.
    Возвращает (relative_path, temp_path, final_path).
    """
    now = datetime.utcnow()
    rel_dir = f"{now.year}/{now.month:02d}"
    filename = f"{uuid.uuid4().hex}.{ext}"
    relative_path = f"{rel_dir}/{filename}"

    absolute_dir = UPLOADS_ROOT / kind / rel_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)

    final_path = absolute_dir / filename
    temp_path = absolute_dir / f".tmp_{uuid.uuid4().hex}.{ext}"
    return relative_path, temp_path, final_path


# ================= FFPROBE =================

def _probe_video(file_path: Path) -> dict:
    """
    Запускает ffprobe и извлекает метаданные видео.
    Возвращает dict: {duration, width, height, has_audio, codec}.
    Вызывает ValueError если видео слишком длинное или нечитаемое.
    """
    try:
        result = subprocess.run(
            [
                _resolve_media_binary("ffprobe"), "-v", "quiet",
                "-print_format", "json",
                "-show_format", "-show_streams",
                str(file_path),
            ],
            capture_output=True,
            timeout=30,
            check=True,
        )
    except FileNotFoundError:
        raise ValueError("FFmpeg/ffprobe не установлен на сервере")
    except subprocess.TimeoutExpired:
        raise ValueError("ffprobe завис — файл повреждён или слишком большой")
    except subprocess.CalledProcessError as exc:
        raise ValueError(f"Не удалось прочитать видео: {exc.stderr.decode(errors='replace')[:200]}")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError("ffprobe вернул нечитаемый вывод") from exc

    # Ищем видео-поток
    streams = data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video_stream:
        raise ValueError("В файле нет видео-потока")

    # Длительность
    fmt = data.get("format", {})
    duration_str = fmt.get("duration") or video_stream.get("duration")
    try:
        duration = float(duration_str)
    except (TypeError, ValueError):
        raise ValueError("Не удалось определить длительность видео")

    if duration > MAX_VIDEO_DURATION:
        raise ValueError(
            f"Видео слишком длинное ({duration:.1f}с). Максимум {MAX_VIDEO_DURATION}с"
        )

    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    if width < 2 or height < 2:
        raise ValueError("Некорректные размеры видео")

    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    codec = video_stream.get("codec_name", "unknown")

    return {
        "duration": duration,
        "width": width,
        "height": height,
        "has_audio": has_audio,
        "codec": codec,
    }


# ================= COMPRESSION =================

def _compress_video(input_path: Path, output_path: Path, probe: dict) -> None:
    """
    Сжимает видео через FFmpeg в H.264/MP4:
    - CRF 23, preset medium
    - Масштаб ≤ 1080px (сохраняет пропорции, делает чётным)
    - AAC 128k (или -an если аудио нет)
    - -movflags +faststart для стриминга
    - -map_metadata -1 снимает все метаданные (GPS, устройство и т.д.)
    """
    scale_filter = (
        f"scale='min({MAX_VIDEO_DIMENSION},iw)':'min({MAX_VIDEO_DIMENSION},ih)'"
        ":force_original_aspect_ratio=decrease"
        ":force_divisible_by=2"
    )

    cmd = [
        _resolve_media_binary("ffmpeg"),
        "-i", str(input_path),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", str(VIDEO_CRF),
        "-vf", scale_filter,
        "-movflags", "+faststart",
        "-map_metadata", "-1",   # стрип всех метаданных
    ]

    if probe["has_audio"]:
        cmd += ["-c:a", "aac", "-b:a", AUDIO_BITRATE]
    else:
        cmd += ["-an"]

    cmd += ["-y", str(output_path)]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=FFMPEG_TIMEOUT,
        )
    except FileNotFoundError:
        raise ValueError("FFmpeg не установлен на сервере")
    except subprocess.TimeoutExpired:
        raise ValueError(
            f"FFmpeg превысил таймаут ({FFMPEG_TIMEOUT}с) при сжатии видео"
        )

    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace")[-400:]
        raise ValueError(f"Ошибка сжатия видео: {stderr}")


# ================= THUMBNAIL =================

def _generate_thumbnail(video_path: Path, thumb_path: Path) -> Tuple[int, int]:
    """
    Извлекает кадр на THUMB_TIMESTAMP как WebP.
    Возвращает (width, height) превью.
    """
    scale_filter = (
        f"scale='min({THUMB_MAX_SIDE},iw)':'min({THUMB_MAX_SIDE},ih)'"
        ":force_original_aspect_ratio=decrease"
        ":force_divisible_by=2"
    )
    cmd = [
        _resolve_media_binary("ffmpeg"),
        "-ss", THUMB_TIMESTAMP,
        "-i", str(video_path),
        "-vframes", "1",
        "-vf", scale_filter,
        "-map_metadata", "-1",
        "-y", str(thumb_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
    except FileNotFoundError:
        raise ValueError("FFmpeg не установлен на сервере")
    except subprocess.TimeoutExpired:
        raise ValueError("FFmpeg завис при генерации превью")

    if result.returncode != 0 or not thumb_path.exists():
        # Попробуем взять первый кадр (видео может быть короче 1 сек)
        cmd[cmd.index("-ss")] = "0"
        cmd[cmd.index(THUMB_TIMESTAMP)] = "0"
        result2 = subprocess.run(cmd, capture_output=True, timeout=30)
        if result2.returncode != 0 or not thumb_path.exists():
            raise ValueError("Не удалось сгенерировать превью видео")

    # Получаем размеры превью через ffprobe
    try:
        probe_result = subprocess.run(
            [
                _resolve_media_binary("ffprobe"), "-v", "quiet",
                "-print_format", "json",
                "-show_streams", str(thumb_path),
            ],
            capture_output=True,
            timeout=10,
            check=True,
        )
        data = json.loads(probe_result.stdout)
        stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
            {}
        )
        w = int(stream.get("width", THUMB_MAX_SIDE))
        h = int(stream.get("height", THUMB_MAX_SIDE))
    except Exception:
        w, h = THUMB_MAX_SIDE, THUMB_MAX_SIDE

    return w, h


# ================= MAIN PIPELINE =================

def process_video_sync(content: bytes) -> dict:
    """
    Полный синхронный пайплайн обработки видео.
    Вызывается через run_in_threadpool из async контекста.

    1. Валидация magic bytes
    2. Запись во временный файл
    3. ffprobe — проверка duration, размеров
    4. FFmpeg сжатие → H.264/MP4
    5. Генерация WebP превью
    6. Atomic move финальных файлов
    7. Cleanup временных файлов

    Returns dict:
        {type, url, thumbnail_url, w, h, duration, format, size_bytes, thumbnail_w, thumbnail_h}
    """
    if not verify_video_magic_bytes(content):
        raise ValueError("Неподдерживаемый формат видео. Разрешены: MP4, MOV, WebM")

    # Временный файл для входящих данных
    suffix = ".tmp_input_" + uuid.uuid4().hex
    tmp_input = Path(tempfile.gettempdir()) / suffix

    video_rel, video_temp, video_final = _make_video_storage_paths("videos", "mp4")
    thumb_rel, thumb_temp, thumb_final = _make_video_storage_paths("thumbs", "webp")

    try:
        # 1. Записываем входной файл
        tmp_input.write_bytes(content)

        # 2. Probe
        probe = _probe_video(tmp_input)

        # 3. Сжатие
        _compress_video(tmp_input, video_temp, probe)

        # 4. Превью
        _generate_thumbnail(video_temp, thumb_temp)

        # Получаем финальные размеры сжатого видео
        compressed_probe = _probe_video(video_temp)
        vid_w = compressed_probe["width"]
        vid_h = compressed_probe["height"]
        duration = compressed_probe["duration"]

        # Получаем размеры превью
        try:
            thumb_probe_result = subprocess.run(
                [
                    _resolve_media_binary("ffprobe"), "-v", "quiet",
                    "-print_format", "json",
                    "-show_streams", str(thumb_temp),
                ],
                capture_output=True, timeout=10, check=True,
            )
            thumb_data = json.loads(thumb_probe_result.stdout)
            thumb_stream = next(
                (s for s in thumb_data.get("streams", []) if s.get("codec_type") == "video"),
                {}
            )
            thumb_w = int(thumb_stream.get("width", THUMB_MAX_SIDE))
            thumb_h = int(thumb_stream.get("height", THUMB_MAX_SIDE))
        except Exception:
            thumb_w, thumb_h = THUMB_MAX_SIDE, THUMB_MAX_SIDE

        # 5. Atomic move
        os.replace(video_temp, video_final)
        os.replace(thumb_temp, thumb_final)

        size_bytes = video_final.stat().st_size

        return {
            "type": "video",
            "url": video_rel,
            "thumbnail_url": thumb_rel,
            "w": vid_w,
            "h": vid_h,
            "duration": round(duration, 2),
            "format": "mp4",
            "size_bytes": size_bytes,
            "thumbnail_w": thumb_w,
            "thumbnail_h": thumb_h,
        }

    except Exception:
        # Cleanup всех временных и финальных файлов
        for p in (video_temp, thumb_temp):
            try:
                if p.exists():
                    p.unlink(missing_ok=True)
            except Exception:
                pass
        raise
    finally:
        try:
            tmp_input.unlink(missing_ok=True)
        except Exception:
            pass


# ================= ASYNC ENTRY POINT =================

async def process_uploaded_video(file: UploadFile) -> dict:
    """
    Async обёртка для загрузки и обработки одного видео-файла.
    Читает файл чанками (лимит 100MB), затем обрабатывает в threadpool.
    """
    total_size = 0
    chunks = []
    try:
        while True:
            chunk = await file.read(READ_CHUNK_SIZE)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_VIDEO_FILE_SIZE:
                raise ValueError(
                    f"Видео слишком большое (>{MAX_VIDEO_FILE_SIZE // (1024*1024)}MB)"
                )
            chunks.append(chunk)
        content = b"".join(chunks)
        return await run_in_threadpool(process_video_sync, content)
    finally:
        await file.close()


# ================= DELETE =================

def delete_video(video_meta: dict) -> None:
    """
    Удаляет файл видео и его превью из storage.
    Защита от path traversal — аналогично delete_images() в utils.py.
    """
    # Удаляем видео
    _delete_upload_file(video_meta.get("url", ""), default_kind="videos")
    # Удаляем превью
    _delete_upload_file(video_meta.get("thumbnail_url", ""), default_kind="thumbs")


def _delete_upload_file(raw_path: str, default_kind: str) -> None:
    """Удаляет один файл из uploads/ с проверкой пути."""
    if not raw_path:
        return
    parsed = _extract_upload_parts(raw_path, default_kind=default_kind)
    if not parsed:
        return
    kind, relative_path = parsed
    base_dir = (UPLOADS_ROOT / kind).resolve()
    target = (base_dir / relative_path).resolve()

    if base_dir not in target.parents and target != base_dir:
        return

    if target.exists():
        try:
            target.unlink()
        except Exception:
            pass
