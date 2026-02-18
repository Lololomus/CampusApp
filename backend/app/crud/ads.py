# ===== 📄 ФАЙЛ: backend/app/crud/ads.py =====
# Ads CRUD: рекламные посты, показы, клики, статистика

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from app import models, schemas
from app.crud.helpers import sanitize_json_field


# ===== СОЗДАНИЕ И УПРАВЛЕНИЕ =====

def create_ad_post(
    db: Session,
    ad_data: schemas.AdPostCreate,
    creator_id: int,
    creator_role: str,
    creator_university: str
) -> models.AdPost:
    """
    Создать рекламный пост.
    Амбассадор → pending_review, суперадмин → сразу active.
    """
    db_post = models.Post(
        author_id=creator_id,
        category='ad',
        title=ad_data.title,
        body=ad_data.body,
        tags=sanitize_json_field([]),
        images=sanitize_json_field([]),
        is_anonymous=False,
        likes_count=0,
        comments_count=0,
        views_count=0,
    )
    db.add(db_post)
    db.flush()

    initial_status = 'active' if creator_role == 'superadmin' else 'pending_review'
    target_uni = ad_data.target_university or creator_university

    db_ad = models.AdPost(
        post_id=db_post.id,
        created_by=creator_id,
        advertiser_name=ad_data.advertiser_name,
        advertiser_logo=ad_data.advertiser_logo,
        scope=ad_data.scope,
        target_university=target_uni if ad_data.scope in ('university', 'city') else None,
        target_city=ad_data.target_city if ad_data.scope == 'city' else None,
        starts_at=ad_data.starts_at or datetime.now(timezone.utc),
        ends_at=ad_data.ends_at,
        impression_limit=ad_data.impression_limit,
        daily_impression_cap=ad_data.daily_impression_cap,
        status=initial_status,
        priority=ad_data.priority,
        cta_text=ad_data.cta_text,
        cta_url=ad_data.cta_url,
    )
    db.add(db_ad)
    db.commit()
    db.refresh(db_ad)
    return db_ad


def get_ad_posts(
    db: Session,
    status: Optional[str] = None,
    scope: Optional[str] = None,
    creator_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """Получить список рекламных постов с фильтрацией (для админки)"""
    query = db.query(models.AdPost).options(
        joinedload(models.AdPost.creator),
        joinedload(models.AdPost.post),
    )

    if status:
        query = query.filter(models.AdPost.status == status)
    if scope:
        query = query.filter(models.AdPost.scope == scope)
    if creator_id:
        query = query.filter(models.AdPost.created_by == creator_id)

    total = query.count()
    items = query.order_by(models.AdPost.created_at.desc()).offset(skip).limit(limit).all()

    return {
        'items': items,
        'total': total,
        'has_more': skip + limit < total,
    }


def get_ad_post(db: Session, ad_id: int) -> Optional[models.AdPost]:
    """Получить рекламный пост по ID"""
    return db.query(models.AdPost).options(
        joinedload(models.AdPost.creator),
        joinedload(models.AdPost.post),
    ).filter(models.AdPost.id == ad_id).first()


def update_ad_post(db: Session, ad_id: int, update_data: schemas.AdPostUpdate) -> Optional[models.AdPost]:
    """Обновить рекламный пост"""
    db_ad = db.query(models.AdPost).filter(models.AdPost.id == ad_id).first()
    if not db_ad:
        return None

    data = update_data.model_dump(exclude_unset=True)

    post_fields = {}
    if 'title' in data:
        post_fields['title'] = data.pop('title')
    if 'body' in data:
        post_fields['body'] = data.pop('body')

    if post_fields:
        post = db.query(models.Post).filter(models.Post.id == db_ad.post_id).first()
        if post:
            for k, v in post_fields.items():
                setattr(post, k, v)

    for key, value in data.items():
        setattr(db_ad, key, value)

    db_ad.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_ad)
    return db_ad


