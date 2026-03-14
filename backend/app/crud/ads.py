# ===== 📄 ФАЙЛ: backend/app/crud/ads.py =====
# Ads CRUD: рекламные посты, показы, клики, статистика
#
# ✅ Фаза 0.6: Счётчики → SQL expressions (race condition fix)
# ✅ Фаза 3.8: async/await + select() + AsyncSession
# ✅ Фаза 3.8: joinedload → selectinload
# ✅ Фаза 4.3: track_ad_impression → INSERT ON CONFLICT (атомарная дедупликация)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func, or_, update as sa_update
from typing import Optional, List
from datetime import datetime, timedelta

from app import models, schemas
from app.crud.helpers import sanitize_json_field


# ===== СОЗДАНИЕ И УПРАВЛЕНИЕ =====

async def create_ad_post(
    db: AsyncSession,
    ad_data: schemas.AdPostCreate,
    creator_id: int,
    creator_role: str,
    creator_university: str,
    images_meta: Optional[List[dict]] = None,
) -> models.AdPost:
    """Создать рекламный пост."""
    db_post = models.Post(
        author_id=creator_id,
        category='ad',
        title=ad_data.title,
        body=ad_data.body,
        tags=sanitize_json_field([]),
        images=sanitize_json_field(images_meta or []),
        is_anonymous=False,
        likes_count=0,
        comments_count=0,
        views_count=0,
    )
    db.add(db_post)
    await db.flush()

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
        starts_at=ad_data.starts_at or datetime.utcnow(),
        ends_at=ad_data.ends_at,
        impression_limit=ad_data.impression_limit,
        daily_impression_cap=ad_data.daily_impression_cap,
        status=initial_status,
        priority=ad_data.priority,
        cta_text=ad_data.cta_text,
        cta_url=ad_data.cta_url,
    )
    db.add(db_ad)
    await db.commit()
    loaded = await get_ad_post(db, db_ad.id)
    return loaded or db_ad


