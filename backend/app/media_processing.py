import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app import models
from app.crud.helpers import sanitize_json_field
from app.document_utils import (
    ALLOWED_DOCUMENTS,
    DOCUMENT_PREVIEWS_ROOT,
    DOCUMENT_TMP_ROOT,
    DocumentProcessingError,
    convert_document_preview,
    make_private_document_paths,
    sanitize_original_filename,
    scan_document_with_clamav,
    validate_document_file,
)
from app.utils import READ_CHUNK_SIZE
from app.video_utils import MAX_VIDEO_FILE_SIZE, process_video_file_sync


logger = logging.getLogger(__name__)

JOB_PENDING = "pending"
JOB_PROCESSING = "processing"
JOB_READY = "ready"
JOB_FAILED = "failed"

KIND_VIDEO = "video"
KIND_DOCUMENT = "document"

MEDIA_JOBS_ROOT = Path(os.getenv("MEDIA_JOBS_DIR", str(DOCUMENT_TMP_ROOT / "media_jobs"))).resolve()
MEDIA_JOBS_ROOT.mkdir(parents=True, exist_ok=True)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}


def _safe_suffix(filename: str, allowed: Iterable[str], fallback: str = ".bin") -> str:
    ext = Path(filename or "").suffix.lower()
    return ext if ext in set(allowed) else fallback


def resolve_job_source_path(relative_path: str) -> Optional[Path]:
    raw = str(relative_path or "").replace("\\", "/")
    if raw.startswith("/") or Path(raw).is_absolute() or (len(raw) >= 2 and raw[1] == ":"):
        return None
    clean = raw.lstrip("/")
    if not clean:
        return None
    candidate = (MEDIA_JOBS_ROOT / clean).resolve()
    if MEDIA_JOBS_ROOT not in candidate.parents and candidate != MEDIA_JOBS_ROOT:
        return None
    return candidate


