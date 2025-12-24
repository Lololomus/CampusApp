from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, not_, func
from app import models, schemas
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import json


# ===== USER CRUD =====

def get_user_by_telegram_id(db: Session, telegram_id: int) -> Optional[models.User]:
    """Найти пользователя по Telegram ID"""
    return db.query(models.User).filter(models.User.telegram_id == telegram_id).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    """Найти пользователя по ID"""
    return db.query(models.User).filter(models.User.id == user_id).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    """Создать нового пользователя"""
    db_user = models.User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate) -> Optional[models.User]:
    """Обновить данные пользователя"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    
    # Обновляем только те поля, которые переданы
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Обрабатываем interests (список -> JSON строка)
    if 'interests' in update_data:
        update_data['interests'] = json.dumps(update_data['interests'])
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user


# ===== POST CRUD =====

def get_posts(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    university: Optional[str] = None,
    course: Optional[int] = None
) -> List[models.Post]:
    """Получить список постов с фильтрами"""
    query = db.query(models.Post).options(joinedload(models.Post.author))
    
    # Исключаем expired посты (для lost_found)
    query = query.filter(
        or_(
            models.Post.expires_at == None,
            models.Post.expires_at > datetime.utcnow()
        )
    )
    
    # Фильтры
    if category and category != "all":
        query = query.filter(models.Post.category == category)
    if university and university != "all":
        query = query.filter(models.Post.university == university)
    if course and course != "all":
        query = query.filter(models.Post.course == course)
    
    # Сортировка: важные первые, потом по дате
    return query.order_by(
        models.Post.is_important.desc(),
        models.Post.created_at.desc()
    ).offset(skip).limit(limit).all()


def get_post(db: Session, post_id: int) -> Optional[models.Post]:
    """Получить пост по ID"""
    return db.query(models.Post).filter(models.Post.id == post_id).first()


def create_post(db: Session, post: schemas.PostCreate, author_id: int) -> models.Post:
    """Создать новый пост"""
    
    # Базовые данные
    db_post = models.Post(
        author_id=author_id,
        category=post.category,
        title=post.title,
        body=post.body,
        tags=json.dumps(post.tags) if post.tags else None,
        
        # Анонимность
        is_anonymous=post.is_anonymous,
        enable_anonymous_comments=post.enable_anonymous_comments,
        
        # Lost & Found
        lost_or_found=post.lost_or_found,
        item_description=post.item_description,
        location=post.location,
        
        # Events
        event_name=post.event_name,
        event_date=post.event_date,
        event_location=post.event_location,
        
        # News
        is_important=post.is_important,
    )
    
    # Автоматическое expires_at для lost_found (7 дней)
    if post.category == 'lost_found':
        db_post.expires_at = datetime.utcnow() + timedelta(days=7)
    
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


def update_post(db: Session, post_id: int, post_update: schemas.PostUpdate) -> Optional[models.Post]:
    """Обновить пост"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return None
    
    update_data = post_update.model_dump(exclude_unset=True)
    
    # Отдельно обрабатываем теги
    if "tags" in update_data:
        update_data['tags'] = json.dumps(update_data['tags'])
    
    # Обновляем остальные поля
    for key, value in update_data.items():
        setattr(db_post, key, value)
    
    db.commit()
    db.refresh(db_post)
    return db_post


def delete_post(db: Session, post_id: int) -> bool:
    """Удалить пост"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return False
    
    db.delete(db_post)
    db.commit()
    return True


def increment_post_views(db: Session, post_id: int):
    """Увеличить счётчик просмотров"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if db_post:
        db_post.views_count += 1
        db.commit()


# ===== POST LIKES (Лайки постов) =====

def is_post_liked_by_user(db: Session, post_id: int, user_id: int) -> bool:
    """Проверить лайкнул ли пользователь пост"""
    like = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == user_id
    ).first()
    return like is not None


