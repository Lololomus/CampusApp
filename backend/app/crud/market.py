from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging

from sqlalchemy import func, or_, select, update as sa_update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, schemas
from app.config import get_settings
from app.crud.users import get_user_by_id
from app.services import notification_service
from app.utils import delete_all_media, delete_images, process_base64_images

logger = logging.getLogger(__name__)

PRODUCT_CATEGORIES = [
    'textbooks',
    'electronics',
    'furniture',
    'clothing',
    'sports',
    'appliances',
]

SERVICE_CATEGORIES = [
    'tutor',
    'homework',
    'repair',
    'design',
    'delivery',
]

STANDARD_CATEGORIES = PRODUCT_CATEGORIES + SERVICE_CATEGORIES

ACTIVE_LEAD_STATUS = 'active'
ACTIVE_DEAL_STATUSES = (
    'selected',
    'in_progress',
    'provider_confirmed',
    'customer_confirmed',
    'dispute_open',
)
EXPIRABLE_DEAL_STATUSES = (
    'selected',
    'in_progress',
    'provider_confirmed',
)
FINAL_DEAL_STATUSES = ('completed', 'cancelled', 'expired')
REVIEW_WINDOW_DAYS = 7


def _utcnow() -> datetime:
    return datetime.utcnow()


def _is_market_expiry_enabled() -> bool:
    settings = get_settings()
    return settings.is_prod and settings.market_expiry_worker_enabled


async def _count_active_item_deals(db: AsyncSession, item_id: int) -> int:
    count = await db.scalar(
        select(func.count(models.MarketDeal.id)).where(
            models.MarketDeal.item_id == item_id,
            models.MarketDeal.status.in_(ACTIVE_DEAL_STATUSES),
        )
    )
    return int(count or 0)


async def _append_deal_event(
    db: AsyncSession,
    deal: models.MarketDeal,
    actor_id: Optional[int],
    event_type: str,
    from_status: Optional[str],
    to_status: Optional[str],
    payload: Optional[dict] = None,
) -> None:
    db.add(
        models.MarketDealEvent(
            deal_id=deal.id,
            item_id=deal.item_id,
            actor_id=actor_id,
            event_type=event_type,
            from_status=from_status,
            to_status=to_status,
            payload=payload,
        )
    )


def _deal_ttl_hours(item_type: str, status: str) -> Optional[int]:
    if not _is_market_expiry_enabled():
        return None
    settings = get_settings()
    if status == 'selected':
        return int(settings.market_deal_selected_ttl_hours)
    if status == 'in_progress' and item_type == 'service':
        return int(settings.market_service_in_progress_ttl_hours)
    if status == 'provider_confirmed':
        return int(settings.market_deal_provider_confirmed_ttl_hours)
    return None


def _compute_deal_expires_at(item_type: str, status: str, now: datetime) -> Optional[datetime]:
    ttl_hours = _deal_ttl_hours(item_type, status)
    if ttl_hours is None:
        return None
    return now + timedelta(hours=max(1, ttl_hours))


def _is_deal_overdue(deal: models.MarketDeal, now: Optional[datetime] = None) -> bool:
    if not _is_market_expiry_enabled():
        return False
    current = now or _utcnow()
    if deal.status not in EXPIRABLE_DEAL_STATUSES:
        return False
    if not deal.expires_at:
        return False
    return deal.expires_at <= current


async def _expire_market_deal(
    db: AsyncSession,
    deal: models.MarketDeal,
    now: datetime,
    notify: bool = True,
) -> bool:
    if not _is_market_expiry_enabled():
        return False
    if deal.status not in EXPIRABLE_DEAL_STATUSES:
        return False
    if not deal.expires_at or deal.expires_at > now:
        return False

    previous_status = deal.status
    deal.status = 'expired'
    deal.expires_at = now
    await _append_deal_event(
        db,
        deal,
        actor_id=None,
        event_type='expired',
        from_status=previous_status,
        to_status='expired',
        payload={'reason': 'ttl'},
    )

    item = deal.item
    if item.item_type == 'product' and item.status == 'reserved':
        other_active = await db.scalar(
            select(func.count(models.MarketDeal.id)).where(
                models.MarketDeal.item_id == item.id,
                models.MarketDeal.id != deal.id,
                models.MarketDeal.status.in_(ACTIVE_DEAL_STATUSES),
            )
        )
        if int(other_active or 0) == 0:
            item.status = 'active'
            item.pause_reason = None
    elif item.item_type == 'service':
        await _sync_service_capacity_status(db, item)

    if notify:
        await notification_service.notify_market_deal_update(db, deal.seller_id, item, deal, 'expired')
        await notification_service.notify_market_deal_update(db, deal.buyer_id, item, deal, 'expired')
    return True


async def _expire_overdue_deals_for_item(
    db: AsyncSession,
    item_id: int,
    now: Optional[datetime] = None,
) -> int:
    if not _is_market_expiry_enabled():
        return 0
    current = now or _utcnow()
    result = await db.execute(
        select(models.MarketDeal)
        .options(selectinload(models.MarketDeal.item))
        .where(
            models.MarketDeal.item_id == item_id,
            models.MarketDeal.status.in_(EXPIRABLE_DEAL_STATUSES),
            models.MarketDeal.expires_at.is_not(None),
            models.MarketDeal.expires_at <= current,
        )
        .with_for_update()
    )
    deals = result.scalars().all()

    expired_count = 0
    for deal in deals:
        if await _expire_market_deal(db, deal, current, notify=True):
            expired_count += 1
    return expired_count


