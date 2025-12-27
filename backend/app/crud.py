from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, not_, func, case
from app import models, schemas
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import json

# ✅ НОВОЕ: Импорт функций для работы с изображениями
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



async def create_post(db: Session, post: schemas.PostCreate, author_id: int, uploaded_files: List = None) -> models.Post:
    """Создать новый пост (поддержка multipart files)"""
    
    from app.utils import process_uploaded_files
    
    # Обработка изображений
    saved_image_filenames = []
    
    # Если есть файлы из multipart form (приоритет)
    if uploaded_files and len(uploaded_files) > 0:
        try:
            saved_image_filenames = await process_uploaded_files(uploaded_files)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")
    # Иначе обрабатываем Base64 (для обратной совместимости)
    elif post.images and len(post.images) > 0:
        try:
            saved_image_filenames = process_base64_images(post.images)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")
    
    # Базовые данные
    db_post = models.Post(
        author_id=author_id,
        category=post.category,
        title=post.title,
        body=post.body,
        tags=json.dumps(post.tags) if post.tags else None,
        images=json.dumps(saved_image_filenames) if saved_image_filenames else None,
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
    
    # Автоматическое expires_at для lost_found (7 дней)
    if post.category == 'lost_found':
        db_post.expires_at = datetime.utcnow() + timedelta(days=7)
    
    try:
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        # Если ошибка сохранения в БД → удаляем загруженные файлы
        if saved_image_filenames:
            delete_images(saved_image_filenames)
        raise e



async def update_post(
    db: Session, 
    post_id: int, 
    post_update: schemas.PostUpdate, 
    new_files: List = None, 
    keep_filenames: List = None
) -> Optional[models.Post]:
    """Обновить пост (поддержка multipart files)"""
    
    from app.utils import process_uploaded_files
    
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return None
    
    update_data = post_update.model_dump(exclude_unset=True)
    
    # Обрабатываем теги
    if "tags" in update_data:
        update_data['tags'] = json.dumps(update_data['tags'])
    
    # Обработка изображений
    if new_files is not None or keep_filenames is not None:
        # Старые изображения
        old_images = json.loads(db_post.images) if db_post.images else []
        
        # Итоговый список
        final_filenames = []
        
        # 1. Оставляем старые (keep_filenames)
        if keep_filenames:
            final_filenames.extend(keep_filenames)
        
        # 2. Загружаем новые
        if new_files and len(new_files) > 0:
            try:
                new_saved = await process_uploaded_files(new_files)
                final_filenames.extend(new_saved)
            except Exception as e:
                raise ValueError(f"Ошибка обновления изображений: {str(e)}")
        
        # 3. Удаляем ненужные
        files_to_delete = [f for f in old_images if f not in final_filenames]
        if files_to_delete:
            delete_images(files_to_delete)
        
        # 4. Сохраняем список
        update_data['images'] = json.dumps(final_filenames) if final_filenames else None
    
    # Обновляем поля
    for key, value in update_data.items():
        setattr(db_post, key, value)
    
    db_post.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_post)
    return db_post