def toggle_post_like(db: Session, post_id: int, user_id: int) -> dict:
    """Toggle лайка (добавить или убрать)"""
    like = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == user_id
    ).first()
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return {"is_liked": False, "likes": 0}
    
    if like:
        # Убираем лайк
        db.delete(like)
        post.likes_count = max(0, post.likes_count - 1)
        db.commit()
        return {"is_liked": False, "likes": post.likes_count}
    else:
        # Добавляем лайк
        new_like = models.PostLike(user_id=user_id, post_id=post_id)
        db.add(new_like)
        post.likes_count += 1
        db.commit()
        return {"is_liked": True, "likes": post.likes_count}


# ===== COMMENT CRUD =====

def get_post_comments(db: Session, post_id: int, user_id: Optional[int] = None) -> List[models.Comment]:
    """
    Получить все комментарии к посту с авторами.
    Для анонимных комментариев автор будет замаскирован на уровне schemas.
    """
    comments = db.query(models.Comment)\
        .options(joinedload(models.Comment.author))\
        .filter(models.Comment.post_id == post_id)\
        .order_by(models.Comment.created_at)\
        .all()
    
    # Проверяем лайки текущего пользователя (если есть)
    if user_id:
        for comment in comments:
            comment.is_liked = is_comment_liked_by_user(db, comment.id, user_id)
    else:
        for comment in comments:
            comment.is_liked = False
    
    return comments


def create_comment(db: Session, comment: schemas.CommentCreate, author_id: int) -> models.Comment:
    """Создать комментарий с поддержкой анонимности"""
    # Получаем пост
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    if not post:
        return None
    
    # Определяем анонимность
    is_anonymous = comment.is_anonymous
    if post.enable_anonymous_comments:
        is_anonymous = True  # Принудительная анонимность
    
    # Определяем anonymous_index (если анонимный)
    anonymous_index = None
    if is_anonymous:
        # Получаем уникальных анонимных комментаторов
        existing_anon_comments = (
            db.query(models.Comment)
            .filter(
                models.Comment.post_id == comment.post_id,
                models.Comment.is_anonymous == True
            )
            .all()
        )
        
        # Проверяем был ли этот автор уже анонимным комментатором
        for existing in existing_anon_comments:
            if existing.author_id == author_id:
                anonymous_index = existing.anonymous_index
                break
        
        # Если нет — присваиваем новый индекс
        if anonymous_index is None:
            max_index = max([c.anonymous_index for c in existing_anon_comments if c.anonymous_index], default=0)
            anonymous_index = max_index + 1
    
    db_comment = models.Comment(
        post_id=comment.post_id,
        author_id=author_id,
        parent_id=comment.parent_id,
        body=comment.body,
        is_anonymous=is_anonymous,
        anonymous_index=anonymous_index
    )
    
    # Увеличиваем счётчик комментариев
    post.comments_count += 1
    
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


# ===== COMMENT LIKES (Лайки комментариев) =====

def is_comment_liked_by_user(db: Session, comment_id: int, user_id: int) -> bool:
    """Проверить лайкнул ли пользователь комментарий"""
    like = db.query(models.CommentLike).filter(
        models.CommentLike.comment_id == comment_id,
        models.CommentLike.user_id == user_id
    ).first()
    return like is not None


def toggle_comment_like(db: Session, comment_id: int, user_id: int) -> dict:
    """Toggle лайка комментария (добавить или убрать)"""
    like = db.query(models.CommentLike).filter(
        models.CommentLike.comment_id == comment_id,
        models.CommentLike.user_id == user_id
    ).first()
    
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"is_liked": False, "likes": 0}
    
    if like:
        # Убираем лайк
        db.delete(like)
        comment.likes_count = max(0, comment.likes_count - 1)
        db.commit()
        return {"is_liked": False, "likes": comment.likes_count}
    else:
        # Добавляем лайк
        new_like = models.CommentLike(user_id=user_id, comment_id=comment_id)
        db.add(new_like)
        comment.likes_count += 1
        db.commit()
        return {"is_liked": True, "likes": comment.likes_count}


def delete_comment(db: Session, comment_id: int, user_id: int) -> dict:
    """Удалить комментарий (hard delete если нет ответов, soft delete если есть)"""
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"success": False, "error": "Комментарий не найден"}
    
    if comment.author_id != user_id:
        return {"success": False, "error": "Нет прав"}
    
    # Получаем пост для обновления счётчика
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    
    has_replies = db.query(models.Comment).filter(
        models.Comment.parent_id == comment_id
    ).count() > 0
    
    if has_replies:
        # Soft delete - НЕ уменьшаем счётчик (комментарий остаётся)
        comment.is_deleted = True
        comment.body = "Комментарий удалён"
        db.commit()
        return {"success": True, "type": "soft_delete"}
    else:
        # Hard delete - УМЕНЬШАЕМ счётчик
        db.delete(comment)
        if post:
            post.comments_count = max(0, post.comments_count - 1)
        db.commit()
        return {"success": True, "type": "hard_delete"}


def update_comment(db: Session, comment_id: int, text: str, user_id: int) -> Optional[models.Comment]:
    """Обновить текст комментария"""
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return None
    
    # Проверка прав (только автор может редактировать)
    if comment.author_id != user_id:
        return None
    
    # Нельзя редактировать удалённые комментарии
    if comment.is_deleted:
        return None
    
    # Обновляем текст
    comment.body = text
    comment.is_edited = True
    db.commit()
    db.refresh(comment)
    return comment


def create_comment(db: Session, comment: schemas.CommentCreate, author_id: int) -> models.Comment:
    """Создать комментарий"""
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    if not post:
        return None
    
    # Анонимность
    is_anonymous = comment.is_anonymous
    if post.enable_anonymous_comments:
        is_anonymous = True
    
    # Генерация anonymous_index
    anonymous_index = None
    if is_anonymous:
        existing_anon_comments = db.query(models.Comment)\
            .filter(
                models.Comment.post_id == comment.post_id,
                models.Comment.is_anonymous == True
            ).all()
        
        for existing in existing_anon_comments:
            if existing.author_id == author_id:
                anonymous_index = existing.anonymous_index
                break
        
        if anonymous_index is None:
            max_index = max([c.anonymous_index for c in existing_anon_comments if c.anonymous_index], default=0)
            anonymous_index = max_index + 1
    
    db_comment = models.Comment(
        post_id=comment.post_id,
        author_id=author_id,
        body=comment.body,
        parent_id=comment.parent_id,
        is_anonymous=is_anonymous,
        anonymous_index=anonymous_index
    )
    
    post.comments_count += 1
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


def count_post_comments(db: Session, post_id: int) -> int:
    """Посчитать количество НЕудалённых комментариев к посту (включая ответы)."""
    return db.query(models.Comment).filter(
        models.Comment.post_id == post_id,
        models.Comment.is_deleted == False
    ).count()


def get_user_posts(db: Session, user_id: int, limit: int = 5, offset: int = 0) -> List[models.Post]:
    """Получить посты пользователя"""
    return db.query(models.Post)\
        .filter(models.Post.author_id == user_id)\
        .order_by(models.Post.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()


def count_user_posts(db: Session, user_id: int) -> int:
    """Посчитать количество постов пользователя"""
    return db.query(models.Post)\
        .filter(models.Post.author_id == user_id)\
        .count()


def count_user_comments(db: Session, user_id: int) -> int:
    """Посчитать количество комментариев пользователя"""
    return db.query(models.Comment)\
        .filter(
            models.Comment.author_id == user_id,
            models.Comment.is_deleted == False
        )\
        .count()


# ===== COOLDOWN для критичных полей =====

def can_edit_critical_fields(db: Session, user_id: int) -> bool:
    """Проверка можно ли редактировать критичные поля (cooldown 30 дней)"""
    user = get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return True  # первое редактирование или пользователь не найден
    
    days_passed = (datetime.utcnow() - user.last_profile_edit).days
    return days_passed >= 30


def get_cooldown_days_left(db: Session, user_id: int) -> int:
    """Сколько дней осталось до снятия cooldown"""
    user = get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return 0
    
    days_passed = (datetime.utcnow() - user.last_profile_edit).days
    return max(0, 30 - days_passed)


# ===== REQUEST CRUD (НОВОЕ) =====

def create_request(db: Session, request: schemas.RequestCreate, author_id: int) -> models.Request:
    """Создать запрос (для карточек dating)"""
    db_request = models.Request(
        author_id=author_id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=json.dumps(request.tags) if request.tags else None,
        expires_at=request.expires_at,
        max_responses=request.max_responses,
        status='active'
    )
    
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request


def get_active_requests(
    db: Session,
    category: str,
    limit: int = 20,
    offset: int = 0
) -> List[models.Request]:
    """Получить активные запросы категории"""
    return (
        db.query(models.Request)
        .options(joinedload(models.Request.author))
        .filter(
            models.Request.category == category,
            models.Request.status == 'active',
            models.Request.expires_at > datetime.utcnow()
        )
        .order_by(models.Request.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_people_with_requests(
    db: Session,
    user_id: int,
    category: str,
    limit: int = 20,
    offset: int = 0,
    university: Optional[str] = None,
    institute: Optional[str] = None
) -> Dict:
    """
    Получить людей с их активными ЗАПРОСАМИ категории X (для карточек).
    Возвращает: {items: List[DatingProfile], has_more: bool}
    """
    # Подзапрос: последний request каждого пользователя в этой категории
    subquery = (
        db.query(
            models.Request.author_id,
            func.max(models.Request.created_at).label('max_created')
        )
        .filter(
            models.Request.category == category,
            models.Request.status == 'active',
            models.Request.expires_at > datetime.utcnow()
        )
        .group_by(models.Request.author_id)
        .subquery()
    )
    
    # Основной запрос: JOIN users + requests
    query = (
        db.query(models.User, models.Request)
        .join(
            models.Request,
            models.Request.author_id == models.User.id
        )
        .join(
            subquery,
            and_(
                models.Request.author_id == subquery.c.author_id,
                models.Request.created_at == subquery.c.max_created
            )
        )
        .filter(
            models.User.id != user_id,  # Исключаем себя
            models.Request.category == category,
            models.Request.status == 'active'
        )
    )
    
    # Фильтры (опционально)
    if university:
        query = query.filter(models.User.university == university)
    if institute:
        query = query.filter(models.User.institute == institute)
    
    # Сортировка по дате запроса (новые первые)
    query = query.order_by(models.Request.created_at.desc())
    
    # Pagination
    total_query = query.limit(limit + 1).offset(offset)
    results = total_query.all()
    
    # Проверка has_more
    has_more = len(results) > limit
    if has_more:
        results = results[:limit]
    
    # Формируем список DatingProfile с active_request
    items = []
    for user, request in results:
        # Парсим tags
        tags = json.loads(request.tags) if request.tags else []
        
        # Парсим interests
        interests = json.loads(user.interests) if user.interests else []
        
        profile_dict = {
            'id': user.id,
            'telegram_id': user.telegram_id,
            'name': user.name,
            'age': user.age,
            'bio': user.bio,
            'university': user.university,
            'institute': user.institute,
            'course': user.course if not user.hide_course_group else None,
            'group': user.group if not user.hide_course_group else None,
            'interests': interests,
            'active_request': {
                'id': request.id,
                'author_id': request.author_id,
                'title': request.title,
                'body': request.body,
                'category': request.category,
                'tags': tags,
                'expires_at': request.expires_at.isoformat() if request.expires_at else None,
                'max_responses': request.max_responses,
                'responses_count': request.responses_count,
                'status': request.status,
                'created_at': request.created_at.isoformat() if request.created_at else None,
            }
        }
        items.append(profile_dict)
    
    return {
        'items': items,
        'has_more': has_more
    }


def get_my_requests(db: Session, user_id: int) -> List[models.Request]:
    """Получить мои запросы"""
    return (
        db.query(models.Request)
        .filter(models.Request.author_id == user_id)
        .order_by(models.Request.created_at.desc())
        .all()
    )


def close_request(db: Session, request_id: int, user_id: int) -> bool:
    """Закрыть запрос (только автор)"""
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()
    
    if not request:
        return False
    
    request.status = 'closed'
    db.commit()
    return True


def respond_to_request(db: Session, request_id: int, responder_id: int, message: str) -> Dict:
    """
    Откликнуться на запрос.
    Создаёт уведомление + увеличивает счётчик.
    """
    request = db.query(models.Request).filter(models.Request.id == request_id).first()
    
    if not request:
        return {"success": False, "error": "Запрос не найден"}
    
    if request.status != 'active':
        return {"success": False, "error": "Запрос неактивен"}
    
    if request.expires_at <= datetime.utcnow():
        return {"success": False, "error": "Запрос истёк"}
    
    if responder_id == request.author_id:
        return {"success": False, "error": "Нельзя откликаться на свой запрос"}
    
    # Увеличиваем счётчик откликов
    request.responses_count += 1
    
    # Если достигнут лимит — закрываем запрос
    if request.responses_count >= request.max_responses:
        request.status = 'closed'
    
    db.commit()
    
    # TODO: Здесь можно создать уведомление для автора запроса
    # или отправить сообщение в Telegram с контактом responder
    
    return {
        "success": True,
        "message": "Отклик отправлен! Автор получил уведомление.",
        "request_status": request.status
    }


def auto_expire_requests(db: Session):
    """Cron job: пометить истёкшие запросы как expired"""
    expired = db.query(models.Request).filter(
        models.Request.status == 'active',
        models.Request.expires_at <= datetime.utcnow()
    ).all()
    
    for request in expired:
        request.status = 'expired'
    
    db.commit()
    return len(expired)


def auto_delete_expired_posts(db: Session):
    """Cron job: удалить истёкшие посты (lost_found)"""
    expired = db.query(models.Post).filter(
        models.Post.expires_at != None,
        models.Post.expires_at <= datetime.utcnow()
    ).all()
    
    for post in expired:
        db.delete(post)
    
    db.commit()
    return len(expired)


def get_responses_count(db: Session, user_id: int, category: Optional[str] = None) -> int:
    """
    Получить кол-во откликов на мои запросы категории X.
    """
    query = db.query(func.sum(models.Request.responses_count)).filter(
        models.Request.author_id == user_id,
        models.Request.status == 'active'
    )
    
    if category:
        query = query.filter(models.Request.category == category)
    
    result = query.scalar()
    return result if result else 0


# ===== DATING CRUD =====

def get_dating_feed(
    db: Session,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    university: Optional[str] = None,
    institute: Optional[str] = None,
    course: Optional[int] = None
) -> List[models.User]:
    """
    Получить ленту профилей для знакомств.
    Исключаем: себя, уже лайкнутых, заматченных, скрытых из dating.
    """
    current_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not current_user:
        return []
    
    # Получаем ID уже лайкнутых пользователей
    liked_ids = db.query(models.Like.liked_id).filter(
        models.Like.liker_id == user_id
    ).subquery()
    
    # Получаем ID заматченных пользователей
    matched_ids_a = db.query(models.Match.user_b_id).filter(
        models.Match.user_a_id == user_id
    ).subquery()
    
    matched_ids_b = db.query(models.Match.user_a_id).filter(
        models.Match.user_b_id == user_id
    ).subquery()
    
    # Базовый запрос
    query = db.query(models.User).filter(
        models.User.id != user_id,
        models.User.show_in_dating == True,
        ~models.User.id.in_(liked_ids),
        ~models.User.id.in_(matched_ids_a),
        ~models.User.id.in_(matched_ids_b)
    )
    
    # Фильтры
    target_university = university if university else current_user.university
    query = query.filter(models.User.university == target_university)
    
    if institute:
        query = query.filter(models.User.institute == institute)
    
    if course:
        query = query.filter(models.User.course == course)
    
    # Сортировка: новые первые
    query = query.order_by(
        models.User.created_at.desc()
    )
    
    return query.offset(offset).limit(limit).all()


def create_like(db: Session, liker_id: int, liked_id: int) -> Dict:
    """
    Создать лайк. Если взаимный → создаём матч.
    """
    # Проверки
    if liker_id == liked_id:
        return {"success": False, "error": "Нельзя лайкнуть себя"}
    
    liker = db.query(models.User).filter(models.User.id == liker_id).first()
    liked = db.query(models.User).filter(models.User.id == liked_id).first()
    
    if not liker or not liked:
        return {"success": False, "error": "Пользователь не найден"}
    
    # Проверяем что уже не лайкали
    existing_like = db.query(models.Like).filter(
        models.Like.liker_id == liker_id,
        models.Like.liked_id == liked_id
    ).first()
    
    if existing_like:
        return {"success": False, "error": "Уже лайкнуто"}
    
    # Создаём лайк
    new_like = models.Like(liker_id=liker_id, liked_id=liked_id)
    db.add(new_like)
    db.commit()
    
    # Проверяем обратный лайк (взаимность)
    reverse_like = db.query(models.Like).filter(
        models.Like.liker_id == liked_id,
        models.Like.liked_id == liker_id
    ).first()
    
    if reverse_like:
        # МАТЧ! Создаём запись
        user_a = min(liker_id, liked_id)
        user_b = max(liker_id, liked_id)
        
        # Проверяем что матч еще не создан
        existing_match = db.query(models.Match).filter(
            models.Match.user_a_id == user_a,
            models.Match.user_b_id == user_b
        ).first()
        
        if not existing_match:
            new_match = models.Match(user_a_id=user_a, user_b_id=user_b)
            db.add(new_match)
            db.commit()
            db.refresh(new_match)
            
            return {
                "success": True,
                "is_match": True,
                "match_id": new_match.id,
                "matched_user": liked
            }
    
    return {"success": True, "is_match": False}


def get_who_liked_me(
    db: Session,
    user_id: int,
    limit: int = 20,
    offset: int = 0
) -> List[models.User]:
    """
    Получить список людей, которые лайкнули меня, но я их ещё нет.
    """
    # Получаем ID тех, кого я уже лайкнул
    my_likes_ids = db.query(models.Like.liked_id).filter(
        models.Like.liker_id == user_id
    ).subquery()
    
    # Получаем тех, кто лайкнул меня, но я их нет
    likers = (
        db.query(models.User)
        .join(models.Like, models.Like.liker_id == models.User.id)
        .filter(
            models.Like.liked_id == user_id,
            ~models.User.id.in_(my_likes_ids)
        )
        .order_by(models.Like.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return likers


def get_my_matches(
    db: Session,
    user_id: int,
    limit: int = 20,
    offset: int = 0
) -> List[Dict]:
    """
    Получить все матчи пользователя.
    """
    matches = (
        db.query(models.Match)
        .filter(
            or_(
                models.Match.user_a_id == user_id,
                models.Match.user_b_id == user_id
            )
        )
        .order_by(models.Match.matched_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    result = []
    for match in matches:
        # Определяем кто matched_user
        matched_user_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
        matched_user = db.query(models.User).filter(models.User.id == matched_user_id).first()
        
        result.append({
            'id': match.id,
            'matched_at': match.matched_at,
            'matched_user': matched_user
        })
    
    return result


def get_dating_stats(db: Session, user_id: int) -> Dict:
    """
    Получить статистику знакомств.
    """
    # Кол-во людей, которые лайкнули меня (но я их нет)
    my_likes_ids = db.query(models.Like.liked_id).filter(
        models.Like.liker_id == user_id
    ).subquery()
    
    likes_count = (
        db.query(func.count(models.Like.id))
        .filter(
            models.Like.liked_id == user_id,
            ~models.Like.liker_id.in_(my_likes_ids)
        )
        .scalar()
    ) or 0
    
    # Кол-во матчей
    matches_count = (
        db.query(func.count(models.Match.id))
        .filter(
            or_(
                models.Match.user_a_id == user_id,
                models.Match.user_b_id == user_id
            )
        )
        .scalar()
    ) or 0
    
    # Кол-во откликов на мои requests
    responses_count = get_responses_count(db, user_id)
    
    return {
        'likes_count': likes_count,
        'matches_count': matches_count,
        'responses_count': responses_count
    }


def update_dating_settings(db: Session, user_id: int, settings: dict) -> Optional[models.User]:
    """
    Обновить настройки приватности для знакомств.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    
    if 'show_in_dating' in settings:
        user.show_in_dating = settings['show_in_dating']
    
    if 'hide_course_group' in settings:
        user.hide_course_group = settings['hide_course_group']
    
    if 'interests' in settings:
        # Если список — конвертируем в JSON
        if isinstance(settings['interests'], list):
            user.interests = json.dumps(settings['interests'])
        else:
            user.interests = settings['interests']
    
    db.commit()
    db.refresh(user)
    return user