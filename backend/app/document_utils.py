import os
import re
import shutil
import socket
import struct
import subprocess
import tempfile
import uuid
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from app.utils import UPLOADS_ROOT, READ_CHUNK_SIZE


PRIVATE_DOCUMENTS_ROOT = Path(os.getenv("DOCUMENTS_DIR", str(UPLOADS_ROOT.parent / "private_documents"))).resolve()
DOCUMENTS_ROOT = PRIVATE_DOCUMENTS_ROOT / "originals"
DOCUMENT_PREVIEWS_ROOT = PRIVATE_DOCUMENTS_ROOT / "previews"
MAX_DOCUMENT_SIZE = int(os.getenv("MAX_DOCUMENT_SIZE_BYTES", str(25 * 1024 * 1024)))
MAX_DOCUMENTS_PER_POST = 3

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


async def read_document_content_limited(file: UploadFile) -> bytes:
    total_size = 0
    chunks: List[bytes] = []
    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_DOCUMENT_SIZE:
            raise DocumentProcessingError(f"Document {file.filename} is too large")
        chunks.append(chunk)
    return b"".join(chunks)


def validate_document_content(content: bytes, ext: str) -> None:
    if not content:
        raise DocumentProcessingError("Document is empty")
    if ext not in ALLOWED_DOCUMENTS:
        raise DocumentProcessingError("Unsupported document type")

    if ext == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise DocumentProcessingError("PDF signature mismatch")
        return

    if ext == ".rtf":
        if not content.lstrip().startswith(b"{\\rtf"):
            raise DocumentProcessingError("RTF signature mismatch")
        return

    if ext == ".txt":
        if b"\x00" in content[:4096]:
            raise DocumentProcessingError("Text document contains binary data")
        try:
            content[: min(len(content), 64 * 1024)].decode("utf-8")
        except UnicodeDecodeError as exc:
            raise DocumentProcessingError("Text document must be UTF-8") from exc
        return

    if ext in OOXML_REQUIRED_PARTS:
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
        except zipfile.BadZipFile as exc:
            raise DocumentProcessingError("Office document is not a valid ZIP package") from exc
        if "[Content_Types].xml" not in names or OOXML_REQUIRED_PARTS[ext] not in names:
            raise DocumentProcessingError("Office document structure mismatch")
        return

    if ext in ODF_MIMES:
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                mimetype = archive.read("mimetype")
        except (zipfile.BadZipFile, KeyError) as exc:
            raise DocumentProcessingError("OpenDocument structure mismatch") from exc
        if mimetype.strip() != ODF_MIMES[ext]:
            raise DocumentProcessingError("OpenDocument type mismatch")


def scan_document_with_clamav(content: bytes) -> None:
    host = os.getenv("CLAMAV_HOST", "127.0.0.1")
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    timeout = float(os.getenv("CLAMAV_TIMEOUT_SECONDS", "20"))

    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(b"zINSTREAM\0")
            for offset in range(0, len(content), READ_CHUNK_SIZE):
                chunk = content[offset:offset + READ_CHUNK_SIZE]
                sock.sendall(struct.pack(">I", len(chunk)) + chunk)
            sock.sendall(struct.pack(">I", 0))
            response = sock.recv(4096).decode("utf-8", errors="replace")
    except OSError as exc:
        raise DocumentProcessingError("Antivirus scanner is unavailable") from exc

    clean_response = response.strip().rstrip("\0")
    if not clean_response.endswith(": OK"):
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
    local_binary = os.getenv("LIBREOFFICE_BIN") or shutil.which("libreoffice") or shutil.which("soffice")
    if not local_binary:
        local_binary = next((str(path) for path in WINDOWS_LIBREOFFICE_PATHS if path.exists()), "")

    if local_binary:
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
                subprocess.run(command, check=True, timeout=60, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            except (subprocess.SubprocessError, FileNotFoundError):
                return "failed"

        return "ready" if finalize_generated_pdf() else "failed"

    docker_binary = shutil.which("docker")
    if not docker_binary:
        return "failed"

    try:
        original_rel = original_path.resolve().relative_to(PRIVATE_DOCUMENTS_ROOT)
        output_rel = output_dir.resolve().relative_to(PRIVATE_DOCUMENTS_ROOT)
    except ValueError:
        return "failed"

    with tempfile.TemporaryDirectory(prefix="doc_preview_") as user_install_dir:
        user_install_path = Path(user_install_dir)
        command = [
            docker_binary,
            "run",
            "--rm",
            "-v",
            f"{PRIVATE_DOCUMENTS_ROOT}:/docs",
            "-v",
            f"{user_install_path}:/tmp/lo-profile",
            os.getenv("LIBREOFFICE_DOCKER_IMAGE", "campusapp-backend"),
            "libreoffice",
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--norestore",
            "-env:UserInstallation=file:///tmp/lo-profile",
            "--convert-to",
            "pdf",
            "--outdir",
            f"/docs/{output_rel.as_posix()}",
            f"/docs/{original_rel.as_posix()}",
        ]
        try:
            subprocess.run(command, check=True, timeout=90, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except (subprocess.SubprocessError, FileNotFoundError):
            return "failed"

    return "ready" if finalize_generated_pdf() else "failed"


async def process_uploaded_documents(files: List[UploadFile]) -> List[dict]:
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

            content = await read_document_content_limited(file)
            validate_document_content(content, ext)
            await run_in_threadpool(scan_document_with_clamav, content)

            stored_rel, stored_abs, preview_rel, preview_abs = make_private_document_paths(ext)
            tmp_path = stored_abs.with_name(f".tmp_{stored_abs.name}")
            tmp_path.write_bytes(content)
            os.replace(tmp_path, stored_abs)

            preview_status = await run_in_threadpool(convert_document_preview, stored_abs, preview_abs, ext)
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
                "size_bytes": len(content),
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