async def save_upload_for_job(
    file: UploadFile,
    *,
    max_size: int,
    suffix: str,
    request_id: str = "-",
) -> tuple[str, int]:
    MEDIA_JOBS_ROOT.mkdir(parents=True, exist_ok=True)
    rel_dir = datetime.utcnow().strftime("%Y/%m")
    target_dir = MEDIA_JOBS_ROOT / rel_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_name = tempfile.mkstemp(prefix="upload_", suffix=suffix, dir=str(target_dir))
    tmp_path = Path(tmp_name)
    total_size = 0
    try:
        with os.fdopen(tmp_fd, "wb") as fp:
            while True:
                chunk = await file.read(READ_CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_size:
                    raise ValueError(f"File {file.filename} is too large")
                fp.write(chunk)
        if total_size <= 0:
            raise ValueError("File is empty")
        final_name = f"{uuid.uuid4().hex}{suffix}"
        final_path = target_dir / final_name
        os.replace(tmp_path, final_path)
        logger.info(
            "media_job stage=upload_read request_id=%s file=%s bytes=%s",
            request_id,
            file.filename,
            total_size,
        )
        return f"{rel_dir}/{final_name}", total_size
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


async def stage_video_upload(file: UploadFile, *, request_id: str = "-") -> tuple[str, int]:
    suffix = _safe_suffix(file.filename or "", VIDEO_EXTENSIONS, ".video")
    return await save_upload_for_job(
        file,
        max_size=MAX_VIDEO_FILE_SIZE,
        suffix=suffix,
        request_id=request_id,
    )


async def stage_document_upload(file: UploadFile, *, request_id: str = "-") -> dict:
    original_filename = sanitize_original_filename(file.filename or "document")
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_DOCUMENTS:
        await file.close()
        raise DocumentProcessingError("Unsupported document type")
    source_path, size_bytes = await save_upload_for_job(
        file,
        max_size=int(os.getenv("MAX_DOCUMENT_SIZE_BYTES", str(25 * 1024 * 1024))),
        suffix=ext,
        request_id=request_id,
    )
    return {
        "source_path": source_path,
        "original_filename": original_filename,
        "file_ext": ext.lstrip("."),
        "mime_type": ALLOWED_DOCUMENTS[ext]["mime"],
        "size_bytes": size_bytes,
    }


async def create_media_job(
    db: AsyncSession,
    *,
    post_id: int,
    kind: str,
    source_path: str,
    document_id: Optional[int] = None,
) -> models.MediaProcessingJob:
    job = models.MediaProcessingJob(
        post_id=post_id,
        document_id=document_id,
        kind=kind,
        status=JOB_PENDING,
        source_path=source_path,
    )
    db.add(job)
    await db.flush()
    return job


def video_processing_placeholder(job_id: Optional[int] = None, status: str = JOB_PENDING) -> dict:
    payload = {
        "type": "video",
        "processing_status": status,
        "url": "",
        "w": 16,
        "h": 9,
    }
    if job_id is not None:
        payload["job_id"] = job_id
    return payload


def replace_video_job_payload(images: list, job_id: int, payload: dict) -> list:
    replaced = False
    result = []
    for item in images or []:
        if (
            isinstance(item, dict)
            and item.get("type") == KIND_VIDEO
            and (item.get("job_id") == job_id or (item.get("processing_status") and not replaced))
        ):
            result.append(payload)
            replaced = True
        else:
            result.append(item)
    if not replaced:
        result.append(payload)
    return result


async def mark_job_failed(db: AsyncSession, job_id: int, error_code: str) -> None:
    job = await db.get(models.MediaProcessingJob, job_id)
    if not job:
        return
    job.status = JOB_FAILED
    job.error_code = error_code[:100]
    job.finished_at = datetime.utcnow()
    if job.kind == KIND_VIDEO:
        post = await db.get(models.Post, job.post_id)
        if post:
            failed_payload = video_processing_placeholder(job.id, JOB_FAILED)
            failed_payload["error_code"] = job.error_code
            post.images = sanitize_json_field(replace_video_job_payload(post.images or [], job.id, failed_payload))
    elif job.kind == KIND_DOCUMENT and job.document_id:
        document = await db.get(models.PostDocument, job.document_id)
        if document:
            document.scan_status = "failed"
            document.preview_status = "failed"
    await db.commit()


async def process_video_job(db: AsyncSession, job: models.MediaProcessingJob) -> None:
    source = resolve_job_source_path(job.source_path)
    if not source or not source.exists():
        raise ValueError("source_missing")
    meta = await run_in_threadpool(process_video_file_sync, source, request_id=f"job-{job.id}")
    meta["processing_status"] = JOB_READY
    meta["job_id"] = job.id
    post = await db.get(models.Post, job.post_id)
    if not post:
        raise ValueError("post_missing")
    post.images = sanitize_json_field(replace_video_job_payload(post.images or [], job.id, meta))
    job.result_payload = meta
    job.status = JOB_READY
    job.finished_at = datetime.utcnow()
    await db.commit()
    source.unlink(missing_ok=True)


async def process_document_job(db: AsyncSession, job: models.MediaProcessingJob) -> None:
    if not job.document_id:
        raise ValueError("document_missing")
    document = await db.get(models.PostDocument, job.document_id)
    if not document:
        raise ValueError("document_missing")
    source = resolve_job_source_path(job.source_path)
    if not source or not source.exists():
        raise ValueError("source_missing")

    ext = f".{document.file_ext.lower().lstrip('.')}"
    logger.info("document stage=validate request_id=job-%s file=%s", job.id, document.original_filename)
    await run_in_threadpool(validate_document_file, source, ext)
    logger.info("document stage=clamav request_id=job-%s file=%s", job.id, document.original_filename)
    await scan_document_with_clamav(source, user_id=document.uploader_id, filename=document.original_filename)

    stored_rel, stored_abs, preview_rel, preview_abs = make_private_document_paths(ext)
    os.replace(source, stored_abs)
    document.stored_path = stored_rel
    document.scan_status = "clean"

    logger.info("document stage=preview request_id=job-%s file=%s", job.id, document.original_filename)
    preview_status = await run_in_threadpool(convert_document_preview, stored_abs, preview_abs, ext)
    if preview_status == "ready":
        document.preview_pdf_path = preview_rel
    else:
        document.preview_pdf_path = None
        if preview_abs.exists():
            preview_abs.unlink(missing_ok=True)
    document.preview_status = preview_status

    job.result_payload = {
        "document_id": document.id,
        "scan_status": document.scan_status,
        "preview_status": document.preview_status,
    }
    job.status = JOB_READY
    job.finished_at = datetime.utcnow()
    await db.commit()


async def claim_next_job(db: AsyncSession) -> Optional[models.MediaProcessingJob]:
    async with db.begin():
        result = await db.execute(
            select(models.MediaProcessingJob)
            .where(models.MediaProcessingJob.status == JOB_PENDING)
            .order_by(models.MediaProcessingJob.created_at.asc(), models.MediaProcessingJob.id.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if not job:
            return None
        job.status = JOB_PROCESSING
        job.attempts = (job.attempts or 0) + 1
        job.started_at = datetime.utcnow()
        await db.flush()
        return job


async def process_claimed_job(db: AsyncSession, job: models.MediaProcessingJob) -> None:
    job_id = job.id
    job_kind = job.kind
    source_path_raw = job.source_path
    try:
        if job_kind == KIND_VIDEO:
            await process_video_job(db, job)
        elif job_kind == KIND_DOCUMENT:
            await process_document_job(db, job)
        else:
            raise ValueError("unknown_kind")
    except Exception as exc:
        await db.rollback()
        logger.exception("media_job failed id=%s kind=%s", job_id, job_kind)
        source = resolve_job_source_path(source_path_raw)
        if source:
            source.unlink(missing_ok=True)
        await mark_job_failed(db, job_id, str(exc) or exc.__class__.__name__)


async def run_worker_loop(session_factory, *, poll_seconds: float = 2.0) -> None:
    logger.info("media worker started")
    while True:
        async with session_factory() as db:
            job = await claim_next_job(db)
            if job:
                await process_claimed_job(db, job)
                continue
        await asyncio.sleep(poll_seconds)
