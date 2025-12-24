from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from app import models, schemas, crud
from app.database import get_db, init_db
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
    """Получить посты пользователя"""
    requesting_user = crud.get_user_by_telegram_id(db, telegram_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="Вы не авторизованы")
    
    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    posts = crud.get_user_posts(db, user_id, limit, offset)
    
    # Обрабатываем каждый пост
    result = []
    for post in posts:
        # Парсим теги
        tags = json.loads(post.tags) if post.tags else []
        
        # Обрабатываем анонимность
        author_data = None
        author_id_data = post.author_id
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
            author_id_data = None
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
    
    posts = crud.get_posts(db, skip, limit, category=category)
    
    result = []
    for post in posts:
        tags = json.loads(post.tags) if post.tags else []
        
        is_liked = crud.is_post_liked_by_user(db, post.id, user.id)
        
        author_data = None
        author_id_data = post.author_id
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
            author_id_data = None
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
def create_post_endpoint(
    telegram_id: int = Query(...),
    post_data: schemas.PostCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Создать новый пост"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Для confessions принудительная анонимность
    if post_data.category == 'confessions':
        post_data.is_anonymous = True
    
    post = crud.create_post(db, post_data, user.id)
    
    # Формируем ответ
    tags = json.loads(post.tags) if post.tags else []
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


@app.get("/posts/{postid}", response_model=schemas.PostResponse)
def get_post_endpoint(
    postid: int, 
    telegram_id: int = Query(...), 
    db: Session = Depends(get_db)
):
    # ID поста
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = crud.get_post(db, postid)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Увеличиваем просмотры
    crud.increment_post_views(db, postid)
    
    is_liked = crud.is_post_liked_by_user(db, postid, user.id)
    
    tags = json.loads(post.tags) if post.tags else []
    
    author_data = None
    author_id_data = post.author_id
    if post.is_anonymous:
        author_data = {"name": "Аноним"}
        author_id_data = None
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
def update_post_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    post_update: schemas.PostUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Обновление поста"""
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
    
    # Обновление поста
    updated_post = crud.update_post(db, post_id, post_update)
    if not updated_post:
        raise HTTPException(status_code=500, detail="Failed to update post")
    
    # Формирование ответа
    tags = json.loads(updated_post.tags) if updated_post.tags else []
    
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


# ==================== REQUEST ENDPOINTS (НОВЫЕ) ====================

@app.post("/requests/create", response_model=schemas.RequestResponse)
def create_request_endpoint(
    telegram_id: int = Query(...),
    request_data: schemas.RequestCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Создать запрос (для карточек dating)"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    request = crud.create_request(db, request_data, user.id)
    
    tags = json.loads(request.tags) if request.tags else []
    
    return {
        "id": request.id,
        "author_id": request.author_id,
        "author": schemas.UserShort.from_orm(user),
        "category": request.category,
        "title": request.title,
        "body": request.body,
        "tags": tags,
        "expires_at": request.expires_at,
        "max_responses": request.max_responses,
        "responses_count": request.responses_count,
        "views_count": request.views_count,
        "status": request.status,
        "created_at": request.created_at
    }


@app.get("/requests/feed", response_model=schemas.RequestsFeedResponse)
def get_requests_feed(
    category: str = Query(..., regex="^(study|help|hangout)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить ленту запросов категории"""
    requests = crud.get_active_requests(db, category, limit, offset)
    
    result = []
    for req in requests:
        tags = json.loads(req.tags) if req.tags else []
        
        req_dict = {
            "id": req.id,
            "author_id": req.author_id,
            "author": schemas.UserShort.from_orm(req.author) if req.author else None,
            "category": req.category,
            "title": req.title,
            "body": req.body,
            "tags": tags,
            "expires_at": req.expires_at,
            "max_responses": req.max_responses,
            "responses_count": req.responses_count,
            "views_count": req.views_count,
            "status": req.status,
            "created_at": req.created_at
        }
        result.append(req_dict)
    
    return {
        "items": result,
        "total": len(result),
        "has_more": len(requests) == limit
    }


@app.get("/requests/my")
def get_my_requests(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить мои запросы"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    requests = crud.get_my_requests(db, user.id)
    
    result = []
    for req in requests:
        tags = json.loads(req.tags) if req.tags else []
        
        req_dict = {
            "id": req.id,
            "category": req.category,
            "title": req.title,
            "body": req.body,
            "tags": tags,
            "expires_at": req.expires_at,
            "max_responses": req.max_responses,
            "responses_count": req.responses_count,
            "status": req.status,
            "created_at": req.created_at
        }
        result.append(req_dict)
    
    return result


@app.patch("/requests/{request_id}/close")
def close_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Закрыть запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    success = crud.close_request(db, request_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Запрос не найден или нет прав")
    
    return {"success": True}


@app.post("/requests/{request_id}/respond")
def respond_to_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    response_data: schemas.ResponseToRequestCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Откликнуться на запрос"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    result = crud.respond_to_request(db, request_id, user.id, response_data.message)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


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


@app.get("/dating/people", response_model=schemas.DatingFeedResponse)
def get_people_with_requests_endpoint(
    telegram_id: int = Query(...),
    category: str = Query(..., regex="^(study|help|hangout)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Получить людей с их активными ЗАПРОСАМИ категории X (для карточек).
    ЭТО ОБНОВЛЁННАЯ ВЕРСИЯ - использует requests, не posts!
    """
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    result = crud.get_people_with_requests(
        db, user.id, category, limit, offset,
        university=university, institute=institute
    )
    
    return {
        "items": result["items"],
        "total": len(result["items"]),
        "has_more": result["has_more"]
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
        "responses_count": stats["responses_count"]
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