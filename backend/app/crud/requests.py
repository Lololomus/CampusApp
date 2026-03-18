# ===== 📄 ФАЙЛ: backend/app/crud/requests.py =====
# Requests CRUD: запросы помощи, отклики, автоистечение
#
# ✅ Фаза 1.4: Убраны json.loads()/json.dumps() — JSONB-колонки возвращают
#    нативные list/dict.
# ✅ Фаза 3.5: async/await + select() + AsyncSession
# ✅ Фаза 3.5: joinedload → selectinload

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func, or_, case, update as sa_update
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone

from app import models, schemas
from app.crud.helpers import sanitize_json_field
from app.utils import delete_images, get_image_urls, process_base64_images
from app.services import notification_service as notif


# ===== СОЗДАНИЕ И ПОЛУЧЕНИЕ =====

async def create_request(
    db: AsyncSession,
    request: schemas.RequestCreate,
    author_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.Request:
    """Создать запрос помощи."""
    active_count = await db.scalar(
        select(func.count(models.Request.id)).where(
            models.Request.author_id == author_id,
            models.Request.category == request.category,
            models.Request.status == 'active',
            models.Request.expires_at > datetime.utcnow()
        )
    )

    if (active_count or 0) >= 3:
        raise ValueError(f"Максимум 3 активных запроса в категории {request.category}")

    # Fallback на base64
    saved_images_meta = images_meta or []
    if not saved_images_meta and request.images and len(request.images) > 0:
        try:
            saved_images_meta = process_base64_images(request.images)
        except (ValueError, OSError) as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")

    expires_at = request.expires_at
    if expires_at.tzinfo is not None and expires_at.tzinfo.utcoffset(expires_at) is not None:
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)

    db_request = models.Request(
        author_id=author_id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=sanitize_json_field(request.tags),
        expires_at=expires_at,
        max_responses=request.max_responses,
        status='active',
        reward_type=request.reward_type,
        reward_value=request.reward_value,
        images=sanitize_json_field(saved_images_meta)
    )

    try:
        db.add(db_request)
        await db.commit()
        await db.refresh(db_request)
        return db_request
    except SQLAlchemyError as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e