def approve_ad_post(db: Session, ad_id: int, reviewer_id: int) -> Optional[models.AdPost]:
    """Одобрить рекламный пост"""
    db_ad = db.query(models.AdPost).filter(
        models.AdPost.id == ad_id,
        models.AdPost.status == 'pending_review',
    ).first()
    if not db_ad:
        return None

    now = datetime.now(timezone.utc)
    db_ad.reviewed_by = reviewer_id
    db_ad.reviewed_at = now

    if db_ad.starts_at <= now:
        db_ad.status = 'active'
    else:
        db_ad.status = 'approved'

    db.commit()
    db.refresh(db_ad)
    return db_ad


def reject_ad_post(db: Session, ad_id: int, reviewer_id: int, reason: Optional[str] = None) -> Optional[models.AdPost]:
    """Отклонить рекламный пост"""
    db_ad = db.query(models.AdPost).filter(
        models.AdPost.id == ad_id,
        models.AdPost.status == 'pending_review',
    ).first()
    if not db_ad:
        return None

    db_ad.status = 'rejected'
    db_ad.reviewed_by = reviewer_id
    db_ad.reviewed_at = datetime.now(timezone.utc)
    db_ad.reject_reason = reason

    db.commit()
    db.refresh(db_ad)
    return db_ad


def pause_ad_post(db: Session, ad_id: int) -> Optional[models.AdPost]:
    """Поставить на паузу"""
    db_ad = db.query(models.AdPost).filter(
        models.AdPost.id == ad_id,
        models.AdPost.status == 'active',
    ).first()
    if not db_ad:
        return None
    db_ad.status = 'paused'
    db.commit()
    db.refresh(db_ad)
    return db_ad


def resume_ad_post(db: Session, ad_id: int) -> Optional[models.AdPost]:
    """Снять с паузы"""
    db_ad = db.query(models.AdPost).filter(
        models.AdPost.id == ad_id,
        models.AdPost.status == 'paused',
    ).first()
    if not db_ad:
        return None
    db_ad.status = 'active'
    db.commit()
    db.refresh(db_ad)
    return db_ad


def delete_ad_post(db: Session, ad_id: int) -> bool:
    """Удалить рекламный пост вместе с базовым постом"""
    db_ad = db.query(models.AdPost).filter(models.AdPost.id == ad_id).first()
    if not db_ad:
        return False

    db_post = db.query(models.Post).filter(models.Post.id == db_ad.post_id).first()
    if db_post:
        db.delete(db_post)

    db.commit()
    return True


# ===== ПОКАЗЫ И КЛИКИ =====

def get_active_ads_for_user(
    db: Session,
    user_university: str,
    user_city: Optional[str] = None,
    limit: int = 3,
    exclude_seen_by_user_id: Optional[int] = None,
) -> List[models.AdPost]:
    """Выбрать активные рекламные посты для подмешивания в ленту."""
    now = datetime.now(timezone.utc)

    query = db.query(models.AdPost).options(
        joinedload(models.AdPost.post).joinedload(models.Post.author),
    ).filter(
        models.AdPost.status == 'active',
        models.AdPost.starts_at <= now,
        or_(models.AdPost.ends_at == None, models.AdPost.ends_at > now),
        or_(
            models.AdPost.impression_limit == None,
            models.AdPost.impressions_count < models.AdPost.impression_limit,
        ),
    )

    # Фильтр по scope
    scope_filter = [models.AdPost.scope == 'all']
    scope_filter.append(
        models.AdPost.scope == 'university',
    )
    scope_filter[-1] = (
        (models.AdPost.scope == 'university') & (models.AdPost.target_university == user_university)
    )
    if user_city:
        scope_filter.append(
            (models.AdPost.scope == 'city') & (models.AdPost.target_city == user_city)
        )
    query = query.filter(or_(*scope_filter))

    # Дедупликация: не показывать уже виденные сегодня
    if exclude_seen_by_user_id:
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seen_today = db.query(models.AdImpression.ad_post_id).filter(
            models.AdImpression.user_id == exclude_seen_by_user_id,
            models.AdImpression.viewed_at >= today_start,
        ).subquery()
        query = query.filter(~models.AdPost.id.in_(seen_today))

    ads = query.order_by(models.AdPost.priority.desc(), func.random()).limit(limit).all()
    return ads


def track_ad_impression(db: Session, ad_post_id: int, user_id: int) -> bool:
    """Зафиксировать показ рекламного поста"""
    db_ad = db.query(models.AdPost).filter(models.AdPost.id == ad_post_id).first()
    if not db_ad:
        return False

    # Проверяем daily cap
    if db_ad.daily_impression_cap:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = db.query(func.count(models.AdImpression.id)).filter(
            models.AdImpression.ad_post_id == ad_post_id,
            models.AdImpression.viewed_at >= today_start,
        ).scalar()
        if today_count >= db_ad.daily_impression_cap:
            return False

    impression = models.AdImpression(
        ad_post_id=ad_post_id,
        user_id=user_id,
    )
    db.add(impression)

    db_ad.impressions_count += 1

    # Проверяем уникальность
    existing = db.query(models.AdImpression).filter(
        models.AdImpression.ad_post_id == ad_post_id,
        models.AdImpression.user_id == user_id,
    ).count()
    if existing == 0:
        db_ad.unique_views_count += 1

    # Автозавершение при достижении лимита
    if db_ad.impression_limit and db_ad.impressions_count >= db_ad.impression_limit:
        db_ad.status = 'completed'

    db.commit()
    return True


def track_ad_click(db: Session, ad_post_id: int, user_id: int) -> bool:
    """Зафиксировать клик по CTA"""
    db_ad = db.query(models.AdPost).filter(models.AdPost.id == ad_post_id).first()
    if not db_ad:
        return False

    click = models.AdClick(
        ad_post_id=ad_post_id,
        user_id=user_id,
    )
    db.add(click)
    db_ad.clicks_count += 1
    db.commit()
    return True


# ===== СТАТИСТИКА =====

def get_ad_stats(db: Session, ad_id: int) -> Optional[dict]:
    """Детальная статистика по рекламному посту"""
    db_ad = db.query(models.AdPost).filter(models.AdPost.id == ad_id).first()
    if not db_ad:
        return None

    ctr = (db_ad.clicks_count / db_ad.impressions_count * 100) if db_ad.impressions_count > 0 else 0.0

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    impressions_by_day = db.query(
        func.date(models.AdImpression.viewed_at).label('day'),
        func.count(models.AdImpression.id).label('count'),
    ).filter(
        models.AdImpression.ad_post_id == ad_id,
        models.AdImpression.viewed_at >= thirty_days_ago,
    ).group_by(func.date(models.AdImpression.viewed_at)).all()

    clicks_by_day = db.query(
        func.date(models.AdClick.clicked_at).label('day'),
        func.count(models.AdClick.id).label('count'),
    ).filter(
        models.AdClick.ad_post_id == ad_id,
        models.AdClick.clicked_at >= thirty_days_ago,
    ).group_by(func.date(models.AdClick.clicked_at)).all()

    return {
        'ad_post_id': ad_id,
        'impressions_count': db_ad.impressions_count,
        'unique_views_count': db_ad.unique_views_count,
        'clicks_count': db_ad.clicks_count,
        'ctr': round(ctr, 2),
        'impressions_by_day': [{'day': str(row.day), 'count': row.count} for row in impressions_by_day],
        'clicks_by_day': [{'day': str(row.day), 'count': row.count} for row in clicks_by_day],
    }


def get_ad_overview_stats(db: Session) -> dict:
    """Сводная статистика рекламной системы"""
    total_active = db.query(func.count(models.AdPost.id)).filter(models.AdPost.status == 'active').scalar()
    total_pending = db.query(func.count(models.AdPost.id)).filter(models.AdPost.status == 'pending_review').scalar()
    total_impressions = db.query(func.sum(models.AdPost.impressions_count)).scalar() or 0
    total_clicks = db.query(func.sum(models.AdPost.clicks_count)).scalar() or 0
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0

    return {
        'total_active': total_active,
        'total_pending': total_pending,
        'total_impressions': total_impressions,
        'total_clicks': total_clicks,
        'avg_ctr': round(avg_ctr, 2),
    }