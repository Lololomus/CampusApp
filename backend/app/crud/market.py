# ===== 📄 ФАЙЛ: backend/app/crud/market.py =====
# Market CRUD: товары, избранное, категории, просмотры
#
# ⚠️ ИСПРАВЛЕНО: create_market_item и update_market_item были async def
#    с sync DB-вызовами. Теперь они sync.

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, update as sa_update
from typing import Optional, List, Dict
from datetime import datetime, timezone
import json

from app import models, schemas
from app.crud.helpers import sanitize_json_field
from app.crud.users import get_user_by_id
from app.utils import delete_images, get_storage_key, process_base64_images


STANDARD_CATEGORIES = [
    'textbooks',
    'electronics',
    'furniture',
    'clothing',
    'sports',
    'appliances'
]


# ===== СОЗДАНИЕ И ОБНОВЛЕНИЕ =====

def create_market_item(
    db: Session,
    item: schemas.MarketItemCreate,
    seller_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.MarketItem:
    """
    Создать товар на маркетплейсе.

    ⚠️ images_meta — уже обработанные файлы. Пример вызова из endpoint:

        images_meta = []
        if uploaded_files:
            images_meta = await process_uploaded_files(uploaded_files)
        elif item.images:
            images_meta = process_base64_images(item.images)
        db_item = crud.create_market_item(db, item, user.id, images_meta=images_meta)
    """
    seller = get_user_by_id(db, seller_id)
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
        images=sanitize_json_field(saved_images_meta),
        status='active',
        university=seller.university,
        institute=seller.institute
    )

    try:
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item
    except Exception as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e


def update_market_item(
    db: Session,
    item_id: int,
    seller_id: int,
    item_update: schemas.MarketItemUpdate,
    new_images_meta: Optional[List[dict]] = None,
    keep_filenames: Optional[List[str]] = None,
) -> Optional[models.MarketItem]:
    """
    Update market item (smart image merge).

    `new_images_meta` contains files already processed by the endpoint.
    """
    db_item = db.query(models.MarketItem).filter(
        models.MarketItem.id == item_id,
        models.MarketItem.seller_id == seller_id
    ).first()

    if not db_item:
        return None

    update_data = item_update.model_dump(exclude_unset=True)
    files_to_delete: List[str] = []

    if new_images_meta is not None or keep_filenames is not None:
        raw_old_images = json.loads(db_item.images) if db_item.images else []
        old_images_map: Dict[str, dict] = {}
        for img in raw_old_images:
            if isinstance(img, str):
                key = get_storage_key(img, kind="images")
                if key:
                    old_images_map[key] = {"url": key, "w": 1000, "h": 1000}
            elif isinstance(img, dict):
                key = get_storage_key(img.get("url", ""), kind="images")
                if key:
                    normalized_img = dict(img)
                    normalized_img["url"] = key
                    normalized_img.setdefault("w", 1000)
                    normalized_img.setdefault("h", 1000)
                    old_images_map[key] = normalized_img

        final_images_meta: List[dict] = []

        if keep_filenames:
            for fname in keep_filenames:
                key = get_storage_key(fname, kind="images")
                if key and key in old_images_map:
                    final_images_meta.append(old_images_map[key])

        if new_images_meta:
            final_images_meta.extend(new_images_meta)

        if not final_images_meta:
            raise ValueError("At least one image is required")

        kept_urls = {get_storage_key(img.get("url", ""), kind="images") for img in final_images_meta}
        kept_urls.discard("")
        files_to_delete = [url for url in old_images_map if url not in kept_urls]

        update_data["images"] = sanitize_json_field(final_images_meta)

    update_data = {k: v for k, v in update_data.items() if v is not None}

    for key, value in update_data.items():
        setattr(db_item, key, value)

    db_item.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except Exception:
        db.rollback()
        if new_images_meta:
            delete_images(new_images_meta)
        raise

    if files_to_delete:
        delete_images(files_to_delete)

    db.refresh(db_item)
    return db_item

def delete_market_item(db: Session, item_id: int, seller_id: int) -> bool:
    """Удаление товара (только продавец)"""
    db_item = db.query(models.MarketItem).filter(
        models.MarketItem.id == item_id,
        models.MarketItem.seller_id == seller_id
    ).first()

    if not db_item:
        return False

    if db_item.images:
        try:
            images_data = json.loads(db_item.images)
            delete_images(images_data)
        except Exception as e:
            print(f"⚠️ Ошибка удаления изображений товара {item_id}: {e}")

    db.delete(db_item)
    db.commit()
    return True


# ===== ПОЛУЧЕНИЕ И ПОИСК =====

