# ===== 📄 ФАЙЛ: backend/app/routers/ads.py =====

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth_service import require_user
from app import crud, schemas, models
from app.time_utils import normalize_datetime_payload, to_iso_z

router = APIRouter(prefix="/ads", tags=["ads"])


# ========================================
# CRUD — создание / список / обновление / удаление
# ========================================


@router.post("/create", response_model=schemas.AdPostResponse)
def create_ad(
    ad_data: schemas.AdPostCreate,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Создать рекламный пост.
    Амбассадор/суперадмин. Амбассадор → pending_review, суперадмин → active.
    """
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(403, "Только амбассадоры и админы могут создавать рекламу")
    
    db_ad = crud.create_ad_post(
        db=db,
        ad_data=ad_data,
        creator_id=user.id,
        creator_role=user.role,
        creator_university=user.university,
    )
    return _ad_to_response(db_ad)


@router.get("/list", response_model=schemas.AdPostFeedResponse)
def list_ads(
    status: str = Query(None),
    scope: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Список рекламных постов (для админки / амбассадора).
    Амбассадор видит только свои, суперадмин — все.
    """
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(403, "Нет доступа")
    
    creator_id = user.id if user.role == 'ambassador' else None
    
    result = crud.get_ad_posts(
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
def get_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Получить рекламный пост по ID"""
    db_ad = crud.get_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Рекламный пост не найден")
    
    # Амбассадор видит только свои
    if user.role == 'ambassador' and db_ad.created_by != user.id:
        raise HTTPException(403, "Нет доступа")
    
    return _ad_to_response(db_ad)


@router.patch("/{ad_id}", response_model=schemas.AdPostResponse)
def update_ad(
    ad_id: int,
    update_data: schemas.AdPostUpdate,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Обновить рекламный пост (автор или суперадмин)"""
    db_ad = crud.get_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Рекламный пост не найден")
    
    if user.role != 'superadmin' and db_ad.created_by != user.id:
        raise HTTPException(403, "Нет доступа")
    
    # Нельзя редактировать после одобрения (кроме суперадмина)
    if db_ad.status in ('active', 'completed') and user.role != 'superadmin':
        raise HTTPException(400, "Нельзя редактировать активный рекламный пост")
    
    updated = crud.update_ad_post(db, ad_id, update_data)
    return _ad_to_response(updated)


@router.delete("/{ad_id}")
def delete_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Удалить рекламный пост (автор или суперадмин)"""
    db_ad = crud.get_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Рекламный пост не найден")
    
    if user.role != 'superadmin' and db_ad.created_by != user.id:
        raise HTTPException(403, "Нет доступа")
    
    crud.delete_ad_post(db, ad_id)
    return {"success": True}


# ========================================
# МОДЕРАЦИЯ — одобрение / отклонение / пауза
# ========================================


@router.post("/{ad_id}/approve", response_model=schemas.AdPostResponse)
def approve_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Одобрить рекламный пост (только суперадмин)"""
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин может одобрять рекламу")
    
    db_ad = crud.approve_ad_post(db, ad_id, user.id)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или уже обработан")
    
    return _ad_to_response(db_ad)


@router.post("/{ad_id}/reject", response_model=schemas.AdPostResponse)
def reject_ad(
    ad_id: int,
    action: schemas.AdReviewAction,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Отклонить рекламный пост (только суперадмин)"""
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин может отклонять рекламу")
    
    db_ad = crud.reject_ad_post(db, ad_id, user.id, action.reject_reason)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или уже обработан")
    
    return _ad_to_response(db_ad)


@router.post("/{ad_id}/pause", response_model=schemas.AdPostResponse)
def pause_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Поставить на паузу (суперадмин)"""
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин")
    
    db_ad = crud.pause_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или не активен")
    return _ad_to_response(db_ad)


@router.post("/{ad_id}/resume", response_model=schemas.AdPostResponse)
def resume_ad(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Снять с паузы (суперадмин)"""
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин")
    
    db_ad = crud.resume_ad_post(db, ad_id)
    if not db_ad:
        raise HTTPException(404, "Пост не найден или не на паузе")
    return _ad_to_response(db_ad)


# ========================================
# ЛЕНТА — получение рекламы для подмешивания
# ========================================


@router.get("/feed/active")
def get_ads_for_feed(
    limit: int = Query(3, ge=1, le=10),
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Получить рекламные посты для подмешивания в ленту.
    Фронт вызывает при загрузке ленты, потом вставляет каждый N-й.
    """
    
    ads = crud.get_active_ads_for_user(
        db=db,
        user_university=user.university,
        user_city=None,  # TODO: добавить city в User если нужно
        limit=limit,
        exclude_seen_by_user_id=user.id,
    )
    
    result = []
    for ad in ads:
        post = ad.post
        import json
        images_raw = json.loads(post.images) if post.images else []
        
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
# ТРЕКИНГ — показы и клики
# ========================================


@router.post("/{ad_id}/impression")
def track_impression(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Зафиксировать показ рекламного поста в ленте"""
    success = crud.track_ad_impression(db, ad_id, user.id)
    return {"tracked": success}


@router.post("/{ad_id}/click")
def track_click(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Зафиксировать клик по CTA"""
    success = crud.track_ad_click(db, ad_id, user.id)
    return {"tracked": success}


# ========================================
# СТАТИСТИКА
# ========================================


@router.get("/{ad_id}/stats", response_model=schemas.AdStatsResponse)
def get_stats(
    ad_id: int,
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Детальная статистика по рекламному посту"""
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(403, "Нет доступа")
    
    # Амбассадор видит только статистику своих постов
    if user.role == 'ambassador':
        db_ad = crud.get_ad_post(db, ad_id)
        if not db_ad or db_ad.created_by != user.id:
            raise HTTPException(403, "Нет доступа")
    
    stats = crud.get_ad_stats(db, ad_id)
    if not stats:
        raise HTTPException(404, "Рекламный пост не найден")
    return stats


@router.get("/stats/overview", response_model=schemas.AdOverviewStats)
def get_overview_stats(
    user: models.User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Сводная статистика рекламной системы (суперадмин)"""
    if user.role != 'superadmin':
        raise HTTPException(403, "Только суперадмин")
    return crud.get_ad_overview_stats(db)


# ========================================
# HELPER
# ========================================


def _ad_to_response(db_ad: models.AdPost) -> dict:
    """Конвертация модели AdPost в response dict"""
    import json
    
    post = db_ad.post
    images_raw = []
    if post and post.images:
        try:
            images_raw = json.loads(post.images)
        except:
            images_raw = []
    
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