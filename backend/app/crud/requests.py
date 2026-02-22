# ===== 📄 ФАЙЛ: backend/app/crud/requests.py =====
# Requests CRUD: запросы помощи, отклики, автоистечение
#
# ⚠️ ИСПРАВЛЕНО: create_request был async def с sync DB-вызовами.

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, case, update as sa_update
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import json

from app import models, schemas
from app.crud.helpers import sanitize_json_field
from app.utils import delete_images, get_image_urls, process_base64_images
from app.services import notification_service as notif


# ===== СОЗДАНИЕ И ПОЛУЧЕНИЕ =====

def create_request(
    db: Session,
    request: schemas.RequestCreate,
    author_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.Request:
    """
    Создать запрос помощи.

    ⚠️ images_meta — уже обработанные файлы. Пример вызова из endpoint:

        images_meta = []
        if uploaded_files:
            images_meta = await process_uploaded_files(uploaded_files)
        elif request_data.images:
            images_meta = process_base64_images(request_data.images)
        db_request = crud.create_request(db, request_data, user.id, images_meta=images_meta)
    """
    active_count = db.query(models.Request).filter(
        models.Request.author_id == author_id,
        models.Request.category == request.category,
        models.Request.status == 'active',
        models.Request.expires_at > datetime.now(timezone.utc)
    ).count()

    if active_count >= 3:
        raise ValueError(f"Максимум 3 активных запроса в категории {request.category}")

    # Fallback на base64
    saved_images_meta = images_meta or []
    if not saved_images_meta and request.images and len(request.images) > 0:
        try:
            saved_images_meta = process_base64_images(request.images)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")

    db_request = models.Request(
        author_id=author_id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=sanitize_json_field(request.tags),
        expires_at=request.expires_at,
        max_responses=request.max_responses,
        status='active',
        reward_type=request.reward_type,
        reward_value=request.reward_value,
        images=sanitize_json_field(saved_images_meta)
    )

    try:
        db.add(db_request)
        db.commit()
        db.refresh(db_request)
        return db_request
    except Exception as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e


def get_requests_feed(
    db: Session,
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
    now = datetime.now(timezone.utc)
    urgent_threshold = now + timedelta(hours=24)

    query = db.query(models.Request).options(
        joinedload(models.Request.author)
    )
    query = query.filter(models.Request.is_deleted == False)

    # Фильтр по статусу
    if status == 'active':
        query = query.filter(
            models.Request.status == 'active',
            models.Request.expires_at > now
        )

    # Фильтр по категории
    if category and category != 'all':
        query = query.filter(models.Request.category == category)

    # === ФИЛЬТРАЦИЯ ПО ЛОКАЦИИ (4 уровня) ===
    _joined_user = False
    if campus_id:
        query = query.join(models.User).filter(models.User.campus_id == campus_id)
        _joined_user = True
    elif university and university != 'all':
        if hasattr(models.Request, 'university'):
            query = query.filter(models.Request.university == university)
        else:
            query = query.join(models.User).filter(models.User.university == university)
            _joined_user = True
    elif city:
        query = query.join(models.User).filter(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%')
            )
        )
        _joined_user = True

    # Фильтр по институту
    if institute and institute != 'all':
        if hasattr(models.Request, 'institute'):
            query = query.filter(models.Request.institute == institute)
        else:
            if not _joined_user:
                query = query.join(models.User)
            query = query.filter(models.User.institute == institute)

    # Фильтр по наличию вознаграждения
    if has_reward == 'with':
        query = query.filter(
            models.Request.reward_type.isnot(None),
            models.Request.reward_type != ''
        )
    elif has_reward == 'without':
        query = query.filter(
            or_(
                models.Request.reward_type.is_(None),
                models.Request.reward_type == ''
            )
        )

    # Фильтр по срочности
    if urgency == 'soon':
        query = query.filter(
            models.Request.expires_at > now,
            models.Request.expires_at <= urgent_threshold
        )
    elif urgency == 'later':
        query = query.filter(models.Request.expires_at > urgent_threshold)

    total = query.count()

    # Сортировка
    if sort == 'expires_soon':
        query = query.filter(models.Request.expires_at > now).order_by(
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

    requests = query.offset(offset).limit(limit).all()

    result = []
    for req in requests:
        tags = json.loads(req.tags) if req.tags else []
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
        result.append(req_dict)

    return {
        'items': result,
        'total': total,
        'has_more': offset + limit < total
    }


def get_request_by_id(db: Session, request_id: int, current_user_id: Optional[int] = None) -> Optional[Dict]:
    request = db.query(models.Request).options(
        joinedload(models.Request.author),
        joinedload(models.Request.responses)
    ).filter(models.Request.id == request_id).first()

    if not request:
        return None

    db.execute(
        sa_update(models.Request)
        .where(models.Request.id == request_id)
        .values(views_count=models.Request.views_count + 1)
    )
    db.commit()
    db.refresh(request)

    tags = json.loads(request.tags) if request.tags else []
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

def update_request(db: Session, request_id: int, user_id: int, data: schemas.RequestUpdate) -> Optional[models.Request]:
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()

    if not request:
        raise ValueError("Запрос не найден или нет прав")

    update_data = data.model_dump(exclude_unset=True)

    if 'tags' in update_data:
        update_data['tags'] = sanitize_json_field(update_data['tags'])

    for key, value in update_data.items():
        setattr(request, key, value)

    request.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request


def delete_request(db: Session, request_id: int, user_id: int) -> bool:
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()

    if not request:
        raise ValueError("Request not found or no permissions")

    if request.images:
        try:
            images_data = json.loads(request.images)
            delete_images(images_data)
        except Exception:
            pass

    db.delete(request)
    db.commit()
    return True

def get_my_requests(db: Session, user_id: int, limit: int = 20, offset: int = 0) -> List[models.Request]:
    return db.query(models.Request).options(
        joinedload(models.Request.responses)
    ).filter(
        models.Request.author_id == user_id
    ).order_by(models.Request.created_at.desc()).limit(limit).offset(offset).all()


# ===== ОТКЛИКИ =====

def create_response(db: Session, request_id: int, user_id: int, data: schemas.ResponseCreate) -> models.RequestResponse:
    request = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not request:
        raise ValueError("Запрос не найден")

    if request.status != 'active' or request.expires_at < datetime.now(timezone.utc):
        raise ValueError("Запрос закрыт или истёк")

    if request.author_id == user_id:
        raise ValueError("Нельзя откликнуться на свой запрос")

    existing = db.query(models.RequestResponse).filter(
        models.RequestResponse.request_id == request_id,
        models.RequestResponse.user_id == user_id
    ).first()

    if existing:
        raise ValueError("Вы уже откликнулись на этот запрос")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    telegram = data.telegram_contact or user.username

    response = models.RequestResponse(
        request_id=request_id,
        user_id=user_id,
        message=data.message,
        telegram_contact=telegram
    )
    db.add(response)

    db.execute(
        sa_update(models.Request)
        .where(models.Request.id == request_id)
        .values(responses_count=models.Request.responses_count + 1)
    )

    notif.notify_request_response(db, request, user)

    db.commit()
    db.refresh(response)
    return response


def get_request_responses(db: Session, request_id: int, user_id: int) -> List[models.RequestResponse]:
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()

    if not request:
        raise ValueError("Запрос не найден или нет прав")

    return db.query(models.RequestResponse).options(
        joinedload(models.RequestResponse.author)
    ).filter(
        models.RequestResponse.request_id == request_id
    ).order_by(models.RequestResponse.created_at.desc()).all()


def delete_response(db: Session, response_id: int, user_id: int) -> bool:
    response = db.query(models.RequestResponse).filter(
        models.RequestResponse.id == response_id,
        models.RequestResponse.user_id == user_id
    ).first()

    if not response:
        raise ValueError("Отклик не найден или нет прав")

    request = db.query(models.Request).filter(models.Request.id == response.request_id).first()
    if request:
        db.execute(
            sa_update(models.Request)
            .where(models.Request.id == request.id)
            .values(responses_count=func.greatest(models.Request.responses_count - 1, 0))
        )

    db.delete(response)
    db.commit()
    return True


# ===== АВТОИСТЕЧЕНИЕ =====

def auto_expire_requests(db: Session):
    expired = db.query(models.Request).filter(
        models.Request.status == 'active',
        models.Request.expires_at <= datetime.now(timezone.utc)
    ).all()

    for request in expired:
        request.status = 'expired'

    db.commit()
    return len(expired)


def get_responses_count(db: Session, user_id: int, category: Optional[str] = None) -> int:
    query = db.query(func.sum(models.Request.responses_count)).filter(
        models.Request.author_id == user_id,
        models.Request.status == 'active'
    )

    if category:
        query = query.filter(models.Request.category == category)

    result = query.scalar()
    return result if result else 0