async def get_requests_feed(
    db: AsyncSession,
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user_id: Optional[int] = None,
    university: Optional[str] = None,
    institute: Optional[str] = None,
    campus_id: Optional[str] = None,
    city: Optional[str] = None,
    status: str = 'active',
    has_reward: Optional[str] = None,
    urgency: Optional[str] = None,
    sort: str = 'newest',
) -> Dict:
    """Лента запросов с фильтрацией"""
    now = datetime.utcnow()
    urgent_threshold = now + timedelta(hours=24)

    query = (
        select(models.Request)
        .options(
            selectinload(models.Request.author),
            selectinload(models.Request.responses),
        )
        .where(models.Request.is_deleted == False)
    )

    # Фильтр по статусу
    if status == 'active':
        query = query.where(
            models.Request.status == 'active',
            models.Request.expires_at > now
        )

    # Фильтр по категории
    if category and category != 'all':
        query = query.where(models.Request.category == category)

    # === ФИЛЬТРАЦИЯ ПО ЛОКАЦИИ (4 уровня) ===
    _joined_user = False
    if campus_id:
        query = query.join(models.User).where(models.User.campus_id == campus_id)
        _joined_user = True
    elif university and university != 'all':
        if hasattr(models.Request, 'university'):
            query = query.where(models.Request.university == university)
        else:
            query = query.join(models.User).where(models.User.university == university)
            _joined_user = True
    elif city:
        query = query.join(models.User).where(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%')
            )
        )
        _joined_user = True

    # Фильтр по институту
    if institute and institute != 'all':
        if hasattr(models.Request, 'institute'):
            query = query.where(models.Request.institute == institute)
        else:
            if not _joined_user:
                query = query.join(models.User)
            query = query.where(models.User.institute == institute)

    # Фильтр по наличию вознаграждения
    if has_reward == 'with':
        query = query.where(
            models.Request.reward_type.isnot(None),
            models.Request.reward_type != ''
        )
    elif has_reward == 'without':
        query = query.where(
            or_(
                models.Request.reward_type.is_(None),
                models.Request.reward_type == ''
            )
        )

    # Фильтр по срочности
    if urgency == 'soon':
        query = query.where(
            models.Request.expires_at > now,
            models.Request.expires_at <= urgent_threshold
        )
    elif urgency == 'later':
        query = query.where(models.Request.expires_at > urgent_threshold)

    # Total count (subquery)
    total = await db.scalar(
        select(func.count()).select_from(query.subquery())
    )

    # Сортировка
    if sort == 'expires_soon':
        query = query.where(models.Request.expires_at > now).order_by(
            models.Request.expires_at.asc()
        )
    elif sort == 'most_responses':
        query = query.order_by(
            models.Request.responses_count.desc(),
            models.Request.created_at.desc()
        )
    else:
        query = query.order_by(
            case(
                (models.Request.expires_at <= urgent_threshold, 0),
                else_=1
            ),
            case(
                (models.Request.expires_at <= urgent_threshold, models.Request.expires_at),
                else_=None
            ),
            models.Request.created_at.desc()
        )

    result = await db.execute(query.offset(offset).limit(limit))
    requests = result.scalars().all()

    items = []
    for req in requests:
        tags = req.tags or []
        images = get_image_urls(req.images) if req.images else []

        req_dict = {
            'id': req.id,
            'category': req.category,
            'title': req.title,
            'body': req.body,
            'tags': tags,
            'expires_at': req.expires_at,
            'status': req.status,
            'views_count': req.views_count,
            'responses_count': len(req.responses) if req.responses else 0,
            'created_at': req.created_at,
            'author': req.author,
            'is_author': req.author_id == current_user_id if current_user_id else False,
            'has_responded': any(r.user_id == current_user_id for r in req.responses) if current_user_id and req.responses else False,
            'reward_type': req.reward_type,
            'reward_value': req.reward_value,
            'images': images
        }
        items.append(req_dict)

    return {
        'items': items,
        'total': total or 0,
        'has_more': offset + limit < (total or 0)
    }


async def get_request_by_id(db: AsyncSession, request_id: int, current_user_id: Optional[int] = None) -> Optional[Dict]:
    result = await db.execute(
        select(models.Request)
        .options(
            selectinload(models.Request.author),
            selectinload(models.Request.responses),
        )
        .where(
            models.Request.id == request_id,
            models.Request.is_deleted == False,
        )
    )
    request = result.scalar_one_or_none()

    if not request:
        return None

    await db.execute(
        sa_update(models.Request)
        .where(models.Request.id == request_id)
        .values(views_count=models.Request.views_count + 1)
    )
    await db.commit()
    await db.refresh(request)

    tags = request.tags or []
    images = get_image_urls(request.images) if request.images else []

    return {
        'id': request.id,
        'category': request.category,
        'title': request.title,
        'body': request.body,
        'tags': tags,
        'expires_at': request.expires_at,
        'status': request.status,
        'views_count': request.views_count,
        'responses_count': len(request.responses) if request.responses else 0,
        'created_at': request.created_at,
        'author': request.author,
        'is_author': request.author_id == current_user_id if current_user_id else False,
        'has_responded': any(r.user_id == current_user_id for r in request.responses) if current_user_id and request.responses else False,
        'reward_type': request.reward_type,
        'reward_value': request.reward_value,
        'images': images
    }


# ===== ОБНОВЛЕНИЕ И УДАЛЕНИЕ =====

async def update_request(db: AsyncSession, request_id: int, user_id: int, data: schemas.RequestUpdate) -> Optional[models.Request]:
    result = await db.execute(
        select(models.Request).where(
            models.Request.id == request_id,
            models.Request.author_id == user_id
        )
    )
    request = result.scalar_one_or_none()

    if not request:
        raise ValueError("Запрос не найден или нет прав")

    update_data = data.model_dump(exclude_unset=True)

    if 'tags' in update_data:
        update_data['tags'] = sanitize_json_field(update_data['tags'])

    for key, value in update_data.items():
        setattr(request, key, value)

    request.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(request)
    return request