async def expire_market_entities(
    db: AsyncSession,
    now: Optional[datetime] = None,
    batch_size: int = 200,
) -> Dict[str, int]:
    if not _is_market_expiry_enabled():
        return {'expired_leads': 0, 'expired_deals': 0}
    current = now or _utcnow()
    settings = get_settings()
    lead_deadline = current - timedelta(hours=max(1, int(settings.market_lead_ttl_hours)))

    leads_result = await db.execute(
        select(models.MarketLead)
        .where(
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
            models.MarketLead.created_at <= lead_deadline,
        )
        .order_by(models.MarketLead.created_at.asc())
        .limit(max(1, batch_size))
        .with_for_update(skip_locked=True)
    )
    leads = leads_result.scalars().all()
    expired_leads = 0
    for lead in leads:
        lead.status = 'expired'
        lead.updated_at = current
        expired_leads += 1

    deals_result = await db.execute(
        select(models.MarketDeal)
        .options(selectinload(models.MarketDeal.item))
        .where(
            models.MarketDeal.status.in_(EXPIRABLE_DEAL_STATUSES),
            models.MarketDeal.expires_at.is_not(None),
            models.MarketDeal.expires_at <= current,
        )
        .order_by(models.MarketDeal.expires_at.asc(), models.MarketDeal.id.asc())
        .limit(max(1, batch_size))
        .with_for_update(skip_locked=True)
    )
    deals = deals_result.scalars().all()

    expired_deals = 0
    for deal in deals:
        if await _expire_market_deal(db, deal, current, notify=True):
            expired_deals += 1

    if expired_leads or expired_deals:
        await db.commit()
    return {'expired_leads': expired_leads, 'expired_deals': expired_deals}


async def _sync_service_capacity_status(db: AsyncSession, item: models.MarketItem) -> None:
    if item.item_type != 'service':
        return
    if item.status in ('sold', 'archived'):
        item.pause_reason = None
        return
    if item.pause_reason == 'manual':
        item.status = 'paused'
        return

    active_deals = await _count_active_item_deals(db, item.id)
    capacity = max(int(item.capacity or 1), 1)

    if active_deals >= capacity:
        item.status = 'paused'
        item.pause_reason = 'capacity'
    elif item.status == 'paused' and item.pause_reason == 'capacity':
        item.status = 'active'
        item.pause_reason = None


def _is_waitlist_interest(item: models.MarketItem, active_deals: int) -> bool:
    if item.item_type == 'product':
        return item.status == 'reserved' or active_deals > 0

    if item.status == 'paused' and item.pause_reason in ('manual', 'capacity'):
        return True

    capacity = max(int(item.capacity or 1), 1)
    return active_deals >= capacity


async def _load_deal(db: AsyncSession, deal_id: int) -> Optional[models.MarketDeal]:
    result = await db.execute(
        select(models.MarketDeal)
        .options(
            selectinload(models.MarketDeal.item),
            selectinload(models.MarketDeal.events),
        )
        .where(models.MarketDeal.id == deal_id)
    )
    return result.scalar_one_or_none()


async def _complete_deal(db: AsyncSession, deal: models.MarketDeal, actor_id: Optional[int]) -> None:
    if deal.status == 'completed':
        return

    previous_status = deal.status
    deal.status = 'completed'
    deal.completed_at = _utcnow()
    deal.expires_at = None
    await _append_deal_event(db, deal, actor_id, 'completed', previous_status, 'completed')

    item = deal.item
    if item.item_type == 'product':
        item.status = 'sold'
        item.pause_reason = None
    else:
        await _sync_service_capacity_status(db, item)

    buyer = await db.get(models.User, deal.buyer_id)
    seller = await db.get(models.User, deal.seller_id)
    if buyer and seller:
        await notification_service.notify_review_request_for_deal(db, buyer, seller, item, deal)
        await notification_service.notify_market_deal_update(db, buyer.id, item, deal, 'completed')
        await notification_service.notify_market_deal_update(db, seller.id, item, deal, 'completed')

# ===== CREATE / UPDATE =====


async def create_market_item(
    db: AsyncSession,
    item: schemas.MarketItemCreate,
    seller_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.MarketItem:
    seller = await get_user_by_id(db, seller_id)
    if not seller:
        raise ValueError('Seller not found')

    saved_images_meta = images_meta or []
    if not saved_images_meta and item.images:
        try:
            saved_images_meta = process_base64_images(item.images)
        except (ValueError, OSError) as e:
            raise ValueError(f'Image upload failed: {str(e)}')

    if not saved_images_meta:
        raise ValueError('At least one photo is required')

    capacity = 1 if item.item_type == 'product' else int(item.capacity or 3)

    db_item = models.MarketItem(
        seller_id=seller_id,
        category=item.category.strip(),
        item_type=item.item_type,
        title=item.title,
        description=item.description,
        price=item.price,
        condition=item.condition,
        capacity=capacity,
        pause_reason=None,
        location=item.location or f'{seller.university}, {seller.institute}',
        images=saved_images_meta,
        status='active',
        university=seller.university,
        institute=seller.institute,
    )

    try:
        db.add(db_item)
        await db.commit()
        await db.refresh(db_item)
        return db_item
    except SQLAlchemyError:
        if saved_images_meta:
            delete_all_media(saved_images_meta)
        raise


async def update_market_item(
    db: AsyncSession,
    item_id: int,
    seller_id: int,
    item_update: schemas.MarketItemUpdate,
    new_images_meta: Optional[List[dict]] = None,
    keep_filenames: Optional[List[str]] = None,
    keep_video: bool = True,
) -> Optional[models.MarketItem]:
    result = await db.execute(
        select(models.MarketItem).where(
            models.MarketItem.id == item_id,
            models.MarketItem.seller_id == seller_id,
        )
    )
    db_item = result.scalar_one_or_none()
    if not db_item:
        return None

    update_data = item_update.model_dump(exclude_unset=True)
    files_to_delete: List[str] = []

    if new_images_meta is not None or keep_filenames is not None:
        from app.crud.helpers import merge_images

        final_images, files_to_delete = merge_images(
            old_images=db_item.images,
            new_images_meta=new_images_meta,
            keep_filenames=keep_filenames,
            require_at_least_one=True,
            keep_old_videos=keep_video,
        )
        update_data['images'] = final_images

    future_item_type = update_data.get('item_type', db_item.item_type)
    if future_item_type == 'product':
        update_data['capacity'] = 1
        update_data['pause_reason'] = None
        if update_data.get('status') == 'paused':
            raise ValueError('Product cannot be paused')

    if update_data.get('status') == 'paused' and future_item_type != 'service':
        raise ValueError('Only services can be paused')

    if future_item_type == 'service' and update_data.get('status') in {'reserved', 'sold'}:
        raise ValueError('Service status cannot be reserved or sold')

    if update_data.get('status') == 'paused' and future_item_type == 'service':
        if not update_data.get('pause_reason'):
            update_data['pause_reason'] = 'manual'

    if update_data.get('status') and update_data['status'] != 'paused':
        update_data['pause_reason'] = None

    # Keep explicit pause_reason=None so manual pause can be cleared.
    update_data = {k: v for k, v in update_data.items() if v is not None or k == 'pause_reason'}
    for key, value in update_data.items():
        setattr(db_item, key, value)

    if db_item.item_type == 'service' and db_item.capacity < 1:
        db_item.capacity = 1

    if db_item.item_type == 'service' and db_item.pause_reason != 'manual' and db_item.status not in ('sold', 'archived'):
        await _sync_service_capacity_status(db, db_item)

    db_item.updated_at = _utcnow()

    try:
        await db.commit()
    except SQLAlchemyError:
        await db.rollback()
        if new_images_meta:
            delete_all_media(new_images_meta)
        raise

    if files_to_delete:
        delete_images(files_to_delete)

    await db.refresh(db_item)
    return db_item


async def delete_market_item(db: AsyncSession, item_id: int, seller_id: int) -> bool:
    result = await db.execute(
        select(models.MarketItem).where(
            models.MarketItem.id == item_id,
            models.MarketItem.seller_id == seller_id,
        )
    )
    db_item = result.scalar_one_or_none()
    if not db_item:
        return False

    db_item.is_deleted = True
    db_item.deleted_at = _utcnow()
    db_item.status = 'archived'
    db_item.pause_reason = None
    await db.commit()
    return True


# ===== READ / SEARCH =====


async def get_market_items(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    item_type: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    condition: Optional[str] = None,
    university: Optional[str] = None,
    institute: Optional[str] = None,
    campus_id: Optional[str] = None,
    city: Optional[str] = None,
    sort: str = 'newest',
    search: Optional[str] = None,
    current_user_id: Optional[int] = None,
) -> Dict:
    query = (
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.seller))
        .where(
            models.MarketItem.status == 'active',
            models.MarketItem.is_deleted == False,
        )
    )

    if search:
        search_term = f'%{search}%'
        query = query.where(
            or_(
                models.MarketItem.title.ilike(search_term),
                models.MarketItem.description.ilike(search_term),
            )
        )

    if item_type and item_type in ('product', 'service'):
        query = query.where(models.MarketItem.item_type == item_type)

    if category and category != 'all':
        query = query.where(models.MarketItem.category == category)

    if price_min is not None:
        query = query.where(models.MarketItem.price >= price_min)

    if price_max is not None:
        query = query.where(models.MarketItem.price <= price_max)

    if condition:
        conditions = condition.split(',')
        query = query.where(models.MarketItem.condition.in_(conditions))

    if campus_id:
        query = query.join(models.User, models.MarketItem.seller_id == models.User.id).where(models.User.campus_id == campus_id)
    elif university and university != 'all':
        query = query.where(models.MarketItem.university == university)
    elif city:
        query = query.join(models.User, models.MarketItem.seller_id == models.User.id).where(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%'),
            )
        )

    if institute and institute != 'all':
        query = query.where(models.MarketItem.institute == institute)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    if sort == 'price_asc':
        query = query.order_by(models.MarketItem.price.asc())
    elif sort == 'price_desc':
        query = query.order_by(models.MarketItem.price.desc())
    elif sort == 'oldest':
        query = query.order_by(models.MarketItem.created_at.asc())
    else:
        query = query.order_by(models.MarketItem.created_at.desc())

    result = await db.execute(query.offset(skip).limit(limit))
    items = result.scalars().all()

    return {
        'items': items,
        'total': total or 0,
        'has_more': skip + limit < (total or 0),
    }


async def get_market_item(db: AsyncSession, item_id: int, user_id: Optional[int] = None) -> Optional[models.MarketItem]:
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.seller))
        .where(
            models.MarketItem.id == item_id,
            models.MarketItem.is_deleted == False,
        )
    )
    item = result.scalar_one_or_none()

    if item and user_id and item.seller_id != user_id:
        view_check = await db.execute(
            select(models.MarketItemView).where(
                models.MarketItemView.item_id == item_id,
                models.MarketItemView.user_id == user_id,
            )
        )
        if not view_check.scalar_one_or_none():
            try:
                db.add(models.MarketItemView(item_id=item_id, user_id=user_id))
                await db.execute(
                    sa_update(models.MarketItem)
                    .where(models.MarketItem.id == item_id)
                    .values(views_count=models.MarketItem.views_count + 1)
                )
                await db.commit()
                await db.refresh(item)
            except SQLAlchemyError:
                await db.rollback()

    return item

# ===== FAVORITES =====


async def toggle_market_favorite(db: AsyncSession, item_id: int, user_id: int) -> dict:
    fav_result = await db.execute(
        select(models.MarketFavorite).where(
            models.MarketFavorite.item_id == item_id,
            models.MarketFavorite.user_id == user_id,
        )
    )
    favorite = fav_result.scalar_one_or_none()

    item = await db.get(models.MarketItem, item_id)
    if not item:
        return {'is_favorited': False, 'favorites_count': 0}

    if favorite:
        await db.delete(favorite)
        await db.execute(
            sa_update(models.MarketItem)
            .where(models.MarketItem.id == item_id)
            .values(favorites_count=func.greatest(models.MarketItem.favorites_count - 1, 0))
        )
        await db.commit()
        await db.refresh(item)
        return {'is_favorited': False, 'favorites_count': item.favorites_count}

    db.add(models.MarketFavorite(user_id=user_id, item_id=item_id))
    await db.execute(
        sa_update(models.MarketItem)
        .where(models.MarketItem.id == item_id)
        .values(favorites_count=models.MarketItem.favorites_count + 1)
    )
    await db.commit()
    await db.refresh(item)
    return {'is_favorited': True, 'favorites_count': item.favorites_count}


async def is_item_favorited(db: AsyncSession, item_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(models.MarketFavorite).where(
            models.MarketFavorite.item_id == item_id,
            models.MarketFavorite.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_user_favorites(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> List[models.MarketItem]:
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.seller))
        .join(models.MarketFavorite)
        .where(
            models.MarketFavorite.user_id == user_id,
            models.MarketItem.status != 'archived',
            models.MarketItem.is_deleted == False,
        )
        .order_by(models.MarketFavorite.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


async def get_user_market_items(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> List[models.MarketItem]:
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.seller_id == user_id)
        .order_by(models.MarketItem.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


# ===== CATEGORIES =====


async def get_market_categories(db: AsyncSession, item_type: Optional[str] = None) -> Dict[str, List[str]]:
    if item_type == 'service':
        standard = SERVICE_CATEGORIES
    elif item_type == 'product':
        standard = PRODUCT_CATEGORIES
    else:
        standard = STANDARD_CATEGORIES

    custom_query = (
        select(models.MarketItem.category, func.count(models.MarketItem.id).label('count'))
        .where(~models.MarketItem.category.in_(STANDARD_CATEGORIES))
    )
    if item_type and item_type in ('product', 'service'):
        custom_query = custom_query.where(models.MarketItem.item_type == item_type)

    custom_query = custom_query.group_by(models.MarketItem.category).order_by(
        func.count(models.MarketItem.id).desc()
    ).limit(10)

    result = await db.execute(custom_query)
    popular_custom = [row[0] for row in result.all()]

    return {
        'standard': standard,
        'popular_custom': popular_custom,
    }

# ===== DEAL FLOW V2 =====


async def create_market_interest(
    db: AsyncSession,
    item_id: int,
    buyer_id: int,
) -> Tuple[models.MarketLead, bool, bool]:
    item = await db.get(models.MarketItem, item_id)
    if not item or item.is_deleted:
        raise ValueError('Item not found')
    if item.seller_id == buyer_id:
        raise ValueError('Cannot contact your own item')
    if item.status in ('sold', 'archived'):
        raise ValueError('Item is no longer available')
    if item.item_type == 'service' and item.status == 'paused' and item.pause_reason == 'manual':
        raise ValueError('Service is temporarily unavailable')

    expired_for_item = await _expire_overdue_deals_for_item(db, item.id)
    if expired_for_item:
        await db.commit()

    active_deals = await _count_active_item_deals(db, item.id)

    existing_result = await db.execute(
        select(models.MarketLead).where(
            models.MarketLead.item_id == item.id,
            models.MarketLead.buyer_id == buyer_id,
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing, _is_waitlist_interest(item, active_deals), False

    active_leads_count = await db.scalar(
        select(func.count(models.MarketLead.id)).where(
            models.MarketLead.item_id == item.id,
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
        )
    )
    if int(active_leads_count or 0) >= 50:
        raise ValueError('Waitlist is full (50 active interests)')

    lead = models.MarketLead(item_id=item.id, buyer_id=buyer_id, status=ACTIVE_LEAD_STATUS)
    db.add(lead)
    try:
        await db.commit()
        await db.refresh(lead)
        return lead, _is_waitlist_interest(item, active_deals), True
    except IntegrityError:
        await db.rollback()
        existing_result = await db.execute(
            select(models.MarketLead).where(
                models.MarketLead.item_id == item.id,
                models.MarketLead.buyer_id == buyer_id,
                models.MarketLead.status == ACTIVE_LEAD_STATUS,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            refreshed_active_deals = await _count_active_item_deals(db, item.id)
            return existing, _is_waitlist_interest(item, refreshed_active_deals), False
        raise


async def cancel_market_interest(db: AsyncSession, item_id: int, buyer_id: int) -> bool:
    result = await db.execute(
        select(models.MarketLead).where(
            models.MarketLead.item_id == item_id,
            models.MarketLead.buyer_id == buyer_id,
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        return False

    lead.status = 'cancelled'
    lead.updated_at = _utcnow()
    await db.commit()
    return True


async def get_market_waitlist(db: AsyncSession, item_id: int, seller_id: int) -> List[models.MarketLead]:
    item = await db.get(models.MarketItem, item_id)
    if not item or item.is_deleted:
        raise ValueError('Item not found')
    if item.seller_id != seller_id:
        raise PermissionError('Only seller can access waitlist')

    result = await db.execute(
        select(models.MarketLead)
        .options(selectinload(models.MarketLead.buyer))
        .where(
            models.MarketLead.item_id == item_id,
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
        )
        .order_by(models.MarketLead.created_at.asc())
        .limit(50)
    )
    return result.scalars().all()


async def select_market_buyer(
    db: AsyncSession,
    item_id: int,
    seller_id: int,
    buyer_id: int,
) -> models.MarketDeal:
    item_result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.id == item_id, models.MarketItem.seller_id == seller_id)
        .with_for_update()
    )
    item = item_result.scalar_one_or_none()
    if not item or item.is_deleted:
        raise ValueError('Item not found')

    expired_for_item = await _expire_overdue_deals_for_item(db, item.id)
    if expired_for_item:
        await db.flush()

    if item.status in ('sold', 'archived'):
        raise ValueError('Item is not available')
    if buyer_id == seller_id:
        raise ValueError('Buyer must be different from seller')

    lead_result = await db.execute(
        select(models.MarketLead).where(
            models.MarketLead.item_id == item.id,
            models.MarketLead.buyer_id == buyer_id,
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
        )
    )
    lead = lead_result.scalar_one_or_none()
    if not lead:
        raise ValueError('Buyer has no active interest in this item')

    existing_same_pair = await db.execute(
        select(models.MarketDeal.id).where(
            models.MarketDeal.item_id == item.id,
            models.MarketDeal.buyer_id == buyer_id,
            models.MarketDeal.status.in_(ACTIVE_DEAL_STATUSES),
        )
    )
    if existing_same_pair.scalar_one_or_none():
        raise ValueError('An active deal with this buyer already exists')

    if item.item_type == 'product':
        other_active = await db.execute(
            select(models.MarketDeal.id).where(
                models.MarketDeal.item_id == item.id,
                models.MarketDeal.status.in_(ACTIVE_DEAL_STATUSES),
            )
        )
        if other_active.scalar_one_or_none():
            raise ValueError('Product already has an active deal')
    else:
        if item.status == 'paused' and item.pause_reason == 'manual':
            raise ValueError('Service is manually paused')

        active_count = await _count_active_item_deals(db, item.id)
        if active_count >= max(int(item.capacity or 1), 1):
            raise ValueError('Service capacity is full')

    selected_at = _utcnow()
    deal = models.MarketDeal(
        item_id=item.id,
        seller_id=seller_id,
        buyer_id=buyer_id,
        status='selected',
        selected_at=selected_at,
        expires_at=_compute_deal_expires_at(item.item_type, 'selected', selected_at),
    )
    db.add(deal)
    await db.flush()

    lead.status = 'converted'
    lead.updated_at = _utcnow()

    if item.item_type == 'product':
        item.status = 'reserved'
        item.pause_reason = None
    else:
        await _sync_service_capacity_status(db, item)

    await _append_deal_event(db, deal, seller_id, 'selected', None, 'selected')
    await notification_service.notify_market_deal_update(db, buyer_id, item, deal, 'selected')

    await db.commit()
    await db.refresh(deal)
    return deal


async def start_market_deal(db: AsyncSession, deal_id: int, seller_id: int) -> models.MarketDeal:
    deal = await _load_deal(db, deal_id)
    if not deal:
        raise ValueError('Deal not found')
    now = _utcnow()
    if await _expire_market_deal(db, deal, now, notify=True):
        await db.commit()
        raise ValueError('Deal has expired')
    if deal.seller_id != seller_id:
        raise PermissionError('Only seller can start the deal')
    if deal.item.item_type != 'service':
        raise ValueError('Only service deals can be started')
    if deal.status != 'selected':
        raise ValueError('Deal cannot be started from current status')

    previous_status = deal.status
    deal.status = 'in_progress'
    deal.started_at = now
    deal.expires_at = _compute_deal_expires_at(deal.item.item_type, 'in_progress', now)
    await _append_deal_event(db, deal, seller_id, 'start', previous_status, 'in_progress')
    await notification_service.notify_market_deal_update(db, deal.buyer_id, deal.item, deal, 'in_progress')

    await db.commit()
    await db.refresh(deal)
    return deal


async def provider_confirm_market_deal(db: AsyncSession, deal_id: int, seller_id: int) -> models.MarketDeal:
    deal = await _load_deal(db, deal_id)
    if not deal:
        raise ValueError('Deal not found')
    now = _utcnow()
    if await _expire_market_deal(db, deal, now, notify=True):
        await db.commit()
        raise ValueError('Deal has expired')
    if deal.seller_id != seller_id:
        raise PermissionError('Only seller/provider can confirm')

    if deal.item.item_type == 'service':
        allowed_from = {'in_progress'}
    else:
        allowed_from = {'selected'}

    if deal.status not in allowed_from:
        raise ValueError('Deal cannot be provider-confirmed from current status')

    previous_status = deal.status
    deal.status = 'provider_confirmed'
    deal.provider_confirmed_at = now
    deal.expires_at = _compute_deal_expires_at(deal.item.item_type, 'provider_confirmed', now)
    await _append_deal_event(db, deal, seller_id, 'provider_confirm', previous_status, 'provider_confirmed')
    await notification_service.notify_market_deal_update(db, deal.buyer_id, deal.item, deal, 'provider_confirmed')

    await db.commit()
    await db.refresh(deal)
    return deal


async def customer_confirm_market_deal(
    db: AsyncSession,
    deal_id: int,
    buyer_id: int,
    outcome: str,
) -> models.MarketDeal:
    deal = await _load_deal(db, deal_id)
    if not deal:
        raise ValueError('Deal not found')
    now = _utcnow()
    if await _expire_market_deal(db, deal, now, notify=True):
        await db.commit()
        raise ValueError('Deal has expired')
    if deal.buyer_id != buyer_id:
        raise PermissionError('Only selected buyer can confirm receipt')
    if deal.status != 'provider_confirmed':
        raise ValueError('Deal is not ready for customer confirmation')
    if outcome not in {'received', 'not_received'}:
        raise ValueError('Invalid customer confirmation outcome')

    if outcome == 'received':
        previous_status = deal.status
        deal.status = 'customer_confirmed'
        deal.customer_result = 'received'
        deal.customer_confirmed_at = now
        await _append_deal_event(
            db,
            deal,
            buyer_id,
            'customer_confirm',
            previous_status,
            'customer_confirmed',
            {'outcome': 'received'},
        )
        await _complete_deal(db, deal, buyer_id)
    else:
        previous_status = deal.status
        deal.status = 'dispute_open'
        deal.customer_result = 'not_received'
        deal.customer_confirmed_at = now
        deal.disputed_at = now
        deal.expires_at = None
        await _append_deal_event(
            db,
            deal,
            buyer_id,
            'customer_confirm',
            previous_status,
            'dispute_open',
            {'outcome': 'not_received'},
        )
        await notification_service.notify_market_deal_update(db, deal.seller_id, deal.item, deal, 'dispute_open')

    await db.commit()
    await db.refresh(deal)
    return deal

async def reassign_market_deal(
    db: AsyncSession,
    deal_id: int,
    seller_id: int,
    new_buyer_id: int,
) -> models.MarketDeal:
    deal = await _load_deal(db, deal_id)
    if not deal:
        raise ValueError('Deal not found')
    now = _utcnow()
    if await _expire_market_deal(db, deal, now, notify=True):
        await db.commit()
        raise ValueError('Deal has expired')
    if deal.seller_id != seller_id:
        raise PermissionError('Only seller can reassign deal')
    if deal.status in {'customer_confirmed', 'completed', 'dispute_open', 'cancelled', 'expired'}:
        raise ValueError('Deal cannot be reassigned after customer confirmation')
    if new_buyer_id == seller_id:
        raise ValueError('Buyer must be different from seller')

    new_lead_result = await db.execute(
        select(models.MarketLead).where(
            models.MarketLead.item_id == deal.item_id,
            models.MarketLead.buyer_id == new_buyer_id,
            models.MarketLead.status == ACTIVE_LEAD_STATUS,
        )
    )
    new_lead = new_lead_result.scalar_one_or_none()
    if not new_lead:
        raise ValueError('New buyer must have active interest')

    old_buyer_id = deal.buyer_id
    previous_status = deal.status

    old_lead_result = await db.execute(
        select(models.MarketLead).where(
            models.MarketLead.item_id == deal.item_id,
            models.MarketLead.buyer_id == old_buyer_id,
            models.MarketLead.status == 'converted',
        )
    )
    old_lead = old_lead_result.scalar_one_or_none()
    if old_lead:
        old_lead.status = ACTIVE_LEAD_STATUS
        old_lead.updated_at = _utcnow()

    new_lead.status = 'converted'
    new_lead.updated_at = _utcnow()

    deal.buyer_id = new_buyer_id
    deal.status = 'selected'
    deal.started_at = None
    deal.provider_confirmed_at = None
    deal.customer_confirmed_at = None
    deal.completed_at = None
    deal.disputed_at = None
    deal.cancelled_at = None
    deal.customer_result = None
    deal.expires_at = _compute_deal_expires_at(deal.item.item_type, 'selected', now)

    await _append_deal_event(
        db,
        deal,
        seller_id,
        'reassign',
        previous_status,
        'selected',
        {'old_buyer_id': old_buyer_id, 'new_buyer_id': new_buyer_id},
    )
    await notification_service.notify_market_deal_update(db, old_buyer_id, deal.item, deal, 'reassigned')
    await notification_service.notify_market_deal_update(db, new_buyer_id, deal.item, deal, 'selected')

    await db.commit()
    await db.refresh(deal)
    return deal


async def cancel_market_deal(
    db: AsyncSession,
    deal_id: int,
    actor_id: int,
    is_moderator: bool = False,
) -> models.MarketDeal:
    deal = await _load_deal(db, deal_id)
    if not deal:
        raise ValueError('Deal not found')
    now = _utcnow()
    if await _expire_market_deal(db, deal, now, notify=True):
        await db.commit()
        raise ValueError('Deal has expired')

    if not is_moderator and actor_id not in {deal.seller_id, deal.buyer_id}:
        raise PermissionError('Only deal participants can cancel')
    if deal.status in FINAL_DEAL_STATUSES:
        raise ValueError('Deal is already finalized')
    if deal.status == 'dispute_open':
        raise ValueError('Dispute must be resolved by moderator')

    previous_status = deal.status
    deal.status = 'cancelled'
    deal.cancelled_at = now
    deal.expires_at = None
    await _append_deal_event(db, deal, actor_id, 'cancel', previous_status, 'cancelled')

    item = deal.item
    if item.item_type == 'product' and item.status == 'reserved':
        other_active = await db.scalar(
            select(func.count(models.MarketDeal.id)).where(
                models.MarketDeal.item_id == item.id,
                models.MarketDeal.id != deal.id,
                models.MarketDeal.status.in_(ACTIVE_DEAL_STATUSES),
            )
        )
        if int(other_active or 0) == 0:
            item.status = 'active'
            item.pause_reason = None
    elif item.item_type == 'service':
        await _sync_service_capacity_status(db, item)

    if is_moderator:
        await notification_service.notify_market_deal_update(db, deal.seller_id, item, deal, 'cancelled')
        await notification_service.notify_market_deal_update(db, deal.buyer_id, item, deal, 'cancelled')
    else:
        counterpart_id = deal.buyer_id if actor_id == deal.seller_id else deal.seller_id
        await notification_service.notify_market_deal_update(db, counterpart_id, item, deal, 'cancelled')

    await db.commit()
    await db.refresh(deal)
    return deal


async def resolve_market_dispute(
    db: AsyncSession,
    deal_id: int,
    moderator_id: int,
    resolution: str,
    note: Optional[str] = None,
) -> models.MarketDeal:
    deal = await _load_deal(db, deal_id)
    if not deal:
        raise ValueError('Deal not found')
    if deal.status != 'dispute_open':
        raise ValueError('Only disputes can be resolved')

    if resolution == 'completed':
        previous_status = deal.status
        if not deal.customer_confirmed_at:
            deal.customer_confirmed_at = _utcnow()
        deal.status = 'customer_confirmed'
        deal.customer_result = 'received'
        await _append_deal_event(
            db,
            deal,
            moderator_id,
            'resolve_dispute',
            previous_status,
            'customer_confirmed',
            {'resolution': resolution, 'note': note},
        )
        await _complete_deal(db, deal, moderator_id)
    elif resolution == 'cancelled':
        previous_status = deal.status
        deal.status = 'cancelled'
        deal.cancelled_at = _utcnow()
        deal.expires_at = None
        await _append_deal_event(
            db,
            deal,
            moderator_id,
            'resolve_dispute',
            previous_status,
            'cancelled',
            {'resolution': resolution, 'note': note},
        )
        if deal.item.item_type == 'product' and deal.item.status == 'reserved':
            other_active = await db.scalar(
                select(func.count(models.MarketDeal.id)).where(
                    models.MarketDeal.item_id == deal.item_id,
                    models.MarketDeal.id != deal.id,
                    models.MarketDeal.status.in_(ACTIVE_DEAL_STATUSES),
                )
            )
            if int(other_active or 0) == 0:
                deal.item.status = 'active'
                deal.item.pause_reason = None
        elif deal.item.item_type == 'service':
            await _sync_service_capacity_status(db, deal.item)
        await notification_service.notify_market_deal_update(db, deal.seller_id, deal.item, deal, 'resolved_cancelled')
        await notification_service.notify_market_deal_update(db, deal.buyer_id, deal.item, deal, 'resolved_cancelled')
    else:
        raise ValueError('Unsupported dispute resolution')

    await db.commit()
    await db.refresh(deal)
    return deal


async def get_market_deal(
    db: AsyncSession,
    deal_id: int,
    requester_id: int,
    requester_role: str,
) -> Optional[models.MarketDeal]:
    deal = await _load_deal(db, deal_id)
    if not deal:
        return None

    if await _expire_market_deal(db, deal, _utcnow(), notify=True):
        await db.commit()
        await db.refresh(deal)

    is_privileged = requester_role in {'ambassador', 'admin', 'superadmin'}
    if not is_privileged and requester_id not in {deal.seller_id, deal.buyer_id}:
        raise PermissionError('Access denied')

    deal.events = sorted(deal.events, key=lambda e: e.created_at or datetime.min)
    return deal

# ===== REVIEWS =====


def _resolve_review_completed_at(deal: models.MarketDeal) -> Optional[datetime]:
    settings = get_settings()
    if settings.is_prod and settings.market_review_strict_completed_at:
        return deal.completed_at
    return deal.completed_at or deal.updated_at or deal.created_at


async def create_review(
    db: AsyncSession,
    reviewer_id: int,
    data: schemas.MarketReviewCreate,
    source: str = 'app',
    status: str = 'completed',
) -> models.MarketReview:
    seller_id: int
    item_id: int
    deal_id: Optional[int] = None

    if data.deal_id:
        deal_result = await db.execute(
            select(models.MarketDeal)
            .options(selectinload(models.MarketDeal.item))
            .where(models.MarketDeal.id == data.deal_id)
        )
        deal = deal_result.scalar_one_or_none()
        if not deal:
            raise ValueError('Deal not found')
        if deal.status != 'completed':
            raise ValueError('Review is available only for completed deals')
        if deal.buyer_id != reviewer_id:
            raise ValueError('Only confirmed buyer can leave review')

        completed_at = _resolve_review_completed_at(deal)
        if completed_at is None:
            raise ValueError('Deal completion timestamp is missing')
        if completed_at and _utcnow() > completed_at + timedelta(days=REVIEW_WINDOW_DAYS):
            raise ValueError('Review window has expired (7 days)')

        seller_id = deal.seller_id
        item_id = deal.item_id
        deal_id = deal.id

        existing = await db.execute(
            select(models.MarketReview.id).where(
                models.MarketReview.reviewer_id == reviewer_id,
                models.MarketReview.deal_id == deal.id,
            )
        )
        if existing.scalar_one_or_none():
            raise IntegrityError(None, None, Exception('unique_review_per_deal'))
    else:
        if not data.item_id:
            raise ValueError('item_id is required for legacy review flow')

        item = await db.get(models.MarketItem, data.item_id)
        if not item:
            raise ValueError('Item not found')

        eligibility = await db.execute(
            select(models.Followup.id).where(
                models.Followup.user_id == reviewer_id,
                models.Followup.type == 'review_request',
                models.Followup.target_type == 'market_item',
                models.Followup.target_id == data.item_id,
                models.Followup.status.in_(['pending', 'sent', 'skipped']),
            )
        )
        if not eligibility.scalar_one_or_none():
            raise ValueError('Review is available only after seller confirmation')

        seller_id = item.seller_id
        item_id = item.id

        existing = await db.execute(
            select(models.MarketReview.id).where(
                models.MarketReview.reviewer_id == reviewer_id,
                models.MarketReview.item_id == item_id,
                models.MarketReview.deal_id.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise IntegrityError(None, None, Exception('unique_review_per_item'))

    if reviewer_id == seller_id:
        raise ValueError('Cannot leave review to yourself')

    review = models.MarketReview(
        reviewer_id=reviewer_id,
        seller_id=seller_id,
        item_id=item_id,
        deal_id=deal_id,
        rating=data.rating,
        text=data.text,
        source=source,
        status=status,
    )
    db.add(review)

    await db.execute(
        sa_update(models.Notification)
        .where(
            models.Notification.recipient_id == reviewer_id,
            models.Notification.type == 'review_request',
            models.Notification.is_read == False,
        )
        .values(is_read=True, read_at=_utcnow())
    )

    if source == 'app':
        if deal_id:
            await db.execute(
                sa_update(models.Followup)
                .where(
                    models.Followup.user_id == reviewer_id,
                    models.Followup.type == 'review_request',
                    models.Followup.target_type == 'market_deal',
                    models.Followup.target_id == deal_id,
                    models.Followup.status.in_(['pending', 'sent']),
                )
                .values(status='skipped')
            )
        await db.execute(
            sa_update(models.Followup)
            .where(
                models.Followup.user_id == reviewer_id,
                models.Followup.type == 'review_request',
                models.Followup.target_type == 'market_item',
                models.Followup.target_id == item_id,
                models.Followup.status.in_(['pending', 'sent']),
            )
            .values(status='skipped')
        )

    await db.commit()
    await db.refresh(review)

    result = await db.execute(
        select(models.MarketReview)
        .options(selectinload(models.MarketReview.reviewer))
        .where(models.MarketReview.id == review.id)
    )
    return result.scalar_one()


async def get_pending_review(db: AsyncSession, reviewer_id: int) -> Optional[models.MarketReview]:
    result = await db.execute(
        select(models.MarketReview).where(
            models.MarketReview.reviewer_id == reviewer_id,
            models.MarketReview.status == 'pending_text',
        )
    )
    return result.scalar_one_or_none()


async def add_review_text(
    db: AsyncSession,
    review_id: int,
    reviewer_id: int,
    text: Optional[str],
) -> Optional[models.MarketReview]:
    result = await db.execute(
        select(models.MarketReview).where(
            models.MarketReview.id == review_id,
            models.MarketReview.reviewer_id == reviewer_id,
        )
    )
    review = result.scalar_one_or_none()
    if not review:
        return None

    if text:
        review.text = text[:300]
    review.status = 'completed'
    await db.commit()
    await db.refresh(review)
    return review


async def skip_review_request(
    db: AsyncSession,
    reviewer_id: int,
    item_id: Optional[int] = None,
    deal_id: Optional[int] = None,
) -> None:
    if deal_id:
        await db.execute(
            sa_update(models.Followup)
            .where(
                models.Followup.user_id == reviewer_id,
                models.Followup.type == 'review_request',
                models.Followup.target_type == 'market_deal',
                models.Followup.target_id == deal_id,
                models.Followup.status.in_(['pending', 'sent']),
            )
            .values(status='skipped')
        )

    if item_id:
        await db.execute(
            sa_update(models.Followup)
            .where(
                models.Followup.user_id == reviewer_id,
                models.Followup.type == 'review_request',
                models.Followup.target_type == 'market_item',
                models.Followup.target_id == item_id,
                models.Followup.status.in_(['pending', 'sent']),
            )
            .values(status='skipped')
        )

    await db.commit()


async def get_seller_rating(db: AsyncSession, seller_id: int) -> dict:
    overall_result = await db.execute(
        select(func.avg(models.MarketReview.rating), func.count(models.MarketReview.id)).where(
            models.MarketReview.seller_id == seller_id,
            models.MarketReview.status == 'completed',
        )
    )
    overall_avg, overall_count = overall_result.one()

    segments_result = await db.execute(
        select(
            models.MarketItem.item_type,
            func.avg(models.MarketReview.rating),
            func.count(models.MarketReview.id),
        )
        .join(models.MarketItem, models.MarketItem.id == models.MarketReview.item_id)
        .where(
            models.MarketReview.seller_id == seller_id,
            models.MarketReview.status == 'completed',
        )
        .group_by(models.MarketItem.item_type)
    )

    segment_map = {
        'product': {'avg': None, 'count': 0},
        'service': {'avg': None, 'count': 0},
    }

    for item_type, avg_value, count_value in segments_result.all():
        segment_map[item_type] = {
            'avg': round(float(avg_value), 1) if avg_value else None,
            'count': int(count_value or 0),
        }

    return {
        'avg': round(float(overall_avg), 1) if overall_avg else None,
        'count': int(overall_count or 0),
        'product': segment_map['product'],
        'service': segment_map['service'],
    }


async def get_item_reviews(
    db: AsyncSession,
    item_id: int,
    limit: int = 20,
    offset: int = 0,
) -> List[models.MarketReview]:
    result = await db.execute(
        select(models.MarketReview)
        .options(selectinload(models.MarketReview.reviewer))
        .where(
            models.MarketReview.item_id == item_id,
            models.MarketReview.status == 'completed',
        )
        .order_by(models.MarketReview.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()
