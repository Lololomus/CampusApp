from fastapi import FastAPI, Depends, HTTPException, Query, Body, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from app import models, schemas, crud
from app.database import get_db, init_db
from app.utils import get_image_urls
import json


app = FastAPI(
    title="Campus App API",
    description="Backend для социальной платформы университета",
    version="2.0.0"
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ✅ НОВОЕ: Статические файлы (изображения)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# Startup
@app.on_event("startup")
def startup_event():
    print("🚀 Запуск сервера...")
    init_db()
    print("✅ База данных готова!")


@app.get("/")
def root():
    return {"message": "Campus App API работает!", "version": "2.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}



# ==================== AUTH ENDPOINTS ====================


@app.post("/auth/telegram", response_model=schemas.UserResponse)
def auth_telegram(telegram_id: int = Query(...), db: Session = Depends(get_db)):
    """Авторизация через Telegram"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user



@app.post("/auth/register", response_model=schemas.UserResponse)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    existing_user = crud.get_user_by_telegram_id(db, user_data.telegram_id)
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    return crud.create_user(db, user_data)



# ==================== USER ENDPOINTS ====================


@app.get("/users/me", response_model=schemas.UserResponse)
def get_current_user(telegram_id: int = Query(...), db: Session = Depends(get_db)):
    """Получить текущего пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user



@app.patch("/users/me", response_model=schemas.UserResponse)
def update_current_user(
    telegram_id: int = Query(...),
    user_update: schemas.UserUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Обновить данные пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверка cooldown для критических полей
    update_data = user_update.model_dump(exclude_unset=True)
    critical_fields = ['university', 'institute', 'course']
    changing_critical = any(
        field in update_data and update_data[field] != getattr(user, field)
        for field in critical_fields
    )
    
    if changing_critical:
        if not crud.can_edit_critical_fields(db, user.id):
            days_left = crud.get_cooldown_days_left(db, user.id)
            raise HTTPException(
                status_code=403,
                detail=f"Можно изменить через {days_left} дней (cooldown 30 дней)"
            )
    
    updated_user = crud.update_user(db, user.id, user_update)
    
    if changing_critical:
        from datetime import datetime
        updated_user.last_profile_edit = datetime.utcnow()
        db.commit()
        db.refresh(updated_user)
    
    return updated_user



@app.get("/users/{user_id}/posts", response_model=List[schemas.PostResponse])
def get_user_posts_endpoint(
    user_id: int,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    # Check requesting user
    requesting_user = crud.get_user_by_telegram_id(db, telegram_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get target user
    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get posts
    posts = crud.get_user_posts(db, user_id, limit, offset)
    
    result = []
    for post in posts:
        tags = json.loads(post.tags) if post.tags else []
        
        # ✅ НОВОЕ: Получаем URL изображений
        images = get_image_urls(post.images) if post.images else []
        
        author_id_data = post.author_id
        
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
        else:
            author_data = schemas.UserShort.from_orm(target_user)
        
        post_dict = {
            "id": post.id,
            "author_id": author_id_data,
            "author": author_data,
            "category": post.category,
            "title": post.title,
            "body": post.body,
            "tags": tags,
            "images": images,  # ✅ НОВОЕ
            "is_anonymous": post.is_anonymous,
            "enable_anonymous_comments": post.enable_anonymous_comments,
            "lost_or_found": post.lost_or_found,
            "item_description": post.item_description,
            "location": post.location,
            "event_name": post.event_name,
            "event_date": post.event_date,
            "event_location": post.event_location,
            "is_important": post.is_important,
            "expires_at": post.expires_at,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "views_count": post.views_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }
        result.append(post_dict)
    
    return result



@app.get("/users/{user_id}/stats")
def get_user_stats(user_id: int, db: Session = Depends(get_db)):
    """Получить статистику пользователя"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return {
        "posts_count": crud.count_user_posts(db, user_id),
        "comments_count": crud.count_user_comments(db, user_id)
    }



# ==================== POST ENDPOINTS (ОБНОВЛЕНЫ) ====================


@app.get("/posts/feed", response_model=schemas.PostsFeedResponse)
def get_posts_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    posts = crud.get_posts(db, skip=skip, limit=limit, category=category)
    
    result = []
    for post in posts:
        tags = json.loads(post.tags) if post.tags else []
        is_liked = crud.is_post_liked_by_user(db, post.id, user.id)
        
        # ✅ НОВОЕ: Получаем URL изображений
        images = get_image_urls(post.images) if post.images else []
        
        author_id_data = post.author_id
        
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
        else:
            author_data = schemas.UserShort.from_orm(post.author) if post.author else None
        
        post_dict = {
            "id": post.id,
            "author_id": author_id_data,
            "author": author_data,
            "category": post.category,
            "title": post.title,
            "body": post.body,
            "tags": tags,
            "images": images,  # ✅ НОВОЕ
            "is_anonymous": post.is_anonymous,
            "enable_anonymous_comments": post.enable_anonymous_comments,
            "lost_or_found": post.lost_or_found,
            "item_description": post.item_description,
            "location": post.location,
            "event_name": post.event_name,
            "event_date": post.event_date,
            "event_location": post.event_location,
            "is_important": post.is_important,
            "expires_at": post.expires_at,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "views_count": post.views_count,
            "is_liked": is_liked,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }
        result.append(post_dict)
    
    return {
        "items": result,
        "total": len(result),
        "has_more": len(posts) == limit
    }



@app.post("/posts/create", response_model=schemas.PostResponse)
async def create_post_endpoint(
    telegram_id: int = Query(...),
    category: str = Form(...),
    body: str = Form(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_anonymous: Optional[bool] = Form(False),
    lost_or_found: Optional[str] = Form(None),
    item_description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    event_name: Optional[str] = Form(None),
    event_date: Optional[str] = Form(None),
    event_location: Optional[str] = Form(None),
    is_important: Optional[bool] = Form(False),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db)
):
    """Создать новый пост (multipart form)"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    tags_list = json.loads(tags) if tags else []
    
    if category == 'confessions':
        is_anonymous = True
        
        if images and len(images) > 0:
            raise HTTPException(
                status_code=400,
                detail="В категории Confessions нельзя прикреплять изображения (деанонимизация)"
            )
    
    if images and len(images) > 3:
        raise HTTPException(status_code=400, detail="Максимум 3 изображения")
    
    post_data = schemas.PostCreate(
        category=category,
        title=title,
        body=body,
        tags=tags_list,
        is_anonymous=is_anonymous,
        lost_or_found=lost_or_found,
        item_description=item_description,
        location=location,
        event_name=event_name,
        event_date=event_date,
        event_location=event_location,
        is_important=is_important,
        images=[]
    )
    
    try:
        post = await crud.create_post(db, post_data, user.id, uploaded_files=images)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    tags = json.loads(post.tags) if post.tags else []
    
    images_urls = get_image_urls(post.images) if post.images else []
    
    author_data = None
    author_id_data = post.author_id
    
    if post.is_anonymous:
        author_data = {"name": "Аноним"}
        author_id_data = None
    else:
        author_data = schemas.UserShort.from_orm(user)
    
    return {
        "id": post.id,
        "author_id": author_id_data,
        "author": author_data,
        "category": post.category,
        "title": post.title,
        "body": post.body,
        "tags": tags,
        "images": images_urls,
        "is_anonymous": post.is_anonymous,
        "enable_anonymous_comments": post.enable_anonymous_comments,
        "lost_or_found": post.lost_or_found,
        "item_description": post.item_description,
        "location": post.location,
        "event_name": post.event_name,
        "event_date": post.event_date,
        "event_location": post.event_location,
        "is_important": post.is_important,
        "expires_at": post.expires_at,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "views_count": post.views_count,
        "created_at": post.created_at,
        "updated_at": post.updated_at
    }




@app.get("/posts/{post_id}", response_model=schemas.PostResponse)
def get_post_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment views
    crud.increment_post_views(db, post_id)
    
    is_liked = crud.is_post_liked_by_user(db, post_id, user.id)
    tags = json.loads(post.tags) if post.tags else []
    
    # ✅ НОВОЕ: Получаем URL изображений
    images = get_image_urls(post.images) if post.images else []
    
    author_id_data = post.author_id
    
    if post.is_anonymous:
        author_data = {"name": "Аноним"}
    else:
        author_data = schemas.UserShort.from_orm(post.author) if post.author else None
    
    return {
        "id": post.id,
        "author_id": author_id_data,
        "author": author_data,
        "category": post.category,
        "title": post.title,
        "body": post.body,
        "tags": tags,
        "images": images,  # ✅ НОВОЕ
        "is_anonymous": post.is_anonymous,
        "enable_anonymous_comments": post.enable_anonymous_comments,
        "lost_or_found": post.lost_or_found,
        "item_description": post.item_description,
        "location": post.location,
        "event_name": post.event_name,
        "event_date": post.event_date,
        "event_location": post.event_location,
        "is_important": post.is_important,
        "expires_at": post.expires_at,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "views_count": post.views_count,
        "is_liked": is_liked,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    }



@app.delete("/posts/{post_id}")
def delete_post_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить пост"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    
    success = crud.delete_post(db, post_id)
    if not success:
        raise HTTPException(status_code=500, detail="Ошибка удаления")
    
    return {"success": True}


@app.patch("/posts/{post_id}", response_model=schemas.PostResponse)
async def update_post_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    title: Optional[str] = Form(None),
    body: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    lost_or_found: Optional[str] = Form(None),
    item_description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    event_name: Optional[str] = Form(None),
    event_date: Optional[str] = Form(None),
    event_location: Optional[str] = Form(None),
    is_important: Optional[bool] = Form(None),
    new_images: List[UploadFile] = File(default=[]),
    keep_images: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Обновление поста (multipart form)"""
    # Проверка пользователя
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Получение поста
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Проверка прав (только автор может редактировать)
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")
    
    # Парсинг tags из JSON string
    tags_list = json.loads(tags) if tags else None
    
    # Парсинг keep_images
    keep_images_list = json.loads(keep_images) if keep_images else []
    
    # Валидация общего количества изображений
    total_images = len(keep_images_list) + len(new_images)
    if total_images > 3:
        raise HTTPException(status_code=400, detail="Максимум 3 изображения")
    
    # Для confessions нельзя добавлять фото
    if post.category == 'confessions' and (len(new_images) > 0 or len(keep_images_list) > 0):
        raise HTTPException(
            status_code=400,
            detail="В категории Confessions нельзя прикреплять изображения"
        )
    
    # Создаём Pydantic объект вручную
    post_update = schemas.PostUpdate(
        title=title,
        body=body,
        tags=tags_list,
        lost_or_found=lost_or_found,
        item_description=item_description,
        location=location,
        event_name=event_name,
        event_date=event_date,
        event_location=event_location,
        is_important=is_important,
        images=None  # Обработаем отдельно
    )
    
    # Обновление поста
    try:
        updated_post = await crud.update_post(
            db, post_id, post_update,
            new_files=new_images,
            keep_filenames=keep_images_list
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not updated_post:
        raise HTTPException(status_code=500, detail="Failed to update post")
    
    # Формирование ответа
    tags = json.loads(updated_post.tags) if updated_post.tags else []
    
    # Получаем URL изображений
    images_urls = get_image_urls(updated_post.images) if updated_post.images else []
    
    author_data = None
    author_id_data = updated_post.author_id
    if updated_post.is_anonymous:
        author_data = {"name": "Аноним"}
        author_id_data = None
    else:
        author_data = schemas.UserShort.from_orm(user)
    
    return {
        "id": updated_post.id,
        "author_id": author_id_data,
        "author": author_data,
        "category": updated_post.category,
        "title": updated_post.title,
        "body": updated_post.body,
        "tags": tags,
        "images": images_urls,
        "is_anonymous": updated_post.is_anonymous,
        "enable_anonymous_comments": updated_post.enable_anonymous_comments,
        "lost_or_found": updated_post.lost_or_found,
        "item_description": updated_post.item_description,
        "location": updated_post.location,
        "event_name": updated_post.event_name,
        "event_date": updated_post.event_date,
        "event_location": updated_post.event_location,
        "is_important": updated_post.is_important,
        "expires_at": updated_post.expires_at,
        "likes_count": updated_post.likes_count,
        "comments_count": updated_post.comments_count,
        "views_count": updated_post.views_count,
        "created_at": updated_post.created_at,
        "updated_at": updated_post.updated_at
    }


@app.post("/posts/{post_id}/like")
def toggle_post_like_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle лайка поста"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    result = crud.toggle_post_like(db, post_id, user.id)
    return result



# ==================== COMMENT ENDPOINTS (ОБНОВЛЕНЫ) ====================


@app.get("/posts/{post_id}/comments", response_model=schemas.CommentsFeedResponse)
def get_post_comments_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    comments = crud.get_post_comments(db, post_id, user.id)
    result = []
    
    for comment in comments:
        author_data = None
        author_id_data = comment.author_id
        
        if comment.is_anonymous:
            if comment.anonymous_index == 0 or comment.anonymous_index is None:
                author_name = "Аноним"
            else:
                author_name = f"Аноним {comment.anonymous_index}"
            
            author_data = {
                "name": author_name,
                "id": None,
                "telegram_id": None,
                "avatar": None,
                "university": None,
                "institute": None,
                "course": None
            }
            author_id_data = comment.author_id


        else:
            if comment.author:
                author_data = {
                    "id": comment.author.id,
                    "telegram_id": comment.author.telegram_id,
                    "name": comment.author.name,
                    "avatar": comment.author.avatar,
                    "university": comment.author.university,
                    "institute": comment.author.institute,
                    "course": comment.author.course
                }
        
        comment_dict = {
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": author_id_data,
            "author": author_data,
            "body": comment.body,
            "parent_id": comment.parent_id,
            "is_anonymous": comment.is_anonymous,
            "anonymous_index": comment.anonymous_index,
            "is_deleted": comment.is_deleted,
            "likes": comment.likes_count,
            "is_liked": comment.is_liked,   
            "created_at": comment.created_at
        }
        result.append(comment_dict)
    
    return {"items": result, "total": len(result)}



@app.post("/posts/{post_id}/comments", response_model=schemas.CommentResponse)
def create_comment_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    comment_data: schemas.CommentCreate = Body(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    comment = crud.create_comment(db, comment_data, user.id)
    if not comment:
        raise HTTPException(status_code=404, detail="Post not found")
    
    author_data = None
    author_id_data = comment.author_id
    if comment.is_anonymous:
        if comment.anonymous_index == 0 or comment.anonymous_index is None:
            author_name = "Аноним"
        else:
            author_name = f"Аноним {comment.anonymous_index}"
        author_data = {"name": author_name}
        author_id_data = comment.author_id
    else:
        author_data = schemas.UserShort.from_orm(user)
    
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author_id": author_id_data,
        "author": author_data,
        "body": comment.body,
        "parent_id": comment.parent_id,
        "is_anonymous": comment.is_anonymous,
        "anonymous_index": comment.anonymous_index,
        "likes": 0,
        "is_liked": False,
        "created_at": comment.created_at
    }



@app.delete("/comments/{comment_id}")
def delete_comment_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить комментарий"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    result = crud.delete_comment(db, comment_id, user.id)
    return result


@app.patch("/comments/{comment_id}", response_model=schemas.CommentResponse)
def update_comment_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    comment_update: schemas.CommentUpdate = Body(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    comment = crud.update_comment(db, comment_id, comment_update.body, user.id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found or permission denied")
    
    author_data = None
    author_id_data = comment.author_id
    if comment.is_anonymous:
        if comment.anonymous_index == 0 or comment.anonymous_index is None:
            author_name = "Аноним"
        else:
            author_name = f"Аноним {comment.anonymous_index}"
        author_data = {"name": author_name}
        author_id_data = comment.author_id
    else:
        author_data = schemas.UserShort.from_orm(comment.author) if comment.author else None
    
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author_id": author_id_data,
        "author": author_data,
        "body": comment.body,
        "parent_id": comment.parent_id,
        "is_anonymous": comment.is_anonymous,
        "anonymous_index": comment.anonymous_index,
        "is_edited": comment.is_edited,
        "likes": comment.likes_count,
        "is_liked": getattr(comment, 'is_liked', False),
        "created_at": comment.created_at
    }


@app.post("/comments/{comment_id}/like")
def toggle_comment_like_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle лайка комментария"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    result = crud.toggle_comment_like(db, comment_id, user.id)
    return result



# ==================== REQUEST ENDPOINTS (ОБНОВЛЕНО) ====================


@app.post("/api/requests/create", response_model=schemas.RequestResponse)
def create_request_endpoint(
    telegram_id: int = Query(...),
    request_data: schemas.RequestCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Создать запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    try:
        request = crud.create_request(db, request_data, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Формируем автора
    author_data = schemas.RequestAuthor(
        id=user.id,
        name=user.name,
        course=user.course,
        university=user.university,
        institute=user.institute,
        username=user.username
    )
    
    return schemas.RequestResponse(
        id=request.id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=json.loads(request.tags) if request.tags else [],
        expires_at=request.expires_at,
        status=request.status,
        views_count=request.views_count,
        responses_count=0,
        created_at=request.created_at,
        author=author_data,
        is_author=True,
        has_responded=False
    )



@app.get("/api/requests/feed", response_model=schemas.RequestsFeedResponse)
def get_requests_feed_endpoint(
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    telegram_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Получить ленту запросов (с умной сортировкой)"""
    # Определяем current_user_id если авторизован
    current_user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            current_user_id = user.id
    
    # Получаем ленту
    feed_data = crud.get_requests_feed(db, category, limit, offset, current_user_id)
    
    # Формируем ответ
    items = []
    for req_dict in feed_data['items']:
        author_data = schemas.RequestAuthor(
            id=req_dict['author'].id,
            name=req_dict['author'].name,
            course=req_dict['author'].course,
            university=req_dict['author'].university,
            institute=req_dict['author'].institute,
            username=req_dict['author'].username
        )
        
        items.append(schemas.RequestResponse(
            id=req_dict['id'],
            category=req_dict['category'],
            title=req_dict['title'],
            body=req_dict['body'],
            tags=req_dict['tags'],
            expires_at=req_dict['expires_at'],
            status=req_dict['status'],
            views_count=req_dict['views_count'],
            responses_count=req_dict['responses_count'],
            created_at=req_dict['created_at'],
            author=author_data,
            is_author=req_dict['is_author'],
            has_responded=req_dict['has_responded']
        ))
    
    return schemas.RequestsFeedResponse(
        items=items,
        total=feed_data['total'],
        has_more=feed_data['has_more']
    )



@app.get("/api/requests/{request_id}", response_model=schemas.RequestResponse)
def get_request_endpoint(
    request_id: int,
    telegram_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Получить запрос по ID"""
    # Определяем current_user_id
    current_user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            current_user_id = user.id
    
    request_dict = crud.get_request_by_id(db, request_id, current_user_id)
    if not request_dict:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    
    # Формируем автора
    author_data = schemas.RequestAuthor(
        id=request_dict['author'].id,
        name=request_dict['author'].name,
        course=request_dict['author'].course,
        university=request_dict['author'].university,
        institute=request_dict['author'].institute,
        username=request_dict['author'].username
    )
    
    return schemas.RequestResponse(
        id=request_dict['id'],
        category=request_dict['category'],
        title=request_dict['title'],
        body=request_dict['body'],
        tags=request_dict['tags'],
        expires_at=request_dict['expires_at'],
        status=request_dict['status'],
        views_count=request_dict['views_count'],
        responses_count=request_dict['responses_count'],
        created_at=request_dict['created_at'],
        author=author_data,
        is_author=request_dict['is_author'],
        has_responded=request_dict['has_responded']
    )



@app.put("/api/requests/{request_id}", response_model=schemas.RequestResponse)
def update_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    data: schemas.RequestUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Обновить запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    try:
        request = crud.update_request(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    # Формируем автора
    author_data = schemas.RequestAuthor(
        id=user.id,
        name=user.name,
        course=user.course,
        university=user.university,
        institute=user.institute,
        username=user.username
    )
    
    return schemas.RequestResponse(
        id=request.id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=json.loads(request.tags) if request.tags else [],
        expires_at=request.expires_at,
        status=request.status,
        views_count=request.views_count,
        responses_count=len(request.responses) if request.responses else 0,
        created_at=request.created_at,
        author=author_data,
        is_author=True,
        has_responded=False
    )



@app.delete("/api/requests/{request_id}")
def delete_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    try:
        crud.delete_request(db, request_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))



@app.get("/api/requests/my/list")
def get_my_requests_endpoint(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить мои запросы"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return crud.get_my_requests(db, user.id)



@app.post("/api/requests/{request_id}/respond", response_model=schemas.ResponseItem)
def create_response_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    data: schemas.ResponseCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Откликнуться на запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    try:
        response = crud.create_response(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Формируем автора
    author_data = schemas.ResponseAuthor(
        id=user.id,
        name=user.name,
        username=user.username
    )
    
    return schemas.ResponseItem(
        id=response.id,
        message=response.message,
        telegram_contact=response.telegram_contact,
        created_at=response.created_at,
        author=author_data
    )



@app.get("/api/requests/{request_id}/responses", response_model=List[schemas.ResponseItem])
def get_responses_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить отклики на мой запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    try:
        responses = crud.get_request_responses(db, request_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    # Формируем ответ
    result = []
    for resp in responses:
        author_data = schemas.ResponseAuthor(
            id=resp.author.id,
            name=resp.author.name,
            username=resp.author.username
        )
        
        result.append(schemas.ResponseItem(
            id=resp.id,
            message=resp.message,
            telegram_contact=resp.telegram_contact,
            created_at=resp.created_at,
            author=author_data
        ))
    
    return result



@app.delete("/api/responses/{response_id}")
def delete_response_endpoint(
    response_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить отклик"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    try:
        crud.delete_response(db, response_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))



# ==================== DATING ENDPOINTS ====================


@app.get("/dating/feed", response_model=schemas.DatingFeedResponse)
def get_dating_feed_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    course: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Получить ленту профилей для знакомств"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    users = crud.get_dating_feed(
        db, user.id, limit, offset,
        university=university, institute=institute, course=course
    )
    
    result = []
    for u in users:
        interests_list = json.loads(u.interests) if u.interests else []
        
        profile = {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "age": u.age,
            "bio": u.bio,
            "university": u.university,
            "institute": u.institute,
            "course": None if u.hide_course_group else u.course,
            "group": None if u.hide_course_group else u.group,
            "interests": interests_list,
            "active_request": None
        }
        result.append(profile)
    
    return {
        "items": result,
        "total": len(result),
        "has_more": len(users) == limit
    }


@app.post("/dating/like", response_model=schemas.LikeResult)
def like_user_endpoint(
    telegram_id: int = Query(...),
    like_data: schemas.LikeCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Лайкнуть пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = crud.create_like(db, user.id, like_data.liked_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    response = {
        "success": True,
        "is_match": result.get("is_match", False),
        "match_id": None,
        "matched_user": None
    }
    
    if result.get("is_match"):
        matched_user = result.get("matched_user")
        response["match_id"] = result.get("match_id")
        response["matched_user"] = schemas.UserShort.from_orm(matched_user) if matched_user else None
    
    return response



@app.get("/dating/likes", response_model=List[schemas.DatingProfile])
def get_who_liked_me_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить тех, кто меня лайкнул"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    users = crud.get_who_liked_me(db, user.id, limit, offset)
    
    result = []
    for u in users:
        interests_list = json.loads(u.interests) if u.interests else []
        
        profile = {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "age": u.age,
            "bio": u.bio,
            "university": u.university,
            "institute": u.institute,
            "course": None if u.hide_course_group else u.course,
            "group": None if u.hide_course_group else u.group,
            "interests": interests_list,
            "active_request": None
        }
        result.append(profile)
    
    return result



@app.get("/dating/matches", response_model=List[schemas.MatchResponse])
def get_my_matches_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить мои матчи"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    matches = crud.get_my_matches(db, user.id, limit, offset)
    
    result = []
    for match in matches:
        result.append({
            "id": match["id"],
            "user_a_id": 0,  # не важно
            "user_b_id": 0,  # не важно
            "matched_at": match["matched_at"],
            "matched_user": schemas.UserShort.from_orm(match["matched_user"])
        })
    
    return result



@app.get("/dating/stats", response_model=schemas.DatingStatsResponse)
def get_dating_stats_endpoint(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить статистику знакомств"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stats = crud.get_dating_stats(db, user.id)
    
    return {
        "likes_count": stats["likes_count"],
        "matches_count": stats["matches_count"],
    }


@app.patch("/me/dating-settings", response_model=schemas.UserResponse)
def update_dating_settings_endpoint(
    telegram_id: int = Query(...),
    settings: schemas.DatingSettings = Body(...),
    db: Session = Depends(get_db)
):
    """Обновить настройки приватности dating"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings_dict = settings.model_dump(exclude_unset=True)
    updated_user = crud.update_dating_settings(db, user.id, settings_dict)
    
    return updated_user



# ==================== DEV ENDPOINTS ====================


@app.post("/dev/generate-mock-dating-data")
def generate_mock_dating_data(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Генерация мок-данных для dating (только для разработки!)"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    mock_users = [
        {"telegram_id": 999000001, "name": "Алексей", "age": 19, "bio": "Программист", "university": user.university, "institute": user.institute, "course": 2, "group": "ИВТ-23", "interests": '["python","музыка","спорт"]', "show_in_dating": True},
        {"telegram_id": 999000002, "name": "Мария", "age": 21, "bio": "Дизайнер. Люблю рисовать и путешествовать!", "university": user.university, "institute": user.institute, "course": 3, "group": "ДИЗ-31", "interests": '["дизайн","арт","кофе"]', "show_in_dating": True},
        {"telegram_id": 999000003, "name": "Дмитрий", "age": 20, "bio": "Увлекаюсь ML и AI", "university": user.university, "institute": user.institute, "course": 2, "group": "ИВТ-22", "interests": '["python","ML","AI"]', "show_in_dating": True},
        {"telegram_id": 999000004, "name": "Анна", "age": 22, "bio": "Обожаю спорт и активный отдых. Давайте в зал!", "university": user.university, "institute": user.institute, "course": 4, "group": "ФК-41", "interests": '["спорт","фитнес","travel"]', "show_in_dating": True},
        {"telegram_id": 999000005, "name": "Игорь", "age": 19, "bio": "Люблю читать книги", "university": user.university, "institute": user.institute, "course": 1, "group": "ФИЛ-13", "interests": '["книги","литература"]', "show_in_dating": True},
    ]
    
    created_users = []
    for mock_data in mock_users:
        existing = crud.get_user_by_telegram_id(db, mock_data["telegram_id"])
        if not existing:
            new_user = models.User(**mock_data)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            created_users.append(new_user.name)
        else:
            created_users.append(f"{existing.name} (уже был)")
    
    return {
        "success": True,
        "message": f"Создано/проверено {len(created_users)} пользователей",
        "users": created_users
    }

# ==================== MARKET ENDPOINTS ====================

@app.get("/market/feed", response_model=schemas.MarketFeedResponse)
def get_market_feed_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    price_min: Optional[int] = Query(None, ge=0),
    price_max: Optional[int] = Query(None, ge=0),
    condition: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    sort: str = Query("newest"),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Лента товаров барахолки"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    feed_data = crud.get_market_items(
        db, skip, limit,
        category=category,
        price_min=price_min,
        price_max=price_max,
        condition=condition,
        university=university,
        institute=institute,
        sort=sort,
        current_user_id=user.id
    )
    
    result = []
    for item in feed_data['items']:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = schemas.MarketSeller(
            id=item.seller.id,
            name=item.seller.name,
            username=item.seller.username,
            university=item.seller.university,
            institute=item.seller.institute,
            course=item.seller.course
        )
        
        is_favorited = crud.is_item_favorited(db, item.id, user.id)
        is_seller = item.seller_id == user.id
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "location": item.location,
            "images": images,
            "status": item.status,
            "university": item.university,
            "institute": item.institute,
            "views_count": item.views_count,
            "favorites_count": item.favorites_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_seller": is_seller,
            "is_favorited": is_favorited
        }
        result.append(item_dict)
    
    return {
        "items": result,
        "total": feed_data['total'],
        "has_more": feed_data['has_more']
    }

@app.get("/market/{item_id}", response_model=schemas.MarketItemResponse)
def get_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить товар по ID"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    item = crud.get_market_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    images = get_image_urls(item.images) if item.images else []
    
    seller_data = schemas.MarketSeller(
        id=item.seller.id,
        name=item.seller.name,
        username=item.seller.username,
        university=item.seller.university,
        institute=item.seller.institute,
        course=item.seller.course
    )
    
    is_favorited = crud.is_item_favorited(db, item.id, user.id)
    is_seller = item.seller_id == user.id
    
    return {
        "id": item.id,
        "seller_id": item.seller_id,
        "seller": seller_data,
        "category": item.category,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "condition": item.condition,
        "location": item.location,
        "images": images,
        "status": item.status,
        "university": item.university,
        "institute": item.institute,
        "views_count": item.views_count,
        "favorites_count": item.favorites_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "is_seller": is_seller,
        "is_favorited": is_favorited
    }

@app.post("/market/items", response_model=schemas.MarketItemResponse)
async def create_market_item_endpoint(
    telegram_id: int = Query(...),
    category: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    price: int = Form(...),
    condition: str = Form(...),
    location: Optional[str] = Form(None),
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Валидация количества фото
    if len(images) < 1:
        raise HTTPException(status_code=400, detail="Необходимо загрузить хотя бы 1 фото")
    if len(images) > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 фото")
    
    # Создаем схему БЕЗ images (файлы передаем отдельно)
    item_data = schemas.MarketItemCreate(
        category=category,
        title=title,
        description=description,
        price=price,
        condition=condition,
        location=location,
        images=["placeholder"]
    )
    
    try:
        item = await crud.create_market_item(db, item_data, user.id, uploaded_files=images)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Формируем ответ
    images_urls = get_image_urls(item.images) if item.images else []
    
    seller_data = schemas.MarketSeller(
        id=user.id,
        name=user.name,
        username=user.username,
        university=user.university,
        institute=user.institute,
        course=user.course
    )
    
    return {
        "id": item.id,
        "seller_id": item.seller_id,
        "seller": seller_data,
        "category": item.category,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "condition": item.condition,
        "location": item.location,
        "images": images_urls,
        "status": item.status,
        "university": item.university,
        "institute": item.institute,
        "views_count": item.views_count,
        "favorites_count": item.favorites_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "is_seller": True,
        "is_favorited": False
    }

@app.patch("/market/{item_id}", response_model=schemas.MarketItemResponse)
async def update_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[int] = Form(None),
    condition: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    new_images: List[UploadFile] = File(default=[]),
    keep_images: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Обновить товар"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    keep_images_list = json.loads(keep_images) if keep_images else []
    
    total_images = len(keep_images_list) + len(new_images)
    if total_images < 1:
        raise HTTPException(status_code=400, detail="Минимум 1 фото обязательно")
    if total_images > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 фото")
    
    item_update = schemas.MarketItemUpdate(
        title=title,
        description=description,
        price=price,
        condition=condition,
        location=location,
        status=status,
        images=None
    )
    
    try:
        updated_item = await crud.update_market_item(
            db, item_id, user.id, item_update,
            new_files=new_images,
            keep_filenames=keep_images_list
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not updated_item:
        raise HTTPException(status_code=404, detail="Товар не найден или нет прав")
    
    images_urls = get_image_urls(updated_item.images) if updated_item.images else []
    
    seller_data = schemas.MarketSeller(
        id=user.id,
        name=user.name,
        username=user.username,
        university=user.university,
        institute=user.institute,
        course=user.course
    )
    
    is_favorited = crud.is_item_favorited(db, updated_item.id, user.id)
    
    return {
        "id": updated_item.id,
        "seller_id": updated_item.seller_id,
        "seller": seller_data,
        "category": updated_item.category,
        "title": updated_item.title,
        "description": updated_item.description,
        "price": updated_item.price,
        "condition": updated_item.condition,
        "location": updated_item.location,
        "images": images_urls,
        "status": updated_item.status,
        "university": updated_item.university,
        "institute": updated_item.institute,
        "views_count": updated_item.views_count,
        "favorites_count": updated_item.favorites_count,
        "created_at": updated_item.created_at,
        "updated_at": updated_item.updated_at,
        "is_seller": True,
        "is_favorited": is_favorited
    }

@app.delete("/market/{item_id}")
def delete_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить товар"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    success = crud.delete_market_item(db, item_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Товар не найден или нет прав")
    
    return {"success": True}

@app.post("/market/{item_id}/favorite")
def toggle_market_favorite_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle избранное"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    result = crud.toggle_market_favorite(db, item_id, user.id)
    return result

@app.get("/market/favorites", response_model=List[schemas.MarketItemResponse])
def get_market_favorites_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Мои избранные товары"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    items = crud.get_user_favorites(db, user.id, limit, offset)
    
    result = []
    for item in items:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = schemas.MarketSeller(
            id=item.seller.id,
            name=item.seller.name,
            username=item.seller.username,
            university=item.seller.university,
            institute=item.seller.institute,
            course=item.seller.course
        )
        
        is_seller = item.seller_id == user.id
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "location": item.location,
            "images": images,
            "status": item.status,
            "university": item.university,
            "institute": item.institute,
            "views_count": item.views_count,
            "favorites_count": item.favorites_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_seller": is_seller,
            "is_favorited": True
        }
        result.append(item_dict)
    
    return result

@app.get("/market/my-items", response_model=List[schemas.MarketItemResponse])
def get_my_market_items_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Мои объявления"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    items = crud.get_user_market_items(db, user.id, limit, offset)
    
    result = []
    for item in items:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = schemas.MarketSeller(
            id=user.id,
            name=user.name,
            username=user.username,
            university=user.university,
            institute=user.institute,
            course=user.course
        )
        
        is_favorited = crud.is_item_favorited(db, item.id, user.id)
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "location": item.location,
            "images": images,
            "status": item.status,
            "university": item.university,
            "institute": item.institute,
            "views_count": item.views_count,
            "favorites_count": item.favorites_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_seller": True,
            "is_favorited": is_favorited
        }
        result.append(item_dict)
    
    return result

@app.get("/market/categories", response_model=schemas.MarketCategoriesResponse)
def get_market_categories_endpoint(db: Session = Depends(get_db)):
    """Список категорий"""
    categories = crud.get_market_categories(db)
    return categories