async def delete_request(db: AsyncSession, request_id: int, user_id: int) -> bool:
    """Мягкое удаление запроса (✅ Фаза 4.4: soft delete)"""
    result = await db.execute(
        select(models.Request).where(
            models.Request.id == request_id,
            models.Request.author_id == user_id
        )
    )
    request = result.scalar_one_or_none()

    if not request:
        raise ValueError("Request not found or no permissions")

    request.is_deleted = True
    request.deleted_at = datetime.utcnow()
    request.status = 'closed'

    await db.commit()
    return True


async def get_my_requests(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> List[models.Request]:
    result = await db.execute(
        select(models.Request)
        .options(selectinload(models.Request.responses))
        .where(models.Request.author_id == user_id)
        .order_by(models.Request.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


# ===== ОТКЛИКИ =====

async def create_response(db: AsyncSession, request_id: int, user_id: int, data: schemas.ResponseCreate) -> models.RequestResponse:
    request = await db.get(models.Request, request_id)
    if not request:
        raise ValueError("Запрос не найден")

    if request.status != 'active' or request.expires_at < datetime.utcnow():
        raise ValueError("Запрос закрыт или истёк")

    if request.author_id == user_id:
        raise ValueError("Нельзя откликнуться на свой запрос")

    existing_result = await db.execute(
        select(models.RequestResponse).where(
            models.RequestResponse.request_id == request_id,
            models.RequestResponse.user_id == user_id
        )
    )
    if existing_result.scalar_one_or_none():
        raise ValueError("Вы уже откликнулись на этот запрос")

    user = await db.get(models.User, user_id)
    telegram = data.telegram_contact or (user.username if user else None)

    response = models.RequestResponse(
        request_id=request_id,
        user_id=user_id,
        message=data.message,
        telegram_contact=telegram
    )
    db.add(response)

    await db.execute(
        sa_update(models.Request)
        .where(models.Request.id == request_id)
        .values(responses_count=models.Request.responses_count + 1)
    )

    await notif.notify_request_response(db, request, user)

    await db.commit()
    await db.refresh(response)
    return response


async def get_request_responses(db: AsyncSession, request_id: int, user_id: int) -> List[models.RequestResponse]:
    result = await db.execute(
        select(models.Request).where(
            models.Request.id == request_id,
            models.Request.author_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise ValueError("Запрос не найден или нет прав")

    resp_result = await db.execute(
        select(models.RequestResponse)
        .options(selectinload(models.RequestResponse.author))
        .where(models.RequestResponse.request_id == request_id)
        .order_by(models.RequestResponse.created_at.desc())
    )
    return resp_result.scalars().all()


async def delete_response(db: AsyncSession, response_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(models.RequestResponse).where(
            models.RequestResponse.id == response_id,
            models.RequestResponse.user_id == user_id
        )
    )
    response = result.scalar_one_or_none()

    if not response:
        raise ValueError("Отклик не найден или нет прав")

    request = await db.get(models.Request, response.request_id)
    if request:
        await db.execute(
            sa_update(models.Request)
            .where(models.Request.id == request.id)
            .values(responses_count=func.greatest(models.Request.responses_count - 1, 0))
        )

    await db.delete(response)
    await db.commit()
    return True


# ===== АВТОИСТЕЧЕНИЕ =====

async def auto_expire_requests(db: AsyncSession) -> int:
    """Bulk expire — один UPDATE вместо цикла (Фаза 4 preview)."""
    result = await db.execute(
        sa_update(models.Request)
        .where(
            models.Request.status == 'active',
            models.Request.expires_at <= datetime.utcnow()
        )
        .values(status='expired')
    )
    await db.commit()
    return result.rowcount


async def get_responses_count(db: AsyncSession, user_id: int, category: Optional[str] = None) -> int:
    query = select(func.sum(models.Request.responses_count)).where(
        models.Request.author_id == user_id,
        models.Request.status == 'active'
    )

    if category:
        query = query.where(models.Request.category == category)

    result = await db.scalar(query)
    return result if result else 0
