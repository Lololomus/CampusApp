import asyncio
import hashlib
import logging
import os
import re
import shutil
import struct
import subprocess
import tempfile
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from app.utils import UPLOADS_ROOT, READ_CHUNK_SIZE


logger = logging.getLogger(__name__)


PRIVATE_DOCUMENTS_ROOT = Path(os.getenv("DOCUMENTS_DIR", str(UPLOADS_ROOT.parent / "private_documents"))).resolve()
DOCUMENTS_ROOT = PRIVATE_DOCUMENTS_ROOT / "originals"
DOCUMENT_PREVIEWS_ROOT = PRIVATE_DOCUMENTS_ROOT / "previews"
DOCUMENT_TMP_ROOT = PRIVATE_DOCUMENTS_ROOT / "tmp"

MAX_DOCUMENT_SIZE = int(os.getenv("MAX_DOCUMENT_SIZE_BYTES", str(25 * 1024 * 1024)))
MAX_DOCUMENTS_PER_POST = 3
MAX_TEXT_DOCUMENT_BYTES = int(os.getenv("MAX_TEXT_DOCUMENT_BYTES", str(2 * 1024 * 1024)))
MAX_UNCOMPRESSED_DOCUMENT_BYTES = int(
    os.getenv("MAX_UNCOMPRESSED_DOCUMENT_BYTES", str(200 * 1024 * 1024))
)
MAX_DOCUMENT_COMPRESSION_RATIO = int(os.getenv("MAX_DOCUMENT_COMPRESSION_RATIO", "100"))

LIBREOFFICE_TIMEOUT_SECONDS = int(os.getenv("LIBREOFFICE_TIMEOUT_SECONDS", "60"))
LIBREOFFICE_CONCURRENCY = max(1, int(os.getenv("LIBREOFFICE_CONCURRENCY", "2")))


