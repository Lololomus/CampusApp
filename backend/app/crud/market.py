# ===== 📄 ФАЙЛ: backend/app/crud/market.py =====
# Market CRUD: товары, избранное, категории, просмотры
#
# ✅ Фаза 1.4: Убраны json.loads()/json.dumps() — JSONB-колонки возвращают
#    нативные list/dict.
# ✅ Фаза 3.6: async/await + select() + AsyncSession
# ✅ Фаза 3.6: joinedload → selectinload
# ✅ Фаза 4.4: delete_market_item → soft delete
# ✅ Фаза 5.2: image merge → helpers.merge_images()

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func, or_, update as sa_update
from typing import Optional, List, Dict
from datetime import datetime, timezone
import logging

from app import models, schemas
from app.crud.helpers import sanitize_json_field
from app.crud.users import get_user_by_id
from app.utils import delete_images, process_base64_images

logger = logging.getLogger(__name__)

STANDARD_CATEGORIES = [
    'textbooks',
    'electronics',
    'furniture',
    'clothing',
    'sports',
    'appliances'
]


# ===== СОЗДАНИЕ И ОБНОВЛЕНИЕ =====

async def create_market_item(
    db: AsyncSession,
    item: schemas.MarketItemCreate,
    seller_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.MarketItem:
    """Создать товар на маркетплейсе."""
    seller = await get_user_by_id(db, seller_id)
    if not seller:
        raise ValueError("Продавец не найден")

    # Fallback на base64
    saved_images_meta = images_meta or []
    if not saved_images_meta and item.images and len(item.images) > 0:
        try:
            saved_images_meta = process_base64_images(item.images)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")

    if not saved_images_meta:
        raise ValueError("Минимум 1 фото обязательно")

    db_item = models.MarketItem(
        seller_id=seller_id,
        category=item.category.strip(),
        title=item.title,
        description=item.description,
        price=item.price,
        condition=item.condition,
        location=item.location or f"{seller.university}, {seller.institute}",
        images=saved_images_meta,
        status='active',
        university=seller.university,
        institute=seller.institute
    )

    try:
        db.add(db_item)
        await db.commit()
        await db.refresh(db_item)
        return db_item
    except Exception as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e


async def update_market_item(
    db: AsyncSession,
    item_id: int,
    seller_id: int,
    item_update: schemas.MarketItemUpdate,
    new_images_meta: Optional[List[dict]] = None,
    keep_filenames: Optional[List[str]] = None,
) -> Optional[models.MarketItem]:
    """Update market item (smart image merge)."""
    result = await db.execute(
        select(models.MarketItem).where(
            models.MarketItem.id == item_id,
            models.MarketItem.seller_id == seller_id
        )
    )
    db_item = result.scalar_one_or_none()

    if not db_item:
        return None

    update_data = item_update.model_dump(exclude_unset=True)
    files_to_delete: List[str] = []

    if new_images_meta is not None or keep_filenames is not None:
        # ✅ Фаза 5.2: единый merge_images()
        from app.crud.helpers import merge_images
        final_images, files_to_delete = merge_images(
            old_images=db_item.images,
            new_images_meta=new_images_meta,
            keep_filenames=keep_filenames,
            require_at_least_one=True,
        )
        update_data["images"] = final_images

    update_data = {k: v for k, v in update_data.items() if v is not None}

    for key, value in update_data.items():
        setattr(db_item, key, value)

    db_item.updated_at = datetime.utcnow()

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        if new_images_meta:
            delete_images(new_images_meta)
        raise

    if files_to_delete:
        delete_images(files_to_delete)

    await db.refresh(db_item)
    return db_item


async def delete_market_item(db: AsyncSession, item_id: int, seller_id: int) -> bool:
    """Мягкое удаление товара (✅ Фаза 4.4: soft delete)"""
    result = await db.execute(
        select(models.MarketItem).where(
            models.MarketItem.id == item_id,
            models.MarketItem.seller_id == seller_id
        )
    )
    db_item = result.scalar_one_or_none()

    if not db_item:
        return False

    db_item.is_deleted = True
    db_item.deleted_at = datetime.utcnow()
    db_item.status = 'sold'  # снимаем с витрины

    await db.commit()
    return True


# ===== ПОЛУЧЕНИЕ И ПОИСК =====

async def get_market_items(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    condition: Optional[str] = None,
    university: Optional[str] = None,
    institute: Optional[str] = None,
    campus_id: Optional[str] = None,
    city: Optional[str] = None,
    sort: str = 'newest',
    search: Optional[str] = None,
    current_user_id: Optional[int] = None
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
        search_term = f"%{search}%"
        query = query.where(
            or_(
                models.MarketItem.title.ilike(search_term),
                models.MarketItem.description.ilike(search_term)
            )
        )

    if category and category != 'all':
        query = query.where(models.MarketItem.category == category)

    if price_min is not None:
        query = query.where(models.MarketItem.price >= price_min)

    if price_max is not None:
        query = query.where(models.MarketItem.price <= price_max)

    if condition:
        conditions = condition.split(',')
        query = query.where(models.MarketItem.condition.in_(conditions))

    # === ФИЛЬТРАЦИЯ ПО ЛОКАЦИИ ===
    _joined_seller = False
    if campus_id:
        query = query.join(models.User, models.MarketItem.seller_id == models.User.id).where(
            models.User.campus_id == campus_id
        )
        _joined_seller = True
    elif university and university != 'all':
        query = query.where(models.MarketItem.university == university)
    elif city:
        query = query.join(models.User, models.MarketItem.seller_id == models.User.id).where(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%')
            )
        )
        _joined_seller = True

    if institute and institute != 'all':
        query = query.where(models.MarketItem.institute == institute)

    total = await db.scalar(
        select(func.count()).select_from(query.subquery())
    )

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
        'has_more': skip + limit < (total or 0)
    }