def delete_post(db: Session, post_id: int) -> bool:
    """Удалить пост"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return False
    
    # ✅ НОВОЕ: Удаляем файлы изображений перед удалением поста
    if db_post.images:
        try:
            image_filenames = json.loads(db_post.images)
            delete_images(image_filenames)
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




def create_comment(db: Session, comment: schemas.CommentCreate, author_id: int):
    """Создание комментария с логикой анонимности"""
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    if not post:
        return None
    
    # Определяем анонимность
    is_anonymous = comment.is_anonymous
    if post.enable_anonymous_comments:
        is_anonymous = True
    
    anonymous_index = None
    if is_anonymous:
        # ЕСЛИ КОММЕНТАТОР = АВТОР АНОНИМНОГО ПОСТА -> индекс 0 ("Аноним" без цифры)
        if post.is_anonymous and post.author_id == author_id:
            anonymous_index = 0
        else:
            # Проверка существующих анонимных комментариев от этого автора
            existing_anon_comments = db.query(models.Comment)\
                .filter(
                    models.Comment.post_id == comment.post_id,
                    models.Comment.is_anonymous == True
                ).all()
            
            # Проверяем, комментировал ли этот пользователь уже
            for existing in existing_anon_comments:
                if existing.author_id == author_id:
                    anonymous_index = existing.anonymous_index
                    break
            
            # Если это новый анонимный комментатор
            if anonymous_index is None:
                # Находим максимальный индекс (исключая 0 - автора поста)
                max_index = max([c.anonymous_index for c in existing_anon_comments if c.anonymous_index and c.anonymous_index > 0], default=0)
                anonymous_index = max_index + 1
    
    # Создаем комментарий
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




# ===== REQUEST CRUD (ОБНОВЛЕНО) =====



def create_request(db: Session, request: schemas.RequestCreate, author_id: int) -> models.Request:
    """Создать запрос с проверкой лимита (макс 3 активных на категорию)"""
    # Проверка лимита
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
    """
    Получить ленту запросов с умной сортировкой.
    Срочные (< 3 часов) сверху, остальные по новизне.
    """
    now = datetime.utcnow()
    urgent_threshold = now + timedelta(hours=3)
    
    # Базовый запрос
    query = db.query(models.Request).options(joinedload(models.Request.author)).filter(
        models.Request.status == 'active',
        models.Request.expires_at > now
    )
    
    # Фильтр по категории
    if category and category != 'all':
        query = query.filter(models.Request.category == category)
    
    # Считаем total
    total = query.count()
    
    # Умная сортировка
    query = query.order_by(
        # Срочные сначала (0 = срочные, 1 = несрочные)
        case(
            (models.Request.expires_at < urgent_threshold, 0),
            else_=1
        ),
        # Для срочных: по возрастанию времени до истечения
        case(
            (models.Request.expires_at < urgent_threshold, models.Request.expires_at),
            else_=None
        ),
        # Для несрочных: новые сверху
        models.Request.created_at.desc()
    )
    
    requests = query.offset(offset).limit(limit).all()
    
    # Добавляем вычисляемые поля
    result = []
    for req in requests:
        # Парсим теги
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
    """Получить запрос по ID (с увеличением views_count)"""
    request = db.query(models.Request).options(
        joinedload(models.Request.author),
        joinedload(models.Request.responses)
    ).filter(models.Request.id == request_id).first()
    
    if not request:
        return None
    
    # Увеличить views_count
    request.views_count += 1
    db.commit()
    
    # Парсим теги
    tags = json.loads(request.tags) if request.tags else []
    
    # Формируем ответ
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
    """Обновить запрос (только автор)"""
    request = db.query(models.Request).filter(
        models.Request.id == request_id,
        models.Request.author_id == user_id
    ).first()
    
    if not request:
        raise ValueError("Запрос не найден или нет прав")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Обрабатываем теги
    if 'tags' in update_data:
        update_data['tags'] = json.dumps(update_data['tags'])
    
    for key, value in update_data.items():
        setattr(request, key, value)
    
    request.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(request)
    return request




def delete_request(db: Session, request_id: int, user_id: int) -> bool:
    """Удалить запрос (только автор)"""
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
    """Получить мои запросы"""
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




# ===== RESPONSES (ОТКЛИКИ НА ЗАПРОСЫ) =====



def create_response(db: Session, request_id: int, user_id: int, data: schemas.ResponseCreate) -> models.RequestResponse:
    """Откликнуться на запрос"""
    # Проверка существования запроса
    request = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not request:
        raise ValueError("Запрос не найден")
    
    if request.status != 'active' or request.expires_at < datetime.utcnow():
        raise ValueError("Запрос закрыт или истёк")
    
    if request.author_id == user_id:
        raise ValueError("Нельзя откликнуться на свой запрос")
    
    # Проверка дубликата
    existing = db.query(models.RequestResponse).filter(
        models.RequestResponse.request_id == request_id,
        models.RequestResponse.user_id == user_id
    ).first()
    
    if existing:
        raise ValueError("Вы уже откликнулись на этот запрос")
    
    # Получить telegram из профиля
    user = db.query(models.User).filter(models.User.id == user_id).first()
    telegram = data.telegram_contact or user.username
    
    # Создать отклик
    response = models.RequestResponse(
        request_id=request_id,
        user_id=user_id,
        message=data.message,
        telegram_contact=telegram
    )
    db.add(response)
    
    # Увеличить счётчик
    request.responses_count += 1
    
    db.commit()
    db.refresh(response)
    
    # TODO: Отправить уведомление автору запроса (post-MVP)
    
    return response




def get_request_responses(db: Session, request_id: int, user_id: int) -> List[models.RequestResponse]:
    """Получить отклики на мой запрос"""
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
    """Удалить отклик (только автор отклика)"""
    response = db.query(models.RequestResponse).filter(
        models.RequestResponse.id == response_id,
        models.RequestResponse.user_id == user_id
    ).first()
    
    if not response:
        raise ValueError("Отклик не найден или нет прав")
    
    # Уменьшить счётчик в запросе
    request = db.query(models.Request).filter(models.Request.id == response.request_id).first()
    if request:
        request.responses_count = max(0, request.responses_count - 1)
    
    db.delete(response)
    db.commit()
    return True




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
        # ✅ НОВОЕ: Удаляем изображения перед удалением поста
        if post.images:
            try:
                image_filenames = json.loads(post.images)
                delete_images(image_filenames)
            except Exception as e:
                print(f"⚠️ Ошибка удаления изображений истёкшего поста {post.id}: {e}")
        
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
    
    return {
        'likes_count': likes_count,
        'matches_count': matches_count
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