async def get_ad_posts(
    db: AsyncSession,
    status: Optional[str] = None,
    scope: Optional[str] = None,
    creator_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """Получить список рекламных постов с фильтрацией (для админки)"""
    # Отдельный count-запрос без selectinload (избегаем проблем с subquery + loader options)
    count_query = select(func.count(models.AdPost.id))
    if status:
        count_query = count_query.where(models.AdPost.status == status)
    if scope:
        count_query = count_query.where(models.AdPost.scope == scope)
    if creator_id:
        count_query = count_query.where(models.AdPost.created_by == creator_id)

    total = await db.scalar(count_query)

    data_query = (
        select(models.AdPost)
        .options(
            selectinload(models.AdPost.creator),
            selectinload(models.AdPost.post),
        )
    )
    if status:
        data_query = data_query.where(models.AdPost.status == status)
    if scope:
        data_query = data_query.where(models.AdPost.scope == scope)
    if creator_id:
        data_query = data_query.where(models.AdPost.created_by == creator_id)

    result = await db.execute(
        data_query.order_by(models.AdPost.created_at.desc()).offset(skip).limit(limit)
    )
    items = result.scalars().all()

    return {
        'items': items,
        'total': total or 0,
        'has_more': skip + limit < (total or 0),
    }


async def get_ad_post(db: AsyncSession, ad_id: int) -> Optional[models.AdPost]:
    """Получить рекламный пост по ID"""
    result = await db.execute(
        select(models.AdPost)
        .options(
            selectinload(models.AdPost.creator),
            selectinload(models.AdPost.post),
        )
        .where(models.AdPost.id == ad_id)
    )
    return result.scalar_one_or_none()


async def update_ad_post(db: AsyncSession, ad_id: int, update_data: schemas.AdPostUpdate) -> Optional[models.AdPost]:
    """Обновить рекламный пост"""
    db_ad = await db.get(models.AdPost, ad_id)
    if not db_ad:
        return None

    data = update_data.model_dump(exclude_unset=True)

    post_fields = {}
    if 'title' in data:
        post_fields['title'] = data.pop('title')
    if 'body' in data:
        post_fields['body'] = data.pop('body')

    if post_fields:
        post = await db.get(models.Post, db_ad.post_id)
        if post:
            for k, v in post_fields.items():
                setattr(post, k, v)

    for key, value in data.items():
        setattr(db_ad, key, value)

    db_ad.updated_at = datetime.utcnow()
    await db.commit()
    return await get_ad_post(db, ad_id)


async def approve_ad_post(db: AsyncSession, ad_id: int, reviewer_id: int) -> Optional[models.AdPost]:
    """Одобрить рекламный пост"""
    result = await db.execute(
        select(models.AdPost).where(
            models.AdPost.id == ad_id,
            models.AdPost.status == 'pending_review',
        )
    )
    db_ad = result.scalar_one_or_none()
    if not db_ad:
        return None

    now = datetime.utcnow()
    db_ad.reviewed_by = reviewer_id
    db_ad.reviewed_at = now

    if db_ad.starts_at <= now:
        db_ad.status = 'active'
    else:
        db_ad.status = 'approved'

    await db.commit()
    return await get_ad_post(db, ad_id)


async def reject_ad_post(db: AsyncSession, ad_id: int, reviewer_id: int, reason: Optional[str] = None) -> Optional[models.AdPost]:
    """Отклонить рекламный пост"""
    result = await db.execute(
        select(models.AdPost).where(
            models.AdPost.id == ad_id,
            models.AdPost.status == 'pending_review',
        )
    )
    db_ad = result.scalar_one_or_none()
    if not db_ad:
        return None

    db_ad.status = 'rejected'
    db_ad.reviewed_by = reviewer_id
    db_ad.reviewed_at = datetime.utcnow()
    db_ad.reject_reason = reason

    await db.commit()
    return await get_ad_post(db, ad_id)


async def pause_ad_post(db: AsyncSession, ad_id: int) -> Optional[models.AdPost]:
    """Поставить на паузу"""
    result = await db.execute(
        select(models.AdPost).where(
            models.AdPost.id == ad_id,
            models.AdPost.status == 'active',
        )
    )
    db_ad = result.scalar_one_or_none()
    if not db_ad:
        return None
    db_ad.status = 'paused'
    await db.commit()
    return await get_ad_post(db, ad_id)


async def resume_ad_post(db: AsyncSession, ad_id: int) -> Optional[models.AdPost]:
    """Снять с паузы"""
    result = await db.execute(
        select(models.AdPost).where(
            models.AdPost.id == ad_id,
            models.AdPost.status == 'paused',
        )
    )
    db_ad = result.scalar_one_or_none()
    if not db_ad:
        return None
    db_ad.status = 'active'
    await db.commit()
    return await get_ad_post(db, ad_id)


async def delete_ad_post(db: AsyncSession, ad_id: int) -> bool:
    """Удалить рекламный пост вместе с базовым постом"""
    db_ad = await db.get(models.AdPost, ad_id)
    if not db_ad:
        return False

    db_post = await db.get(models.Post, db_ad.post_id)
    if db_post:
        await db.delete(db_post)  # CASCADE удалит и ad_post

    await db.commit()
    return True


# ===== ПОКАЗЫ И КЛИКИ =====

async def get_active_ads_for_user(
    db: AsyncSession,
    user_university: str,
    user_city: Optional[str] = None,
    limit: int = 3,
    exclude_seen_by_user_id: Optional[int] = None,
    include_all_for_dev: bool = False,
) -> List[models.AdPost]:
    """Выбрать активные рекламные посты для подмешивания в ленту."""
    now = datetime.utcnow()

    query = (
        select(models.AdPost)
        .join(models.Post, models.AdPost.post_id == models.Post.id)
        .options(
            selectinload(models.AdPost.post).selectinload(models.Post.author),
        )
    )

    if not include_all_for_dev:
        query = query.where(
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
            (models.AdPost.scope == 'university') & (models.AdPost.target_university == user_university)
        )
        if user_city:
            scope_filter.append(
                (models.AdPost.scope == 'city') & (models.AdPost.target_city == user_city)
            )
        query = query.where(or_(*scope_filter))

        # Дедупликация: не показывать уже виденные сегодня
        if exclude_seen_by_user_id:
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            seen_today = (
                select(models.AdImpression.ad_post_id)
                .where(
                    models.AdImpression.user_id == exclude_seen_by_user_id,
                    models.AdImpression.viewed_at >= today_start,
                )
                .scalar_subquery()
            )
            query = query.where(~models.AdPost.id.in_(seen_today))

            # Исключить скрытые пользователем объявления
            hidden_sq = (
                select(models.AdHidden.ad_post_id)
                .where(models.AdHidden.user_id == exclude_seen_by_user_id)
                .scalar_subquery()
            )
            query = query.where(~models.AdPost.id.in_(hidden_sq))

    query = query.where(models.Post.is_deleted.is_(False))
    result = await db.execute(
        query.order_by(
            models.AdPost.created_at.desc() if include_all_for_dev else models.AdPost.priority.desc(),
            func.random(),
        ).limit(limit)
    )
    return result.scalars().all()


async def track_ad_impression(db: AsyncSession, ad_post_id: int, user_id: int) -> bool:
    """Зафиксировать показ рекламного поста (✅ Фаза 4.3: INSERT ON CONFLICT + атомарные счётчики)"""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    db_ad = await db.get(models.AdPost, ad_post_id)
    if not db_ad:
        return False

    # Проверяем daily cap
    if db_ad.daily_impression_cap:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = await db.scalar(
            select(func.count(models.AdImpression.id)).where(
                models.AdImpression.ad_post_id == ad_post_id,
                models.AdImpression.viewed_at >= today_start,
            )
        )
        if (today_count or 0) >= db_ad.daily_impression_cap:
            return False

    # INSERT ON CONFLICT: атомарная вставка, без race condition
    stmt = (
        pg_insert(models.AdImpression)
        .values(ad_post_id=ad_post_id, user_id=user_id)
        .on_conflict_do_nothing(constraint='unique_ad_impression')
        .returning(models.AdImpression.id)
    )
    result = await db.execute(stmt)
    is_new_unique = result.scalar_one_or_none() is not None

    # Атомарные счётчики: инкрементируем только при первом показе
    if not is_new_unique:
        await db.commit()
        return False

    update_values = {
        'impressions_count': models.AdPost.impressions_count + 1,
        'unique_views_count': models.AdPost.unique_views_count + 1,
    }

    await db.execute(
        sa_update(models.AdPost)
        .where(models.AdPost.id == ad_post_id)
        .values(**update_values)
    )

    # Автозавершение при достижении лимита
    if db_ad.impression_limit and (db_ad.impressions_count + 1) >= db_ad.impression_limit:
        await db.execute(
            sa_update(models.AdPost)
            .where(models.AdPost.id == ad_post_id)
            .values(status='completed')
        )

    await db.commit()
    return True


async def track_ad_click(db: AsyncSession, ad_post_id: int, user_id: int) -> bool:
    """Зафиксировать клик по CTA (✅ атомарный счётчик)"""
    db_ad = await db.get(models.AdPost, ad_post_id)
    if not db_ad:
        return False

    click = models.AdClick(
        ad_post_id=ad_post_id,
        user_id=user_id,
    )
    db.add(click)

    await db.execute(
        sa_update(models.AdPost)
        .where(models.AdPost.id == ad_post_id)
        .values(clicks_count=models.AdPost.clicks_count + 1)
    )

    await db.commit()
    return True


# ===== СКРЫТИЕ РЕКЛАМЫ =====

async def hide_ad(db: AsyncSession, ad_post_id: int, user_id: int) -> bool:
    """Скрыть рекламное объявление для пользователя."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    stmt = (
        pg_insert(models.AdHidden)
        .values(ad_post_id=ad_post_id, user_id=user_id)
        .on_conflict_do_nothing(constraint='unique_ad_hidden')
    )
    await db.execute(stmt)
    await db.commit()
    return True


async def unhide_ad(db: AsyncSession, ad_post_id: int, user_id: int) -> bool:
    """Отменить скрытие рекламного объявления."""
    from sqlalchemy import delete

    await db.execute(
        delete(models.AdHidden).where(
            models.AdHidden.ad_post_id == ad_post_id,
            models.AdHidden.user_id == user_id,
        )
    )
    await db.commit()
    return True


# ===== СТАТИСТИКА =====

async def get_ad_stats(db: AsyncSession, ad_id: int) -> Optional[dict]:
    """Детальная статистика по рекламному посту"""
    db_ad = await db.get(models.AdPost, ad_id)
    if not db_ad:
        return None

    ctr = (db_ad.clicks_count / db_ad.impressions_count * 100) if db_ad.impressions_count > 0 else 0.0

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    imp_result = await db.execute(
        select(
            func.date(models.AdImpression.viewed_at).label('day'),
            func.count(models.AdImpression.id).label('count'),
        ).where(
            models.AdImpression.ad_post_id == ad_id,
            models.AdImpression.viewed_at >= thirty_days_ago,
        ).group_by(func.date(models.AdImpression.viewed_at))
    )
    impressions_by_day = imp_result.all()

    click_result = await db.execute(
        select(
            func.date(models.AdClick.clicked_at).label('day'),
            func.count(models.AdClick.id).label('count'),
        ).where(
            models.AdClick.ad_post_id == ad_id,
            models.AdClick.clicked_at >= thirty_days_ago,
        ).group_by(func.date(models.AdClick.clicked_at))
    )
    clicks_by_day = click_result.all()

    return {
        'ad_post_id': ad_id,
        'impressions_count': db_ad.impressions_count,
        'unique_views_count': db_ad.unique_views_count,
        'clicks_count': db_ad.clicks_count,
        'ctr': round(ctr, 2),
        'impressions_by_day': [{'day': str(row.day), 'count': row.count} for row in impressions_by_day],
        'clicks_by_day': [{'day': str(row.day), 'count': row.count} for row in clicks_by_day],
    }


async def get_ad_overview_stats(db: AsyncSession) -> dict:
    """Сводная статистика рекламной системы"""
    total_active = await db.scalar(
        select(func.count(models.AdPost.id)).where(models.AdPost.status == 'active')
    )
    total_pending = await db.scalar(
        select(func.count(models.AdPost.id)).where(models.AdPost.status == 'pending_review')
    )
    total_impressions = await db.scalar(
        select(func.sum(models.AdPost.impressions_count))
    ) or 0
    total_clicks = await db.scalar(
        select(func.sum(models.AdPost.clicks_count))
    ) or 0
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0

    return {
        'total_active': total_active or 0,
        'total_pending': total_pending or 0,
        'total_impressions': total_impressions,
        'total_clicks': total_clicks,
        'avg_ctr': round(avg_ctr, 2),
    }
