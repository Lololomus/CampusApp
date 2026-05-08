import json
import logging
import time
from pathlib import Path
from typing import List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.document_utils import (
    DOCUMENT_PREVIEWS_ROOT,
    DOCUMENTS_ROOT,
    delete_document_files,
    resolve_document_path,
)
from app.utils import (
    UPLOADS_ROOT,
    _extract_upload_parts,
    delete_all_media,
    delete_images,
)

logger = logging.getLogger(__name__)


def _jsonb_to_upload_refs(value) -> List[Tuple[str, str]]:
    """Extracts upload references as (path, default_kind) pairs."""
    refs: List[Tuple[str, str]] = []
    if not value:
        return refs
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except Exception:
            return refs
    if not isinstance(value, list):
        return refs
    for item in value:
        if isinstance(item, str):
            refs.append((item, "images"))
        elif isinstance(item, dict):
            default_kind = "videos" if item.get("type") == "video" else "images"
            if item.get("url"):
                refs.append((item["url"], default_kind))
            if item.get("thumbnail_url"):
                refs.append((item["thumbnail_url"], "thumbs"))
    return [(path, kind) for path, kind in refs if path]


def _resolve_upload_path(raw_url: str, default_kind: str = "images") -> Optional[Path]:
    parsed = _extract_upload_parts(raw_url, default_kind=default_kind)
    if not parsed:
        return None
    kind, rel_path = parsed
    base = (UPLOADS_ROOT / kind).resolve()
    target = (base / rel_path).resolve()
    if base not in target.parents and target != base:
        return None
    return target


async def collect_referenced_upload_paths(db: AsyncSession) -> Set[Path]:
    """Собирает абсолютные пути всех файлов в uploads/, на которые есть ссылки в БД."""
    referenced: Set[Path] = set()

    # User avatars
    result = await db.execute(
        select(models.User.avatar).where(models.User.avatar.is_not(None))
    )
    for (avatar,) in result.all():
        path = _resolve_upload_path(avatar, default_kind="avatars")
        if path:
            referenced.add(path)

    # Post images (включая видео и их превью)
    result = await db.execute(select(models.Post.images))
    for (images,) in result.all():
        for url, default_kind in _jsonb_to_upload_refs(images):
            path = _resolve_upload_path(url, default_kind=default_kind)
            if path:
                referenced.add(path)

    # Comment images
    result = await db.execute(select(models.Comment.images))
    for (images,) in result.all():
        for url, default_kind in _jsonb_to_upload_refs(images):
            path = _resolve_upload_path(url, default_kind=default_kind)
            if path:
                referenced.add(path)

    # Request images
    result = await db.execute(select(models.Request.images))
    for (images,) in result.all():
        for url, default_kind in _jsonb_to_upload_refs(images):
            path = _resolve_upload_path(url, default_kind=default_kind)
            if path:
                referenced.add(path)

    # MarketItem images
    result = await db.execute(select(models.MarketItem.images))
    for (images,) in result.all():
        for url, default_kind in _jsonb_to_upload_refs(images):
            path = _resolve_upload_path(url, default_kind=default_kind)
            if path:
                referenced.add(path)

    # DatingProfile photos
    result = await db.execute(select(models.DatingProfile.photos))
    for (photos,) in result.all():
        for url, default_kind in _jsonb_to_upload_refs(photos):
            path = _resolve_upload_path(url, default_kind=default_kind)
            if path:
                referenced.add(path)

    return referenced


async def collect_referenced_document_paths(db: AsyncSession) -> Set[Path]:
    """Собирает абсолютные пути всех файлов в private_documents/, на которые есть ссылки в БД."""
    referenced: Set[Path] = set()
    result = await db.execute(
        select(
            models.PostDocument.stored_path,
            models.PostDocument.preview_pdf_path,
        )
    )
    for stored_path, preview_path in result.all():
        if stored_path:
            path = resolve_document_path(stored_path, preview=False)
            if path:
                referenced.add(path)
        if preview_path:
            path = resolve_document_path(preview_path, preview=True)
            if path:
                referenced.add(path)
    return referenced


def scan_directory_for_orphans(
    directory: Path, referenced: Set[Path], min_age_seconds: int = 0
) -> List[Path]:
    """Рекурсивно сканирует директорию и возвращает файлы без ссылок в БД."""
    orphans: List[Path] = []
    if not directory.exists():
        return orphans
    cutoff = time.time() - max(0, min_age_seconds)
    for path in directory.rglob("*"):
        if path.is_file():
            resolved = path.resolve()
            if resolved in referenced:
                continue
            try:
                if path.stat().st_mtime > cutoff:
                    continue
            except OSError:
                continue
            orphans.append(resolved)
    return orphans


async def run_cleanup(
    db: AsyncSession,
    dry_run: bool = True,
    min_age_hours: int = 24,
) -> dict:
    """
    Запускает сбор orphaned-файлов и (опционально) их удаление.
    Возвращает статистику.
    """
    stats = {
        "dry_run": dry_run,
        "min_age_hours": min_age_hours,
        "upload_referenced": 0,
        "upload_orphaned": 0,
        "upload_deleted": 0,
        "upload_bytes_freed": 0,
        "document_referenced": 0,
        "document_orphaned": 0,
        "document_deleted": 0,
        "document_bytes_freed": 0,
        "errors": [],
    }

    # 1. Собираем все пути, на которые есть ссылки
    upload_refs = await collect_referenced_upload_paths(db)
    stats["upload_referenced"] = len(upload_refs)

    doc_refs = await collect_referenced_document_paths(db)
    stats["document_referenced"] = len(doc_refs)

    # 2. Сканируем uploads/
    upload_orphans: List[Path] = []
    for kind in ("images", "avatars", "videos", "thumbs"):
        kind_dir = (UPLOADS_ROOT / kind).resolve()
        if kind_dir.exists():
            upload_orphans.extend(
                scan_directory_for_orphans(
                    kind_dir,
                    upload_refs,
                    min_age_seconds=min_age_hours * 60 * 60,
                )
            )

    stats["upload_orphaned"] = len(upload_orphans)

    # 3. Сканируем private_documents/
    doc_orphans: List[Path] = []
    for doc_dir in (DOCUMENTS_ROOT, DOCUMENT_PREVIEWS_ROOT):
        resolved_dir = doc_dir.resolve()
        if resolved_dir.exists():
            doc_orphans.extend(
                scan_directory_for_orphans(
                    resolved_dir,
                    doc_refs,
                    min_age_seconds=min_age_hours * 60 * 60,
                )
            )

    stats["document_orphaned"] = len(doc_orphans)

    # 4. Удаляем, если не dry-run
    if not dry_run:
        for path in upload_orphans:
            try:
                size = path.stat().st_size
                path.unlink()
                stats["upload_deleted"] += 1
                stats["upload_bytes_freed"] += size
            except OSError as e:
                logger.warning("Failed to delete orphaned upload %s: %s", path, e)
                stats["errors"].append(str(path))

        for path in doc_orphans:
            try:
                size = path.stat().st_size
                path.unlink()
                stats["document_deleted"] += 1
                stats["document_bytes_freed"] += size
            except OSError as e:
                logger.warning("Failed to delete orphaned document %s: %s", path, e)
                stats["errors"].append(str(path))

    return stats


async def delete_entity_media(entity, entity_type: str) -> None:
    """
    Удаляет файлы сущности при hard- или soft-delete.
    Безопасная обёртка: ошибки логируются, не пробрасываются.
    """
    try:
        if entity_type == "post":
            if entity.images:
                delete_all_media(entity.images)
            if getattr(entity, "documents", None):
                delete_document_files(
                    [
                        {
                            "stored_path": doc.stored_path,
                            "preview_pdf_path": doc.preview_pdf_path,
                        }
                        for doc in entity.documents
                    ]
                )
        elif entity_type == "comment":
            if entity.images:
                delete_images(entity.images, default_kind="images")
        elif entity_type == "request":
            if entity.images:
                delete_images(entity.images, default_kind="images")
        elif entity_type == "market_item":
            if entity.images:
                delete_all_media(entity.images)
        elif entity_type == "dating_profile":
            if entity.photos:
                delete_images(entity.photos, default_kind="images")
        elif entity_type == "user":
            if entity.avatar:
                delete_images([entity.avatar], default_kind="avatars")
    except Exception:
        logger.exception("Failed to delete media for %s id=%s", entity_type, getattr(entity, "id", None))
