from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, not_, func, case
from app import models, schemas
from typing import Optional, List, Dict, Union
from datetime import datetime, timedelta
import json
from app.utils import process_base64_images, delete_images, get_image_urls

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
    
    update_data = user_update.model_dump(exclude_unset=True)
    
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
    
    query = query.filter(
        or_(
            models.Post.expires_at == None,
            models.Post.expires_at > datetime.utcnow()
        )
    )
    
    if category and category != "all":
        query = query.filter(models.Post.category == category)
    if university and university != "all":
        query = query.filter(models.Post.university == university)
    if course and course != "all":
        query = query.filter(models.Post.course == course)
    
    return query.order_by(
        models.Post.is_important.desc(),
        models.Post.created_at.desc()
    ).offset(skip).limit(limit).all()

def get_post(db: Session, post_id: int) -> Optional[models.Post]:
    """Получить пост по ID"""
    return db.query(models.Post).filter(models.Post.id == post_id).first()

async def create_post(db: Session, post: schemas.PostCreate, author_id: int, uploaded_files: List = None) -> models.Post:
    """
    Создать новый пост (поддержка multipart files).
    Сохраняет метаданные изображений (w, h) в JSON.
    """
    
    from app.utils import process_uploaded_files
    
    saved_images_meta = []
    
    if uploaded_files and len(uploaded_files) > 0:
        try:
            saved_images_meta = await process_uploaded_files(uploaded_files)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")
    elif post.images and len(post.images) > 0:
        try:
            saved_images_meta = process_base64_images(post.images)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")
    
    db_post = models.Post(
        author_id=author_id,
        category=post.category,
        title=post.title,
        body=post.body,
        tags=json.dumps(post.tags) if post.tags else None,
        images=json.dumps(saved_images_meta) if saved_images_meta else None,
        is_anonymous=post.is_anonymous,
        enable_anonymous_comments=post.enable_anonymous_comments,
        lost_or_found=post.lost_or_found,
        item_description=post.item_description,
        location=post.location,
        event_name=post.event_name,
        event_date=post.event_date,
        event_location=post.event_location,
        is_important=post.is_important,
    )
    
    if post.category == 'lost_found':
        db_post.expires_at = datetime.utcnow() + timedelta(days=7)
    
    try:
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e

async def update_post(
    db: Session, 
    post_id: int, 
    post_update: schemas.PostUpdate, 
    new_files: List = None, 
    keep_filenames: List[str] = None
) -> Optional[models.Post]:
    """
    Обновить пост (Smart Merge изображений).
    Объединяет старые картинки (сохраняя их размеры) и новые.
    """
    
    from app.utils import process_uploaded_files
    
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return None
    
    update_data = post_update.model_dump(exclude_unset=True)
    
    if "tags" in update_data:
        update_data['tags'] = json.dumps(update_data['tags'])
    
    if new_files is not None or keep_filenames is not None:
        raw_old_images = json.loads(db_post.images) if db_post.images else []
        
        old_images_map = {}
        for item in raw_old_images:
            if isinstance(item, str):
                old_images_map[item] = {"url": item, "w": 1000, "h": 1000}
            elif isinstance(item, dict):
                old_images_map[item.get("url")] = item
        
        final_images_meta = []
        
        if keep_filenames:
            for fname in keep_filenames:
                if fname in old_images_map:
                    final_images_meta.append(old_images_map[fname])
        
        if new_files and len(new_files) > 0:
            try:
                new_saved_meta = await process_uploaded_files(new_files)
                final_images_meta.extend(new_saved_meta)
            except Exception as e:
                raise ValueError(f"Ошибка обновления изображений: {str(e)}")
        
        kept_urls = {img["url"] for img in final_images_meta}
        files_to_delete = []
        
        for url in old_images_map:
            if url not in kept_urls:
                files_to_delete.append(url)
        
        if files_to_delete:
            delete_images(files_to_delete)
        
        update_data['images'] = json.dumps(final_images_meta) if final_images_meta else None
    
    for key, value in update_data.items():
        setattr(db_post, key, value)
    
    db_post.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_post)
    return db_post

def delete_post(db: Session, post_id: int) -> bool:
    """Удалить пост и его изображения"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return False
    
    if db_post.images:
        try:
            images_data = json.loads(db_post.images)
            delete_images(images_data)
        except Exception as e:
            print(f"⚠️ Ошибка удаления изображений поста {post_id}: {e}")
    
    db.delete(db_post)
    db.commit()
    return True

def increment_post_views(db: Session, post_id: int):
    """Увеличить счётчик просмотров"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if db_post:
        db_post.views_count += 1
        db.commit()

# ===== POST LIKES =====

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
        db.delete(like)
        post.likes_count = max(0, post.likes_count - 1)
        db.commit()
        return {"is_liked": False, "likes": post.likes_count}
    else:
        new_like = models.PostLike(user_id=user_id, post_id=post_id)
        db.add(new_like)
        post.likes_count += 1
        db.commit()
        return {"is_liked": True, "likes": post.likes_count}

# ===== COMMENT CRUD =====

def get_post_comments(db: Session, post_id: int, user_id: Optional[int] = None) -> List[models.Comment]:
    """Получить все комментарии к посту"""
    comments = db.query(models.Comment)\
        .options(joinedload(models.Comment.author))\
        .filter(models.Comment.post_id == post_id)\
        .order_by(models.Comment.created_at)\
        .all()
    
    if user_id:
        for comment in comments:
            comment.is_liked = is_comment_liked_by_user(db, comment.id, user_id)
    else:
        for comment in comments:
            comment.is_liked = False
    
    return comments

def create_comment(db: Session, comment: schemas.CommentCreate, author_id: int):
    """Создание комментария с логикой анонимности"""
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    if not post:
        return None
    
    is_anonymous = comment.is_anonymous
    if post.enable_anonymous_comments:
        is_anonymous = True
    
    anonymous_index = None
    if is_anonymous:
        if post.is_anonymous and post.author_id == author_id:
            anonymous_index = 0
        else:
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
                max_index = max([c.anonymous_index for c in existing_anon_comments if c.anonymous_index and c.anonymous_index > 0], default=0)
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

# ===== COMMENT LIKES =====

def is_comment_liked_by_user(db: Session, comment_id: int, user_id: int) -> bool:
    like = db.query(models.CommentLike).filter(
        models.CommentLike.comment_id == comment_id,
        models.CommentLike.user_id == user_id
    ).first()
    return like is not None

def toggle_comment_like(db: Session, comment_id: int, user_id: int) -> dict:
    like = db.query(models.CommentLike).filter(
        models.CommentLike.comment_id == comment_id,
        models.CommentLike.user_id == user_id
    ).first()
    
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"is_liked": False, "likes": 0}
    
    if like:
        db.delete(like)
        comment.likes_count = max(0, comment.likes_count - 1)
        db.commit()
        return {"is_liked": False, "likes": comment.likes_count}
    else:
        new_like = models.CommentLike(user_id=user_id, comment_id=comment_id)
        db.add(new_like)
        comment.likes_count += 1
        db.commit()
        return {"is_liked": True, "likes": comment.likes_count}

def delete_comment(db: Session, comment_id: int, user_id: int) -> dict:
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"success": False, "error": "Комментарий не найден"}
    
    if comment.author_id != user_id:
        return {"success": False, "error": "Нет прав"}
    
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    
    has_replies = db.query(models.Comment).filter(models.Comment.parent_id == comment_id).count() > 0
    
    if has_replies:
        comment.is_deleted = True
        comment.body = "Комментарий удалён"
        db.commit()
        return {"success": True, "type": "soft_delete"}
    else:
        db.delete(comment)
        if post:
            post.comments_count = max(0, post.comments_count - 1)
        db.commit()
        return {"success": True, "type": "hard_delete"}

def update_comment(db: Session, comment_id: int, text: str, user_id: int) -> Optional[models.Comment]:
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return None
    
    if comment.author_id != user_id:
        return None
    
    if comment.is_deleted:
        return None
    
    comment.body = text
    comment.is_edited = True
    db.commit()
    db.refresh(comment)
    return comment

def count_post_comments(db: Session, post_id: int) -> int:
    return db.query(models.Comment).filter(
        models.Comment.post_id == post_id,
        models.Comment.is_deleted == False
    ).count()

def get_user_posts(db: Session, user_id: int, limit: int = 5, offset: int = 0) -> List[models.Post]:
    return db.query(models.Post)\
        .filter(models.Post.author_id == user_id)\
        .order_by(models.Post.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()

def count_user_posts(db: Session, user_id: int) -> int:
    return db.query(models.Post).filter(models.Post.author_id == user_id).count()

def count_user_comments(db: Session, user_id: int) -> int:
    return db.query(models.Comment).filter(
        models.Comment.author_id == user_id,
        models.Comment.is_deleted == False
    ).count()

# ===== COOLDOWN =====

def can_edit_critical_fields(db: Session, user_id: int) -> bool:
    user = get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return True
    days_passed = (datetime.utcnow() - user.last_profile_edit).days
    return days_passed >= 30

def get_cooldown_days_left(db: Session, user_id: int) -> int:
    user = get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return 0
    days_passed = (datetime.utcnow() - user.last_profile_edit).days
    return max(0, 30 - days_passed)

# ===== REQUEST CRUD =====

def create_request(db: Session, request: schemas.RequestCreate, author_id: int) -> models.Request:
    active_count = db.query(models.Request).filter(
        models.Request.author_id == author_id,
        models.Request.category == request.category,
        models.Request.status == 'active',
        models.Request.expires_at > datetime.utcnow()
    ).count()
    
    if active_count >= 3:
        raise ValueError(f"Максимум 3 активных запроса в категории {request.category}")
    
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

def get_requests_feed(
    db: Session,
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user_id: Optional[int] = None
) -> Dict:
    now = datetime.utcnow()
    urgent_threshold = now + timedelta(hours=3)
    
    query = db.query(models.Request).options(joinedload(models.Request.author)).filter(
        models.Request.status == 'active',
        models.Request.expires_at > now
    )
    
    if category and category != 'all':
        query = query.filter(models.Request.category == category)
    
    total = query.count()
    
    query = query.order_by(
        case(
            (models.Request.expires_at < urgent_threshold, 0),
            else_=1
        ),
        case(
            (models.Request.expires_at < urgent_threshold, models.Request.expires_at),
            else_=None
        ),
        models.Request.created_at.desc()
    )
    
    requests = query.offset(offset).limit(limit).all()
    
    result = []
    for req in requests:
        tags = json.loads(req.tags) if req.tags else []
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
            'has_responded': any(r.user_id == current_user_id for r in req.responses) if current_user_id and req.responses else False
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
    
    request.views_count += 1
    db.commit()
    
    tags = json.loads(request.tags) if request.tags else []
    
    request_dict = {
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
        'has_responded': any(r.user_id == current_user_id for r in request.responses) if current_user_id and request.responses else False
    }
    
    return request_dict

def update_request(db: Session, request_id: int, user_id: int, data: schemas.RequestUpdate) -> Optional[models.Request]:
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()
    
    if not request:
        raise ValueError("Запрос не найден или нет прав")
    
    update_data = data.model_dump(exclude_unset=True)
    
    if 'tags' in update_data:
        update_data['tags'] = json.dumps(update_data['tags'])
    
    for key, value in update_data.items():
        setattr(request, key, value)
    
    request.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(request)
    return request

def delete_request(db: Session, request_id: int, user_id: int) -> bool:
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()
    
    if not request:
        raise ValueError("Запрос не найден или нет прав")
    
    db.delete(request)
    db.commit()
    return True

def get_my_requests(db: Session, user_id: int) -> List[Dict]:
    requests = db.query(models.Request).options(
        joinedload(models.Request.responses)
    ).filter(
        models.Request.author_id == user_id
    ).order_by(models.Request.created_at.desc()).all()
    
    result = []
    for req in requests:
        tags = json.loads(req.tags) if req.tags else []
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
            'is_expired': req.expires_at < datetime.utcnow()
        }
        result.append(req_dict)
    
    return result

# ===== RESPONSES =====

def create_response(db: Session, request_id: int, user_id: int, data: schemas.ResponseCreate) -> models.RequestResponse:
    request = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not request:
        raise ValueError("Запрос не найден")
    
    if request.status != 'active' or request.expires_at < datetime.utcnow():
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
    
    request.responses_count += 1
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
    
    responses = db.query(models.RequestResponse).options(
        joinedload(models.RequestResponse.author)
    ).filter(
        models.RequestResponse.request_id == request_id
    ).order_by(models.RequestResponse.created_at.desc()).all()
    
    return responses

def delete_response(db: Session, response_id: int, user_id: int) -> bool:
    response = db.query(models.RequestResponse).filter(
        models.RequestResponse.id == response_id,
        models.RequestResponse.user_id == user_id
    ).first()
    
    if not response:
        raise ValueError("Отклик не найден или нет прав")
    
    request = db.query(models.Request).filter(models.Request.id == response.request_id).first()
    if request:
        request.responses_count = max(0, request.responses_count - 1)
    
    db.delete(response)
    db.commit()
    return True

def auto_expire_requests(db: Session):
    expired = db.query(models.Request).filter(
        models.Request.status == 'active',
        models.Request.expires_at <= datetime.utcnow()
    ).all()
    
    for request in expired:
        request.status = 'expired'
    
    db.commit()
    return len(expired)

def auto_delete_expired_posts(db: Session):
    """Cron job: удалить истёкшие посты и их картинки"""
    expired = db.query(models.Post).filter(
        models.Post.expires_at != None,
        models.Post.expires_at <= datetime.utcnow()
    ).all()
    
    for post in expired:
        if post.images:
            try:
                images_data = json.loads(post.images)
                delete_images(images_data)
            except Exception as e:
                print(f"⚠️ Ошибка удаления изображений истёкшего поста {post.id}: {e}")
        
        db.delete(post)
    
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

# ========================================
# 💘 DATING CRUD (REFACTORED)
# ========================================

def get_dating_profile(db: Session, user_id: int) -> Optional[models.DatingProfile]:
    """Получить анкету пользователя"""
    return db.query(models.DatingProfile).filter(models.DatingProfile.user_id == user_id).first()

def update_dating_profile_activity(db: Session, user_id: int, is_active: bool):
    """Скрыть/показать анкету"""
    profile = get_dating_profile(db, user_id)
    if profile:
        profile.is_active = is_active
        db.commit()

def get_dating_feed(
    db: Session,
    current_user_id: int,
    limit: int = 10,
    offset: int = 0,
    looking_for: Optional[str] = None
) -> List[dict]:
    """
    Получить ленту анкет.
    Исключает:
    1. Самого себя
    2. Тех, кого я уже лайкнул (или дизлайкнул)
    3. Неактивные анкеты
    """
    
    # ID тех, кого я уже лайкнул/скипнул
    liked_ids = db.query(models.Like.liked_id).filter(
        models.Like.liker_id == current_user_id
    ).subquery()
    
    # Базовый запрос: Джойним User и DatingProfile
    query = db.query(models.DatingProfile).join(models.User).filter(
        models.DatingProfile.user_id != current_user_id,
        models.DatingProfile.is_active == True,
        models.User.id.notin_(liked_ids) # Исключаем лайкнутых
    )
    
    # Фильтр "Кого ищу" (если указан)
    if looking_for and looking_for != 'all':
        query = query.filter(models.DatingProfile.gender == looking_for)
    
    # Сортировка (сначала новые)
    profiles = query.order_by(models.DatingProfile.updated_at.desc()).offset(offset).limit(limit).all()
    
    # Формируем плоский объект для фронтенда
    results = []
    for p in profiles:
        # User данные
        user = p.user
        
        # Фото: берем из профиля dating, если нет - аватар юзера
        photos_raw = p.photos
        photos = get_image_urls(photos_raw) if photos_raw else []
        if not photos and user.avatar:
            photos = [{"url": user.avatar, "w": 500, "h": 500}] # Fallback

        interests = json.loads(user.interests) if user.interests else []
        goals = json.loads(p.goals) if p.goals else []

        # Собираем объект, который ждет ProfileCard.js
        results.append({
            "id": user.id,              # ID для лайка
            "telegram_id": user.telegram_id,
            "name": user.name,
            "age": user.age,
            "bio": p.bio or user.bio,   # Био из дейтинга приоритетнее
            "university": user.university,
            "institute": user.institute,
            "course": user.course,
            "photos": photos,
            "goals": goals,
            "interests": interests,
            "looking_for": p.looking_for
        })
        
    return results

def create_like(db: Session, liker_id: int, liked_id: int) -> dict:
    """
    Создать лайк и проверить на мэтч.
    Возвращает словарь с результатом.
    """
    if liker_id == liked_id:
        return {"success": False, "error": "Нельзя лайкнуть себя"}
    
    # 1. Проверяем, не лайкали ли уже
    existing = db.query(models.Like).filter(
        models.Like.liker_id == liker_id,
        models.Like.liked_id == liked_id
    ).first()
    
    if existing:
        return {"success": True, "is_match": False, "already_liked": True} # Не ошибка, просто игнор
    
    # 2. Создаем лайк
    new_like = models.Like(liker_id=liker_id, liked_id=liked_id)
    db.add(new_like)
    db.commit()
    
    # 3. Проверяем ВЗАИМНОСТЬ (Ищет лайк в обратную сторону)
    reverse_like = db.query(models.Like).filter(
        models.Like.liker_id == liked_id,
        models.Like.liked_id == liker_id
    ).first()
    
    is_match = False
    match_obj = None
    matched_user = None
    
    if reverse_like:
        is_match = True
        # Нормализация ID для таблицы matches (меньший ID всегда user_a)
        user_a = min(liker_id, liked_id)
        user_b = max(liker_id, liked_id)
        
        # Проверяем, не создан ли уже матч
        existing_match = db.query(models.Match).filter(
            models.Match.user_a_id == user_a,
            models.Match.user_b_id == user_b
        ).first()
        
        if not existing_match:
            match_obj = models.Match(user_a_id=user_a, user_b_id=user_b)
            db.add(match_obj)
            db.commit()
            db.refresh(match_obj)
        
        # Получаем данные того, с кем совпали
        matched_user_db = db.query(models.User).filter(models.User.id == liked_id).first()
        matched_user = matched_user_db # Вернем модель, схема обработает
        
    return {
        "success": True,
        "is_match": is_match,
        "match_id": match_obj.id if match_obj else None,
        "matched_user": matched_user
    }

def get_who_liked_me(db: Session, user_id: int, limit: int = 20, offset: int = 0) -> List[models.User]:
    """Кто лайкнул меня, но кого я ЕЩЕ НЕ лайкнул в ответ (чтобы не показывать матчи в лайках)"""
    
    # Мои лайки (кого я уже оценил)
    my_likes = db.query(models.Like.liked_id).filter(models.Like.liker_id == user_id).subquery()
    
    # Те кто лайкнул меня
    users = db.query(models.User).join(models.Like, models.Like.liker_id == models.User.id)\
        .filter(
            models.Like.liked_id == user_id,
            models.User.id.notin_(my_likes) # Исключаем тех, кого я уже лайкнул (это уже матчи)
        )\
        .order_by(models.Like.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()
        
    return users

def get_dating_stats(db: Session, user_id: int) -> dict:
    """Счетчики лайков и матчей"""
    # Входящие лайки (без моих ответов)
    my_likes = db.query(models.Like.liked_id).filter(models.Like.liker_id == user_id).subquery()
    
    likes_count = db.query(func.count(models.Like.id)).filter(
        models.Like.liked_id == user_id,
        models.Like.liker_id.notin_(my_likes)
    ).scalar()
    
    matches_count = db.query(func.count(models.Match.id)).filter(
        or_(models.Match.user_a_id == user_id, models.Match.user_b_id == user_id)
    ).scalar()
    
    return {"likes_count": likes_count, "matches_count": matches_count}

def update_dating_settings(db: Session, user_id: int, settings: dict) -> Optional[models.User]:
    """
    Обновление настроек приватности и интересов.
    Синхронизирует статус User.show_in_dating и DatingProfile.is_active.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    
    # 1. Скрыть/показать анкету
    if 'show_in_dating' in settings:
        is_visible = settings['show_in_dating']
        user.show_in_dating = is_visible
        
        # Важно: Синхронизируем с DatingProfile, если он есть
        # (используем relationship user.dating_profile)
        if user.dating_profile:
            user.dating_profile.is_active = is_visible

    # 2. Скрыть группу/курс
    if 'hide_course_group' in settings:
        user.hide_course_group = settings['hide_course_group']
    
    # 3. Обновить интересы
    if 'interests' in settings:
        val = settings['interests']
        if isinstance(val, list):
            user.interests = json.dumps(val)
        else:
            user.interests = val
    
    db.commit()
    db.refresh(user)
    return user

# ===== MARKET CRUD =====

STANDARD_CATEGORIES = [
    'textbooks',
    'electronics',
    'furniture',
    'clothing',
    'sports',
    'appliances'
]

async def create_market_item(
    db: Session, 
    item: schemas.MarketItemCreate, 
    seller_id: int, 
    uploaded_files: List = None
) -> models.MarketItem:
    """Создание товара с автозаполнением university/institute из профиля"""
    from app.utils import process_uploaded_files
    
    seller = get_user_by_id(db, seller_id)
    if not seller:
        raise ValueError("Продавец не найден")
    
    saved_images_meta = []
    
    if uploaded_files and len(uploaded_files) > 0:
        try:
            saved_images_meta = await process_uploaded_files(uploaded_files)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")
    elif item.images and len(item.images) > 0:
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
        images=json.dumps(saved_images_meta),
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
    sort: str = 'newest',
    search: Optional[str] = None,
    current_user_id: Optional[int] = None
) -> Dict:
    """Лента товаров с фильтрами и сортировкой"""
    query = db.query(models.MarketItem).options(joinedload(models.MarketItem.seller))
    
    query = query.filter(models.MarketItem.status == 'active')

    # Search
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.MarketItem.title.ilike(search_term),
                models.MarketItem.description.ilike(search_term)
            )
        )
    
    # ФИЛЬТРЫ
    if category and category != 'all':
        query = query.filter(models.MarketItem.category == category)
    
    if price_min is not None:
        query = query.filter(models.MarketItem.price >= price_min)
    
    if price_max is not None:
        query = query.filter(models.MarketItem.price <= price_max)
    
    if condition:
        conditions = condition.split(',')
        query = query.filter(models.MarketItem.condition.in_(conditions))
    
    if university and university != 'all':
        query = query.filter(models.MarketItem.university == university)
    
    if institute and institute != 'all':
        query = query.filter(models.MarketItem.institute == institute)
    
    total = query.count()
    
    if sort == 'price_asc':
        query = query.order_by(models.MarketItem.price.asc())
    elif sort == 'price_desc':
        query = query.order_by(models.MarketItem.price.desc())
    elif sort == 'oldest':
        query = query.order_by(models.MarketItem.created_at.asc())
    else: # 'newest' и дефолт
        query = query.order_by(models.MarketItem.created_at.desc())
    
    items = query.offset(skip).limit(limit).all()
    
    return {
        'items': items,
        'total': total,
        'has_more': skip + limit < total
    }

def get_market_item(db: Session, item_id: int) -> Optional[models.MarketItem]:
    """Получить товар по ID и увеличить просмотры"""
    item = db.query(models.MarketItem).options(
        joinedload(models.MarketItem.seller)
    ).filter(models.MarketItem.id == item_id).first()
    
    if item:
        item.views_count += 1
        db.commit()
    
    return item

async def update_market_item(
    db: Session,
    item_id: int,
    seller_id: int,
    item_update: schemas.MarketItemUpdate,
    new_files: List = None,
    keep_filenames: List[str] = None
) -> Optional[models.MarketItem]:
    """Обновление товара (только продавец)"""
    from app.utils import process_uploaded_files
    
    db_item = db.query(models.MarketItem).filter(
        models.MarketItem.id == item_id,
        models.MarketItem.seller_id == seller_id
    ).first()
    
    if not db_item:
        return None
    
    update_data = item_update.model_dump(exclude_unset=True)
    
    if new_files is not None or keep_filenames is not None:
        raw_old_images = json.loads(db_item.images) if db_item.images else []
        
        old_images_map = {}
        for item in raw_old_images:
            if isinstance(item, str):
                old_images_map[item] = {"url": item, "w": 1000, "h": 1000}
            elif isinstance(item, dict):
                old_images_map[item.get("url")] = item
        
        final_images_meta = []
        
        if keep_filenames:
            for fname in keep_filenames:
                if fname in old_images_map:
                    final_images_meta.append(old_images_map[fname])
        
        if new_files and len(new_files) > 0:
            try:
                new_saved_meta = await process_uploaded_files(new_files)
                final_images_meta.extend(new_saved_meta)
            except Exception as e:
                raise ValueError(f"Ошибка обновления изображений: {str(e)}")
        
        if not final_images_meta:
            raise ValueError("Минимум 1 фото обязательно")
        
        kept_urls = {img["url"] for img in final_images_meta}
        files_to_delete = []
        
        for url in old_images_map:
            if url not in kept_urls:
                files_to_delete.append(url)
        
        if files_to_delete:
            delete_images(files_to_delete)
        
        update_data['images'] = json.dumps(final_images_meta)
    
    for key, value in update_data.items():
        setattr(db_item, key, value)
    
    db_item.updated_at = datetime.utcnow()
    db.commit()
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
        item.favorites_count = max(0, item.favorites_count - 1)
        db.commit()
        return {"is_favorited": False, "favorites_count": item.favorites_count}
    else:
        new_favorite = models.MarketFavorite(user_id=user_id, item_id=item_id)
        db.add(new_favorite)
        item.favorites_count += 1
        db.commit()
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

def count_user_total_likes(db: Session, user_id: int) -> int:
    """Суммарное количество полученных лайков (за посты + за комментарии)"""
    
    # Лайки за посты
    post_likes = db.query(func.sum(models.Post.likes_count)).filter(
        models.Post.author_id == user_id,
        models.Post.is_anonymous == False # Анонимные лайки не считаем в карму (опционально)
    ).scalar() or 0
    
    # Лайки за комментарии
    comment_likes = db.query(func.sum(models.Comment.likes_count)).filter(
        models.Comment.author_id == user_id,
        models.Comment.is_anonymous == False
    ).scalar() or 0
    
    return int(post_likes + comment_likes)