async def get_market_item(db: AsyncSession, item_id: int, user_id: Optional[int] = None) -> Optional[models.MarketItem]:
    """Получить товар по ID. Если user_id — засчитать уникальный просмотр."""
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.seller))
        .where(
            models.MarketItem.id == item_id,
            models.MarketItem.is_deleted == False
        )
    )
    item = result.scalar_one_or_none()

    if item and user_id:
        if item.seller_id != user_id:
            view_check = await db.execute(
                select(models.MarketItemView).where(
                    models.MarketItemView.item_id == item_id,
                    models.MarketItemView.user_id == user_id
                )
            )

            if not view_check.scalar_one_or_none():
                try:
                    new_view = models.MarketItemView(item_id=item_id, user_id=user_id)
                    db.add(new_view)
                    await db.execute(
                        sa_update(models.MarketItem)
                        .where(models.MarketItem.id == item_id)
                        .values(views_count=models.MarketItem.views_count + 1)
                    )
                    await db.commit()
                    await db.refresh(item)
                except Exception:
                    await db.rollback()

    return item


# ===== ИЗБРАННОЕ =====

async def toggle_market_favorite(db: AsyncSession, item_id: int, user_id: int) -> dict:
    """Toggle избранное"""
    fav_result = await db.execute(
        select(models.MarketFavorite).where(
            models.MarketFavorite.item_id == item_id,
            models.MarketFavorite.user_id == user_id
        )
    )
    favorite = fav_result.scalar_one_or_none()

    item = await db.get(models.MarketItem, item_id)
    if not item:
        return {"is_favorited": False, "favorites_count": 0}

    if favorite:
        await db.delete(favorite)
        await db.execute(
            sa_update(models.MarketItem)
            .where(models.MarketItem.id == item_id)
            .values(favorites_count=func.greatest(models.MarketItem.favorites_count - 1, 0))
        )
        await db.commit()
        await db.refresh(item)
        return {"is_favorited": False, "favorites_count": item.favorites_count}
    else:
        new_favorite = models.MarketFavorite(user_id=user_id, item_id=item_id)
        db.add(new_favorite)
        await db.execute(
            sa_update(models.MarketItem)
            .where(models.MarketItem.id == item_id)
            .values(favorites_count=models.MarketItem.favorites_count + 1)
        )
        await db.commit()
        await db.refresh(item)
        return {"is_favorited": True, "favorites_count": item.favorites_count}


async def is_item_favorited(db: AsyncSession, item_id: int, user_id: int) -> bool:
    """Проверка в избранном ли товар"""
    result = await db.execute(
        select(models.MarketFavorite).where(
            models.MarketFavorite.item_id == item_id,
            models.MarketFavorite.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def get_user_favorites(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> List[models.MarketItem]:
    """Список избранных товаров"""
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.seller))
        .join(models.MarketFavorite)
        .where(models.MarketFavorite.user_id == user_id)
        .order_by(models.MarketFavorite.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


async def get_user_market_items(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> List[models.MarketItem]:
    """Мои объявления"""
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.seller_id == user_id)
        .order_by(models.MarketItem.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


# ===== КАТЕГОРИИ =====

async def get_market_categories(db: AsyncSession) -> Dict[str, List[str]]:
    """Список стандартных + популярных кастомных категорий"""
    result = await db.execute(
        select(models.MarketItem.category, func.count(models.MarketItem.id).label('count'))
        .where(~models.MarketItem.category.in_(STANDARD_CATEGORIES))
        .group_by(models.MarketItem.category)
        .order_by(func.count(models.MarketItem.id).desc())
        .limit(10)
    )

    popular_custom = [row[0] for row in result.all()]

    return {
        'standard': STANDARD_CATEGORIES,
        'popular_custom': popular_custom
    }