from sqlalchemy.orm import Session
from app import models, schemas
from typing import List, Optional

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
    query = db.query(models.Post)
    
    # Фильтры
    if category and category != "all":
        query = query.filter(models.Post.category == category)
    if university and university != "all":
        query = query.filter(models.Post.university == university)
    if course and course != "all":
        query = query.filter(models.Post.course == course)
    
    # Сортировка по дате (новые первые)
    return query.order_by(models.Post.created_at.desc()).offset(skip).limit(limit).all()

def get_post(db: Session, post_id: int) -> Optional[models.Post]:
    """Получить пост по ID"""
    return db.query(models.Post).filter(models.Post.id == post_id).first()

def create_post(db: Session, post: schemas.PostCreate, author_id: int, user: models.User) -> models.Post:
    """Создать новый пост"""
    # Создаём пост с данными из автора
    db_post = models.Post(
        author_id=author_id,
        university=user.university,
        institute=user.institute,
        course=user.course,
        title=post.title,
        body=post.body,
        category=post.category
    )
    
    # Конвертируем теги из списка в строку
    db_post.set_tags_list(post.tags)
    
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
        db_post.set_tags_list(update_data.pop("tags"))
    
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
        db_post.views += 1
        db.commit()

# ===== LIKES (Лайки постов) =====

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
        post.likes = max(0, post.likes - 1)
        db.commit()
        return {"is_liked": False, "likes": post.likes}
    else:
        # Добавляем лайк
        new_like = models.PostLike(user_id=user_id, post_id=post_id)
        db.add(new_like)
        post.likes += 1
        db.commit()
        return {"is_liked": True, "likes": post.likes}

# ===== COMMENT CRUD =====

def get_post_comments(db: Session, post_id: int) -> List[models.Comment]:
    """Получить все комментарии к посту"""
    return db.query(models.Comment).filter(models.Comment.post_id == post_id).order_by(models.Comment.created_at).all()

def create_comment(db: Session, comment: schemas.CommentCreate, author_id: int) -> models.Comment:
    """Создать комментарий"""
    db_comment = models.Comment(
        post_id=comment.post_id,
        author_id=author_id,
        text=comment.text,
        parent_id=comment.parent_id
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def like_comment(db: Session, comment_id: int):
    """Добавить лайк комментарию"""
    db_comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if db_comment:
        db_comment.likes += 1
        db.commit()