def get_market_items(
    db: Session,
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
    query = db.query(models.MarketItem).options(joinedload(models.MarketItem.seller))

    query = query.filter(models.MarketItem.status == 'active')
    query = query.filter(models.MarketItem.is_deleted == False)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.MarketItem.title.ilike(search_term),
                models.MarketItem.description.ilike(search_term)
            )
        )

    if category and category != 'all':
        query = query.filter(models.MarketItem.category == category)

    if price_min is not None:
        query = query.filter(models.MarketItem.price >= price_min)

    if price_max is not None:
        query = query.filter(models.MarketItem.price <= price_max)

    if condition:
        conditions = condition.split(',')
        query = query.filter(models.MarketItem.condition.in_(conditions))

    # === ФИЛЬТРАЦИЯ ПО ЛОКАЦИИ ===
    _joined_seller = False
    if campus_id:
        query = query.join(models.User, models.MarketItem.seller_id == models.User.id).filter(
            models.User.campus_id == campus_id
        )
        _joined_seller = True
    elif university and university != 'all':
        query = query.filter(models.MarketItem.university == university)
    elif city:
        query = query.join(models.User, models.MarketItem.seller_id == models.User.id).filter(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%')
            )
        )
        _joined_seller = True

    if institute and institute != 'all':
        query = query.filter(models.MarketItem.institute == institute)

    total = query.count()

    if sort == 'price_asc':
        query = query.order_by(models.MarketItem.price.asc())
    elif sort == 'price_desc':
        query = query.order_by(models.MarketItem.price.desc())
    elif sort == 'oldest':
        query = query.order_by(models.MarketItem.created_at.asc())
    else:
        query = query.order_by(models.MarketItem.created_at.desc())

    items = query.offset(skip).limit(limit).all()

    return {
        'items': items,
        'total': total,
        'has_more': skip + limit < total
    }


def get_market_item(db: Session, item_id: int, user_id: Optional[int] = None) -> Optional[models.MarketItem]:
    """Получить товар по ID. Если user_id — засчитать уникальный просмотр."""
    item = db.query(models.MarketItem).options(
        joinedload(models.MarketItem.seller)
    ).filter(
        models.MarketItem.id == item_id,
        models.MarketItem.is_deleted == False
    ).first()

    if item and user_id:
        if item.seller_id != user_id:
            has_viewed = db.query(models.MarketItemView).filter(
                models.MarketItemView.item_id == item_id,
                models.MarketItemView.user_id == user_id
            ).first()

            if not has_viewed:
                try:
                    new_view = models.MarketItemView(item_id=item_id, user_id=user_id)
                    db.add(new_view)
                    db.execute(
                        sa_update(models.MarketItem)
                        .where(models.MarketItem.id == item_id)
                        .values(views_count=models.MarketItem.views_count + 1)
                    )
                    db.commit()
                    db.refresh(item)
                except Exception:
                    db.rollback()

    return item


# ===== ИЗБРАННОЕ =====

def toggle_market_favorite(db: Session, item_id: int, user_id: int) -> dict:
    """Toggle избранное"""
    favorite = db.query(models.MarketFavorite).filter(
        models.MarketFavorite.item_id == item_id,
        models.MarketFavorite.user_id == user_id
    ).first()

    item = db.query(models.MarketItem).filter(models.MarketItem.id == item_id).first()
    if not item:
        return {"is_favorited": False, "favorites_count": 0}

    if favorite:
        db.delete(favorite)
        db.execute(
            sa_update(models.MarketItem)
            .where(models.MarketItem.id == item_id)
            .values(favorites_count=func.greatest(models.MarketItem.favorites_count - 1, 0))
        )
        db.commit()
        item = db.query(models.MarketItem).filter(models.MarketItem.id == item_id).first()
        return {"is_favorited": False, "favorites_count": item.favorites_count}
    else:
        new_favorite = models.MarketFavorite(user_id=user_id, item_id=item_id)
        db.add(new_favorite)
        db.execute(
            sa_update(models.MarketItem)
            .where(models.MarketItem.id == item_id)
            .values(favorites_count=models.MarketItem.favorites_count + 1)
        )
        db.commit()
        item = db.query(models.MarketItem).filter(models.MarketItem.id == item_id).first()
        return {"is_favorited": True, "favorites_count": item.favorites_count}


def is_item_favorited(db: Session, item_id: int, user_id: int) -> bool:
    """Проверка в избранном ли товар"""
    favorite = db.query(models.MarketFavorite).filter(
        models.MarketFavorite.item_id == item_id,
        models.MarketFavorite.user_id == user_id
    ).first()
    return favorite is not None


def get_user_favorites(db: Session, user_id: int, limit: int = 20, offset: int = 0) -> List[models.MarketItem]:
    """Список избранных товаров"""
    return (
        db.query(models.MarketItem)
        .options(joinedload(models.MarketItem.seller))
        .join(models.MarketFavorite)
        .filter(models.MarketFavorite.user_id == user_id)
        .order_by(models.MarketFavorite.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_user_market_items(db: Session, user_id: int, limit: int = 20, offset: int = 0) -> List[models.MarketItem]:
    """Мои объявления"""
    return (
        db.query(models.MarketItem)
        .filter(models.MarketItem.seller_id == user_id)
        .order_by(models.MarketItem.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


# ===== КАТЕГОРИИ =====

def get_market_categories(db: Session) -> Dict[str, List[str]]:
    """Список стандартных + популярных кастомных категорий"""
    custom_categories = (
        db.query(models.MarketItem.category, func.count(models.MarketItem.id).label('count'))
        .filter(~models.MarketItem.category.in_(STANDARD_CATEGORIES))
        .group_by(models.MarketItem.category)
        .order_by(func.count(models.MarketItem.id).desc())
        .limit(10)
        .all()
    )

    popular_custom = [cat[0] for cat in custom_categories]

    return {
        'standard': STANDARD_CATEGORIES,
        'popular_custom': popular_custom
    }