ALLOWED_DOCUMENTS: Dict[str, Dict[str, str]] = {
    ".pdf": {"mime": "application/pdf", "kind": "pdf"},
    ".docx": {"mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "kind": "word"},
    ".xlsx": {"mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "kind": "excel"},
    ".pptx": {"mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "kind": "powerpoint"},
    ".odt": {"mime": "application/vnd.oasis.opendocument.text", "kind": "word"},
    ".ods": {"mime": "application/vnd.oasis.opendocument.spreadsheet", "kind": "excel"},
    ".odp": {"mime": "application/vnd.oasis.opendocument.presentation", "kind": "powerpoint"},
    ".rtf": {"mime": "application/rtf", "kind": "text"},
    ".txt": {"mime": "text/plain", "kind": "text"},
}

OOXML_REQUIRED_PARTS = {
    ".docx": "word/document.xml",
    ".xlsx": "xl/workbook.xml",
    ".pptx": "ppt/presentation.xml",
}

ODF_MIMES = {
    ".odt": b"application/vnd.oasis.opendocument.text",
    ".ods": b"application/vnd.oasis.opendocument.spreadsheet",
    ".odp": b"application/vnd.oasis.opendocument.presentation",
}

SAFE_FILENAME_RE = re.compile(r"[\x00-\x1f\x7f/\\]+")
WINDOWS_LIBREOFFICE_PATHS = (
    Path("C:/Program Files/LibreOffice/program/soffice.exe"),
    Path("C:/Program Files (x86)/LibreOffice/program/soffice.exe"),
)

DOCUMENTS_ROOT.mkdir(parents=True, exist_ok=True)
DOCUMENT_PREVIEWS_ROOT.mkdir(parents=True, exist_ok=True)
DOCUMENT_TMP_ROOT.mkdir(parents=True, exist_ok=True)


_LIBREOFFICE_SEMAPHORE: Optional[asyncio.Semaphore] = None


def _get_libreoffice_semaphore() -> asyncio.Semaphore:
    """Lazy-init semaphore so it binds to the current running loop."""
    global _LIBREOFFICE_SEMAPHORE
    if _LIBREOFFICE_SEMAPHORE is None:
        _LIBREOFFICE_SEMAPHORE = asyncio.Semaphore(LIBREOFFICE_CONCURRENCY)
    return _LIBREOFFICE_SEMAPHORE


class DocumentProcessingError(ValueError):
    pass


def sanitize_original_filename(filename: str) -> str:
    cleaned = SAFE_FILENAME_RE.sub("_", Path(filename or "document").name).strip(" .")
    if not cleaned:
        cleaned = "document"
    if len(cleaned) > 180:
        suffix = Path(cleaned).suffix
        stem = cleaned[: max(1, 180 - len(suffix))]
        cleaned = f"{stem}{suffix}"
    return cleaned


def _file_sha256(path: Path) -> str:
    sha = hashlib.sha256()
    with open(path, "rb") as fp:
        while True:
            chunk = fp.read(READ_CHUNK_SIZE)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


async def save_upload_to_temp(file: UploadFile, ext: str) -> Path:
    """Stream UploadFile to disk under DOCUMENT_TMP_ROOT without holding it in memory."""
    tmp_fd, tmp_path_str = tempfile.mkstemp(suffix=ext, prefix="upload_", dir=str(DOCUMENT_TMP_ROOT))
    tmp_path = Path(tmp_path_str)
    total_size = 0
    try:
        with os.fdopen(tmp_fd, "wb") as fp:
            while True:
                chunk = await file.read(READ_CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_DOCUMENT_SIZE:
                    raise DocumentProcessingError(
                        f"Document {file.filename} is too large"
                    )
                fp.write(chunk)
        if total_size == 0:
            raise DocumentProcessingError("Document is empty")
        return tmp_path
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


def _validate_zip_against_bombs(archive: zipfile.ZipFile) -> None:
    total_uncompressed = 0
    total_compressed = 0
    for info in archive.infolist():
        if info.file_size > MAX_UNCOMPRESSED_DOCUMENT_BYTES:
            raise DocumentProcessingError("Document is suspicious (zip bomb)")
        total_uncompressed += info.file_size
        total_compressed += info.compress_size
    if total_uncompressed > MAX_UNCOMPRESSED_DOCUMENT_BYTES:
        raise DocumentProcessingError("Document is suspicious (zip bomb)")
    if total_compressed > 0:
        ratio = total_uncompressed / total_compressed
        if ratio > MAX_DOCUMENT_COMPRESSION_RATIO:
            raise DocumentProcessingError("Document is suspicious (zip bomb)")


def validate_document_file(path: Path, ext: str) -> None:
    if ext not in ALLOWED_DOCUMENTS:
        raise DocumentProcessingError("Unsupported document type")

    try:
        size = path.stat().st_size
    except OSError as exc:
        raise DocumentProcessingError("Document is unreadable") from exc

    if size == 0:
        raise DocumentProcessingError("Document is empty")

    if ext == ".pdf":
        with open(path, "rb") as fp:
            head = fp.read(8)
        if not head.startswith(b"%PDF-"):
            raise DocumentProcessingError("PDF signature mismatch")
        return

    if ext == ".rtf":
        with open(path, "rb") as fp:
            head = fp.read(16)
        if not head.lstrip().startswith(b"{\\rtf"):
            raise DocumentProcessingError("RTF signature mismatch")
        return

    if ext == ".txt":
        if size > MAX_TEXT_DOCUMENT_BYTES:
            raise DocumentProcessingError(
                f"Text document exceeds {MAX_TEXT_DOCUMENT_BYTES // 1024} KB limit"
            )
        try:
            with open(path, "rb") as fp:
                data = fp.read()
            if b"\x00" in data:
                raise DocumentProcessingError("Text document contains binary data")
            data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise DocumentProcessingError("Text document must be UTF-8") from exc
        return

    if ext in OOXML_REQUIRED_PARTS:
        try:
            with zipfile.ZipFile(path) as archive:
                _validate_zip_against_bombs(archive)
                names = set(archive.namelist())
        except zipfile.BadZipFile as exc:
            raise DocumentProcessingError("Office document is not a valid ZIP package") from exc
        if "[Content_Types].xml" not in names or OOXML_REQUIRED_PARTS[ext] not in names:
            raise DocumentProcessingError("Office document structure mismatch")
        return

    if ext in ODF_MIMES:
        try:
            with zipfile.ZipFile(path) as archive:
                _validate_zip_against_bombs(archive)
                mimetype = archive.read("mimetype")
        except (zipfile.BadZipFile, KeyError) as exc:
            raise DocumentProcessingError("OpenDocument structure mismatch") from exc
        if mimetype.strip() != ODF_MIMES[ext]:
            raise DocumentProcessingError("OpenDocument type mismatch")


async def scan_document_with_clamav(
    path: Path,
    *,
    user_id: Optional[int] = None,
    filename: Optional[str] = None,
) -> None:
    host = os.getenv("CLAMAV_HOST", "127.0.0.1")
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    timeout = float(os.getenv("CLAMAV_TIMEOUT_SECONDS", "20"))

    async def _do_scan() -> str:
        reader, writer = await asyncio.open_connection(host, port)
        try:
            writer.write(b"zINSTREAM\0")
            await writer.drain()
            with open(path, "rb") as fp:
                while True:
                    chunk = fp.read(READ_CHUNK_SIZE)
                    if not chunk:
                        break
                    writer.write(struct.pack(">I", len(chunk)) + chunk)
                    await writer.drain()
            writer.write(struct.pack(">I", 0))
            await writer.drain()
            response_bytes = await reader.read(4096)
            return response_bytes.decode("utf-8", errors="replace")
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except (OSError, ConnectionError):
                pass

    try:
        response = await asyncio.wait_for(_do_scan(), timeout=timeout)
    except (OSError, asyncio.TimeoutError, ConnectionError) as exc:
        logger.warning(
            "clamav unavailable user=%s file=%s error=%s",
            user_id,
            filename,
            exc,
        )
        raise DocumentProcessingError("Antivirus scanner is unavailable") from exc

    clean_response = response.strip().rstrip("\0")
    if not clean_response.endswith(": OK"):
        try:
            sha256 = _file_sha256(path)
        except OSError:
            sha256 = "?"
        logger.warning(
            "clamav FOUND user=%s file=%s sha256=%s response=%r",
            user_id,
            filename,
            sha256,
            clean_response,
        )
        raise DocumentProcessingError("Document failed antivirus scan")


def make_private_document_paths(ext: str) -> tuple[str, Path, str, Path]:
    now = datetime.utcnow()
    rel_dir = f"{now.year}/{now.month:02d}"
    original_name = f"{uuid.uuid4().hex}{ext}"
    preview_name = f"{uuid.uuid4().hex}.pdf"
    original_rel = f"{rel_dir}/{original_name}"
    preview_rel = f"{rel_dir}/{preview_name}"
    original_abs = DOCUMENTS_ROOT / rel_dir / original_name
    preview_abs = DOCUMENT_PREVIEWS_ROOT / rel_dir / preview_name
    original_abs.parent.mkdir(parents=True, exist_ok=True)
    preview_abs.parent.mkdir(parents=True, exist_ok=True)
    return original_rel, original_abs, preview_rel, preview_abs


def convert_document_preview(original_path: Path, preview_path: Path, ext: str) -> str:
    if ext == ".pdf":
        shutil.copyfile(original_path, preview_path)
        return "ready"

    def finalize_generated_pdf() -> bool:
        generated = preview_path.parent / f"{original_path.stem}.pdf"
        if not generated.exists():
            return False
        if generated != preview_path:
            os.replace(generated, preview_path)
        return True

    output_dir = preview_path.parent
    local_binary = (
        os.getenv("LIBREOFFICE_BIN")
        or shutil.which("libreoffice")
        or shutil.which("soffice")
    )
    if not local_binary:
        local_binary = next(
            (str(path) for path in WINDOWS_LIBREOFFICE_PATHS if path.exists()), ""
        )

    if not local_binary:
        logger.warning("LibreOffice binary not found; preview generation skipped")
        return "failed"

    with tempfile.TemporaryDirectory(prefix="doc_preview_") as user_install_dir:
        command = [
            local_binary,
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--norestore",
            f"-env:UserInstallation=file://{user_install_dir}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(original_path),
        ]
        try:
            subprocess.run(
                command,
                check=True,
                timeout=LIBREOFFICE_TIMEOUT_SECONDS,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except subprocess.CalledProcessError as exc:
            stderr_tail = (exc.stderr or b"").decode("utf-8", errors="replace")[-2000:]
            logger.warning(
                "LibreOffice failed (rc=%s) for %s: %s",
                exc.returncode,
                original_path.name,
                stderr_tail,
            )
            return "failed"
        except subprocess.TimeoutExpired:
            logger.warning(
                "LibreOffice timed out after %ss for %s",
                LIBREOFFICE_TIMEOUT_SECONDS,
                original_path.name,
            )
            return "failed"
        except FileNotFoundError:
            logger.warning("LibreOffice binary missing at runtime: %s", local_binary)
            return "failed"

    return "ready" if finalize_generated_pdf() else "failed"


async def process_uploaded_documents(
    files: List[UploadFile],
    *,
    uploader_id: Optional[int] = None,
) -> List[dict]:
    valid_files = [file for file in files if file and file.filename]
    if len(valid_files) > MAX_DOCUMENTS_PER_POST:
        raise DocumentProcessingError("Maximum 3 documents")

    saved: List[dict] = []
    try:
        for file in valid_files:
            original_filename = sanitize_original_filename(file.filename)
            ext = Path(original_filename).suffix.lower()
            if ext not in ALLOWED_DOCUMENTS:
                raise DocumentProcessingError("Unsupported document type")

            tmp_path = await save_upload_to_temp(file, ext)
            stored_rel, stored_abs, preview_rel, preview_abs = make_private_document_paths(ext)
            try:
                await run_in_threadpool(validate_document_file, tmp_path, ext)
                await scan_document_with_clamav(
                    tmp_path,
                    user_id=uploader_id,
                    filename=original_filename,
                )
                size_bytes = tmp_path.stat().st_size
                os.replace(tmp_path, stored_abs)
            except BaseException:
                tmp_path.unlink(missing_ok=True)
                raise

            semaphore = _get_libreoffice_semaphore()
            async with semaphore:
                preview_status = await run_in_threadpool(
                    convert_document_preview, stored_abs, preview_abs, ext
                )

            if preview_status != "ready":
                preview_rel = ""
                if preview_abs.exists():
                    preview_abs.unlink(missing_ok=True)

            saved.append({
                "original_filename": original_filename,
                "stored_path": stored_rel,
                "preview_pdf_path": preview_rel or None,
                "file_ext": ext.lstrip("."),
                "mime_type": ALLOWED_DOCUMENTS[ext]["mime"],
                "size_bytes": size_bytes,
                "scan_status": "clean",
                "preview_status": preview_status,
            })
    except Exception:
        delete_document_files(saved)
        raise
    finally:
        for file in valid_files:
            await file.close()

    return saved


def resolve_document_path(relative_path: Optional[str], preview: bool = False) -> Optional[Path]:
    if not relative_path:
        return None
    root = DOCUMENT_PREVIEWS_ROOT if preview else DOCUMENTS_ROOT
    clean = str(relative_path).replace("\\", "/").lstrip("/")
    if not clean:
        return None
    if (
        clean.startswith("/")
        or Path(clean).is_absolute()
        or (len(clean) >= 2 and clean[1] == ":")
    ):
        return None
    candidate = (root / clean).resolve()
    root_resolved = root.resolve()
    if root_resolved not in candidate.parents and candidate != root_resolved:
        return None
    return candidate


def delete_document_files(documents: List[dict]) -> None:
    for doc in documents or []:
        stored = resolve_document_path(doc.get("stored_path"))
        preview = resolve_document_path(doc.get("preview_pdf_path"), preview=True)
        for path in (stored, preview):
            if path and path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass
