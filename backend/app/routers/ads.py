# ===== 📄 ФАЙЛ: backend/app/routers/ads.py =====
#
# ✅ Фаза 3.8: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession

from fastapi import APIRouter, Depends, HTTPException, Query, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.auth_service import require_user
from app import crud, schemas, models
from app.config import get_settings
from app.time_utils import normalize_datetime_payload, to_iso_z
from app.services.analytics_service import record_server_event
from app.utils import process_uploaded_files, delete_images, get_image_urls

router = APIRouter(prefix="/ads", tags=["ads"])


# ========================================
# CRUD — создание / список / обновление / удаление
# ========================================


@router.post("/create", response_model=schemas.AdPostResponse)
async def create_ad(
    title: str = Form(...),
    body: str = Form(...),
    advertiser_name: str = Form(...),
    scope: str = Form(default='university'),
    cta_text: str = Form(...),
    cta_url: str = Form(...),
    impression_limit: int = Form(...),
    priority: int = Form(default=5),
    ends_at: Optional[str] = Form(None),
    target_university: Optional[str] = Form(None),
    target_city: Optional[str] = Form(None),
    daily_impression_cap: Optional[int] = Form(None),
    images: List[UploadFile] = File(default=[]),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(403, "Только амбассадоры и админы могут создавать рекламу")

    valid_images = [img for img in (images or []) if img.filename and len(img.filename) > 0]
    if len(valid_images) > 3:
        raise HTTPException(400, "Максимум 3 изображения")

    images_meta: List[dict] = []
    try:
        if valid_images:
            images_meta = await process_uploaded_files(valid_images)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    ends_at_dt: Optional[datetime] = None
    if ends_at:
        try:
            parsed = datetime.fromisoformat(ends_at.replace('Z', '+00:00'))
            # Колонка TIMESTAMP WITHOUT TIME ZONE — убираем tzinfo, оставляем UTC
            ends_at_dt = parsed.replace(tzinfo=None)
        except ValueError:
            delete_images(images_meta)
            raise HTTPException(400, "Неверный формат даты ends_at")

    try:
        ad_data = schemas.AdPostCreate(
            title=title,
            body=body,
            advertiser_name=advertiser_name,
            scope=scope,
            cta_text=cta_text,
            cta_url=cta_url,
            impression_limit=impression_limit,
            priority=priority,
            ends_at=ends_at_dt,
            target_university=target_university,
            target_city=target_city,
            daily_impression_cap=daily_impression_cap,
        )
    except Exception as exc:
        delete_images(images_meta)
        raise HTTPException(422, str(exc))

    try:
        db_ad = await crud.create_ad_post(
            db=db,
            ad_data=ad_data,
            creator_id=user.id,
            creator_role=user.role,
            creator_university=user.university,
            images_meta=images_meta,
        )
    except Exception as exc:
        delete_images(images_meta)
        raise HTTPException(500, f"Ошибка создания: {str(exc)}")

    return _ad_to_response(db_ad)


@router.get("/list", response_model=schemas.AdPostFeedResponse)
async def list_ads(
    status: str = Query(None),
    scope: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(403, "Нет доступа")

    creator_id = user.id if user.role == 'ambassador' else None

    result = await crud.get_ad_posts(
        db=db,
        status=status,
        scope=scope,
        creator_id=creator_id,
        skip=offset,
        limit=limit,
    )

    return {
        'items': [_ad_to_response(ad) for ad in result['items']],
        'total': result['total'],
        'has_more': result['has_more'],
    }


@router.get("/{ad_id}", response_model=schemas.AdPostResponse)
async def get_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    db_ad = await crud.get_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Рекламный пост не найден")

    if user.role == 'ambassador' and db_ad.created_by != user.id:
        raise HTTPException(403, "Нет доступа")

    return _ad_to_response(db_ad)


@router.patch("/{ad_id}", response_model=schemas.AdPostResponse)
async def update_ad(
    ad_id: int,
    update_data: schemas.AdPostUpdate,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    db_ad = await crud.get_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Рекламный пост не найден")

    if user.role != 'superadmin' and db_ad.created_by != user.id:
        raise HTTPException(403, "Нет доступа")

    if db_ad.status in ('active', 'completed') and user.role != 'superadmin':
        raise HTTPException(400, "Нельзя редактировать активный рекламный пост")

    updated = await crud.update_ad_post(db, ad_id, update_data)
    return _ad_to_response(updated)


@router.delete("/{ad_id}")
async def delete_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    db_ad = await crud.get_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Рекламный пост не найден")

    if user.role != 'superadmin' and db_ad.created_by != user.id:
        raise HTTPException(403, "Нет доступа")

    await crud.delete_ad_post(db, ad_id)
    return {"success": True}


# ========================================
# МОДЕРАЦИЯ
# ========================================


@router.post("/{ad_id}/approve", response_model=schemas.AdPostResponse)
async def approve_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин может одобрять рекламу")

    db_ad = await crud.approve_ad_post(db, ad_id, user.id)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или уже обработан")

    return _ad_to_response(db_ad)


@router.post("/{ad_id}/reject", response_model=schemas.AdPostResponse)
async def reject_ad(
    ad_id: int,
    action: schemas.AdReviewAction,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин может отклонять рекламу")

    db_ad = await crud.reject_ad_post(db, ad_id, user.id, action.reject_reason)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или уже обработан")

    return _ad_to_response(db_ad)


@router.post("/{ad_id}/pause", response_model=schemas.AdPostResponse)
async def pause_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин")

    db_ad = await crud.pause_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или не активен")
    return _ad_to_response(db_ad)


@router.post("/{ad_id}/resume", response_model=schemas.AdPostResponse)
async def resume_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин")

    db_ad = await crud.resume_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или не на паузе")
    return _ad_to_response(db_ad)


# ========================================
# ЛЕНТА
# ========================================


@router.get("/feed/active")
async def get_ads_for_feed(
    limit: int = Query(3, ge=1, le=10),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    is_dev = get_settings().app_env.lower() == "dev"
    ads = await crud.get_active_ads_for_user(
        db=db,
        user_university=user.university,
        user_city=None,
        limit=limit,
        exclude_seen_by_user_id=None if is_dev else user.id,
        include_all_for_dev=is_dev,
    )

    result = []
    for ad in ads:
        post = ad.post
        images_raw = get_image_urls(post.images) if post and post.images else []

        result.append({
            'ad_id': ad.id,
            'post_id': post.id,
            'title': post.title,
            'body': post.body,
            'images': images_raw,
            'author': {
                'id': post.author.id if post.author else None,
                'name': ad.advertiser_name,
                'avatar': ad.advertiser_logo,
                'university': post.author.university if post.author else None,
            },
            'advertiser_name': ad.advertiser_name,
            'advertiser_logo': ad.advertiser_logo,
            'cta_text': ad.cta_text,
            'cta_url': ad.cta_url,
            'is_ad': True,
            'created_at': to_iso_z(post.created_at),
            'likes_count': post.likes_count,
            'comments_count': post.comments_count,
            'views_count': post.views_count,
        })

    return normalize_datetime_payload(result)


# ========================================
# ТРЕКИНГ
# ========================================


@router.post("/{ad_id}/impression")
async def track_impression(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    success = await crud.track_ad_impression(db, ad_id, user.id)
    if success:
        await record_server_event(
            db,
            user.id,
            "ad_impression",
            entity_type="ad",
            entity_id=ad_id,
        )
    return {"tracked": success}


@router.post("/{ad_id}/click")
async def track_click(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    success = await crud.track_ad_click(db, ad_id, user.id)
    if success:
        await record_server_event(
            db,
            user.id,
            "ad_click",
            entity_type="ad",
            entity_id=ad_id,
        )
    return {"tracked": success}


@router.post("/{ad_id}/hide")
async def hide_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Скрыть рекламное объявление для текущего пользователя."""
    await crud.hide_ad(db, ad_id, user.id)
    return {"hidden": True}


@router.delete("/{ad_id}/hide")
async def unhide_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Отменить скрытие рекламного объявления."""
    await crud.unhide_ad(db, ad_id, user.id)
    return {"hidden": False}


# ========================================
# СТАТИСТИКА
# ========================================


@router.get("/{ad_id}/stats", response_model=schemas.AdStatsResponse)
async def get_stats(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(403, "Нет доступа")

    if user.role == 'ambassador':
        db_ad = await crud.get_ad_post(db, ad_id)
        if not db_ad or db_ad.created_by != user.id:
            raise HTTPException(403, "Нет доступа")

    stats = await crud.get_ad_stats(db, ad_id)
    if not stats:
        raise HTTPException(404, "Рекламный пост не найден")
    return stats


@router.get("/stats/overview", response_model=schemas.AdOverviewStats)
async def get_overview_stats(
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин")
    return await crud.get_ad_overview_stats(db)


# ========================================
# HELPER
# ========================================


def _ad_to_response(db_ad: models.AdPost) -> dict:
    post = db_ad.post
    images_raw = get_image_urls(post.images) if post and post.images else []

    creator = db_ad.creator
    creator_short = None
    if creator:
        creator_short = {
            'id': creator.id,
            'telegram_id': creator.telegram_id,
            'name': creator.name,
            'username': creator.username,
            'avatar': creator.avatar,
            'university': creator.university,
            'institute': creator.institute,
            'role': creator.role,
        }

    return normalize_datetime_payload({
        'id': db_ad.id,
        'post_id': db_ad.post_id,
        'created_by': db_ad.created_by,
        'creator': creator_short,
        'advertiser_name': db_ad.advertiser_name,
        'advertiser_logo': db_ad.advertiser_logo,
        'scope': db_ad.scope,
        'target_university': db_ad.target_university,
        'target_city': db_ad.target_city,
        'starts_at': db_ad.starts_at,
        'ends_at': db_ad.ends_at,
        'impression_limit': db_ad.impression_limit,
        'daily_impression_cap': db_ad.daily_impression_cap,
        'status': db_ad.status,
        'reviewed_by': db_ad.reviewed_by,
        'reviewed_at': db_ad.reviewed_at,
        'reject_reason': db_ad.reject_reason,
        'priority': db_ad.priority,
        'cta_text': db_ad.cta_text,
        'cta_url': db_ad.cta_url,
        'impressions_count': db_ad.impressions_count,
        'unique_views_count': db_ad.unique_views_count,
        'clicks_count': db_ad.clicks_count,
        'created_at': db_ad.created_at,
        'updated_at': db_ad.updated_at,
        'post_title': post.title if post else None,
        'post_body': post.body if post else None,
        'post_images': images_raw,
    })
