# ===== 📄 ФАЙЛ: backend/app/main.py =====

from fastapi import FastAPI, Depends, HTTPException, Query, Body, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict
from app import models, schemas, crud
from app.database import get_db, init_db
from app.utils import get_image_urls, BASE_URL
import json
from app.routers import dating
import shutil
import uuid
import os
from datetime import datetime, timedelta, timezone

app = FastAPI(
    title="Campus App API",
    description="Backend API для студенческой социальной сети",
    version="2.1.0"
)

# ===== ROUTERS =====
app.include_router(dating.router)

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# ===== STATIC FILES =====
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/images", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ===== STARTUP =====
@app.on_event("startup")
def startup_event():
    print("🚀 Запуск приложения...")
    init_db()
    print("✅ База данных инициализирована!")

@app.get("/")
def root():
    return {"message": "Campus App API ✅", "version": "2.1.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# ===== AUTH ENDPOINTS =====

@app.post("/auth/telegram", response_model=schemas.UserResponse)
def auth_telegram(telegram_id: int = Query(...), db: Session = Depends(get_db)):
    """Авторизация через Telegram"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/auth/register", response_model=schemas.UserResponse)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    existing_user = crud.get_user_by_telegram_id(db, user_data.telegram_id)
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    return crud.create_user(db, user_data)

# ===== USER ENDPOINTS =====

@app.get("/users/me", response_model=schemas.UserResponse)
def get_current_user(telegram_id: int = Query(...), db: Session = Depends(get_db)):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    telegram_id: int = Query(...)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    
    avatar_dir = "uploads/avatars"
    filepath = f"{avatar_dir}/{filename}"
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    avatar_url = f"{BASE_URL}/uploads/avatars/{filename}"
    user.avatar = avatar_url
    db.commit()
    db.refresh(user)
    
    return {"avatar": user.avatar}

@app.patch("/users/me", response_model=schemas.UserResponse)
def update_current_user(
    telegram_id: int = Query(...),
    user_update: schemas.UserUpdate = Body(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    critical_fields = ["university", "institute", "course"]
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
    requesting_user = crud.get_user_by_telegram_id(db, telegram_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    posts = crud.get_user_posts(db, user_id, limit, offset)
    
    result = []
    for post in posts:
        tags = json.loads(post.tags) if post.tags else []
        images = get_image_urls(post.images) if post.images else []
        
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
        else:
            author_data = schemas.UserShort.from_orm(target_user)
        
        post_dict = {
            "id": post.id,
            "author_id": post.author_id,
            "author": author_data,
            "category": post.category,
            "title": post.title,
            "body": post.body,
            "tags": tags,
            "images": images,
            "is_anonymous": post.is_anonymous,
            "enable_anonymous_comments": post.enable_anonymous_comments,
            "lost_or_found": post.lost_or_found,
            "item_description": post.item_description,
            "location": post.location,
            "reward_type": post.reward_type,
            "reward_value": post.reward_value,
            "event_name": post.event_name,
            "event_date": post.event_date,
            "event_location": post.event_location,
            "event_contact": post.event_contact,
            "is_important": post.is_important,
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
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "posts_count": crud.count_user_posts(db, user_id),
        "comments_count": crud.count_user_comments(db, user_id),
        "likes_count": crud.count_user_total_likes(db, user_id)
    }

# ===== POST ENDPOINTS + POLLS =====
@app.get("/posts/feed", response_model=schemas.PostsFeedResponse)
def get_posts_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    telegram_id: int = Query(...),
    
    # ПАРАМЕТРЫ ФИЛЬТРАЦИИ
    university: Optional[str] = Query(None),      # Фильтр по университету
    institute: Optional[str] = Query(None),       # Фильтр по институту
    tags: Optional[str] = Query(None),            # Comma-separated: "помощь,срочно"
    date_range: Optional[str] = Query(None),      # 'today' | 'week' | 'month'
    sort: Optional[str] = Query('newest'),        # 'newest' | 'popular' | 'discussed'
    
    db: Session = Depends(get_db)
):
    """Лента постов с фильтрацией"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Передаем все параметры фильтрации в CRUD
    posts = crud.get_posts(
        db, 
        skip=skip, 
        limit=limit, 
        category=category,
        university=university,
        institute=institute,
        tags=tags,
        date_range=date_range,
        sort=sort
    )

    result = []
    for post in posts:
        tags = json.loads(post.tags) if post.tags else []
        is_liked = crud.is_post_liked_by_user(db, post.id, user.id)
        images = get_image_urls(post.images) if post.images else []

        author_id_data = post.author_id if post.is_anonymous else post.author_id
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
            author_id_data = None
        else:
            author_data = schemas.UserShort.from_orm(post.author) if post.author else None

        poll_response = None
        if post.poll:
            user_vote = db.query(models.PollVote).filter(
                models.PollVote.poll_id == post.poll.id,
                models.PollVote.user_id == user.id
            ).first()
            user_votes_indices = json.loads(user_vote.option_indices) if user_vote else []

            options_data = json.loads(post.poll.options)
            options_response = []
            for opt in options_data:
                percentage = (opt['votes'] / post.poll.total_votes * 100) if post.poll.total_votes > 0 else 0
                options_response.append({
                    "text": opt['text'],
                    "votes": opt['votes'],
                    "percentage": round(percentage, 1)
                })

            poll_response = {
                "id": post.poll.id,
                "post_id": post.poll.post_id,
                "question": post.poll.question,
                "options": options_response,
                "type": post.poll.type,
                "correct_option": post.poll.correct_option,
                "allow_multiple": post.poll.allow_multiple,
                "is_anonymous": post.poll.is_anonymous,
                "closes_at": post.poll.closes_at,
                "total_votes": post.poll.total_votes,
                "is_closed": False,
                "user_votes": user_votes_indices
            }

        post_dict = {
            "id": post.id,
            "author_id": author_id_data,
            "author": author_data,
            "category": post.category,
            "title": post.title,
            "body": post.body,
            "tags": tags,
            "images": images,
            "is_anonymous": post.is_anonymous,
            "enable_anonymous_comments": post.enable_anonymous_comments,
            "lost_or_found": post.lost_or_found,
            "item_description": post.item_description,
            "location": post.location,
            "reward_type": post.reward_type,
            "reward_value": post.reward_value,
            "event_name": post.event_name,
            "event_date": post.event_date,
            "event_location": post.event_location,
            "event_contact": post.event_contact,
            "is_important": post.is_important,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "views_count": post.views_count,
            "is_liked": is_liked,
            "poll": poll_response,
            "created_at": post.created_at,
            "updated_at": post.updated_at
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
    reward_type: Optional[str] = Form(None),
    reward_value: Optional[str] = Form(None),
    
    event_name: Optional[str] = Form(None),
    event_date: Optional[str] = Form(None),
    event_location: Optional[str] = Form(None),
    event_contact: Optional[str] = Form(None),
    
    is_important: Optional[bool] = Form(False),
    images: List[UploadFile] = File(default=[]),
    
    poll_data: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    # ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ
    print(f"\n{'='*60}")
    print(f"🔍 POST CREATE REQUEST")
    print(f"{'='*60}")
    print(f"category: {category!r}")
    print(f"title: {title!r}")
    print(f"body: {body!r}")
    print(f"is_anonymous: {is_anonymous}")
    print(f"images raw list length: {len(images)}")
    
    # ЛОГИРУЕМ КАЖДЫЙ ФАЙЛ
    for idx, img in enumerate(images):
        print(f"  Image [{idx}]: filename={img.filename!r}, content_type={img.content_type}")
    
    print(f"{'='*60}\n")
    
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tags_list = json.loads(tags) if tags else []
    
    # ФИЛЬТРУЕМ ПУСТЫЕ ФАЙЛЫ (ЭТО КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ!)
    valid_images = [
        img for img in images 
        if img.filename and len(img.filename) > 0
    ]
    
    print(f"✅ Valid images after filter: {len(valid_images)}")
    
    # ПРОВЕРКА ДЛЯ CONFESSIONS (ИСПРАВЛЕНО - БЫЛО ВНЕ IF БЛОКА!)
    if category == "confessions":
        is_anonymous = True
        # ❌ ТЕПЕРЬ ПРОВЕРКА ВНУТРИ БЛОКА И ИСПОЛЬЗУЕТ valid_images
        if len(valid_images) > 0:
            raise HTTPException(status_code=400, detail="Confessions не поддерживают изображения")
    
    # ПРОВЕРКА МАКСИМАЛЬНОГО КОЛИЧЕСТВА (ИСПОЛЬЗУЕМ valid_images)
    if len(valid_images) > 3:
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
        reward_type=reward_type,
        reward_value=reward_value,
        event_name=event_name,
        event_date=event_date,
        event_location=event_location,
        event_contact=event_contact,
        is_important=is_important,
        images=[]
    )
    
    try:
        # valid_images ВМЕСТО images
        post = await crud.create_post(db, post_data, user.id, uploaded_files=valid_images)
        
        if poll_data:
            try:
                poll_dict = json.loads(poll_data)
                poll_schema = schemas.PollCreate(**poll_dict)
                crud.create_poll(db, post.id, poll_schema)
            except Exception as e:
                print(f"⚠️ Ошибка создания опроса: {e}")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return get_post_endpoint(post.id, telegram_id, db)

@app.get("/posts/{post_id}", response_model=schemas.PostResponse)
def get_post_endpoint(post_id: int, telegram_id: int = Query(...), db: Session = Depends(get_db)):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    crud.increment_post_views(db, post_id)
    
    is_liked = crud.is_post_liked_by_user(db, post_id, user.id)
    tags = json.loads(post.tags) if post.tags else []
    images = get_image_urls(post.images) if post.images else []
    
    author_id_data = post.author_id if post.is_anonymous else post.author_id
    
    if post.is_anonymous:
        author_data = {"name": "Аноним"}
        author_id_data = None
    else:
        author_data = schemas.UserShort.from_orm(post.author) if post.author else None
    
    poll_response = None
    if post.poll:
        user_vote = db.query(models.PollVote).filter(
            models.PollVote.poll_id == post.poll.id,
            models.PollVote.user_id == user.id
        ).first()
        
        user_votes_indices = json.loads(user_vote.option_indices) if user_vote else []
        
        options_data = json.loads(post.poll.options)
        options_response = []
        for opt in options_data:
            percentage = (opt['votes'] / post.poll.total_votes * 100) if post.poll.total_votes > 0 else 0
            options_response.append({
                "text": opt['text'],
                "votes": opt['votes'],
                "percentage": round(percentage, 1)
            })
        
        poll_response = {
            "id": post.poll.id,
            "post_id": post.poll.post_id,
            "question": post.poll.question,
            "options": options_response,
            "type": post.poll.type,
            "correct_option": post.poll.correct_option,
            "allow_multiple": post.poll.allow_multiple,
            "is_anonymous": post.poll.is_anonymous,
            "closes_at": post.poll.closes_at,
            "total_votes": post.poll.total_votes,
            "is_closed": False,
            "user_votes": user_votes_indices
        }
    
    return {
        "id": post.id,
        "author_id": author_id_data,
        "author": author_data,
        "category": post.category,
        "title": post.title,
        "body": post.body,
        "tags": tags,
        "images": images,
        "is_anonymous": post.is_anonymous,
        "enable_anonymous_comments": post.enable_anonymous_comments,
        "lost_or_found": post.lost_or_found,
        "item_description": post.item_description,
        "location": post.location,
        "reward_type": post.reward_type,
        "reward_value": post.reward_value,
        "event_name": post.event_name,
        "event_date": post.event_date,
        "event_location": post.event_location,
        "event_contact": post.event_contact,
        "is_important": post.is_important,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "views_count": post.views_count,
        "is_liked": is_liked,
        "poll": poll_response,
        "created_at": post.created_at,
        "updated_at": post.updated_at
    }

@app.delete("/posts/{post_id}")
def delete_post_endpoint(post_id: int, telegram_id: int = Query(...), db: Session = Depends(get_db)):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    success = crud.delete_post(db, post_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete")
    
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
    reward_type: Optional[str] = Form(None),
    reward_value: Optional[str] = Form(None),
    event_name: Optional[str] = Form(None),
    event_date: Optional[str] = Form(None),
    event_location: Optional[str] = Form(None),
    event_contact: Optional[str] = Form(None),
    is_important: Optional[bool] = Form(None),
    new_images: List[UploadFile] = File(default=[]),
    keep_images: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    tags_list = json.loads(tags) if tags else None
    keep_images_list = json.loads(keep_images) if keep_images else []
    
    total_images = len(keep_images_list) + len(new_images)
    if total_images > 3:
        raise HTTPException(status_code=400, detail="Максимум 3 изображения")
    
    if post.category == "confessions" and (len(new_images) > 0 or len(keep_images_list) > 0):
        raise HTTPException(status_code=400, detail="Confessions не поддерживают изображения")
    
    post_update = schemas.PostUpdate(
        title=title,
        body=body,
        tags=tags_list,
        lost_or_found=lost_or_found,
        item_description=item_description,
        location=location,
        reward_type=reward_type,
        reward_value=reward_value,
        event_name=event_name,
        event_date=event_date,
        event_location=event_location,
        event_contact=event_contact,
        is_important=is_important,
        images=None
    )
    
    try:
        updated_post = await crud.update_post(
            db, post_id, post_update,
            new_files=new_images,
            keep_filenames=keep_images_list
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return get_post_endpoint(updated_post.id, telegram_id, db)

@app.post("/posts/{post_id}/like")
def toggle_post_like_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return crud.toggle_post_like(db, post_id, user.id)

# ===== POLL ENDPOINTS (NEW) =====

@app.post("/polls/{poll_id}/vote")
def vote_poll_endpoint(
    poll_id: int,
    vote_data: schemas.PollVoteCreate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        result = crud.vote_poll(db, poll_id, user.id, vote_data.option_indices)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== COMMENT ENDPOINTS =====

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
                author_name = "Автор"
            else:
                author_name = f"Аноним #{comment.anonymous_index}"
            
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
                author_data = schemas.UserShort.from_orm(comment.author).dict()
                author_data['id'] = comment.author.id
                author_data['telegram_id'] = comment.author.telegram_id
        
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
            author_name = "Автор"
        else:
            author_name = f"Аноним #{comment.anonymous_index}"
        author_data = {"name": author_name}
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
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return crud.delete_comment(db, comment_id, user.id)

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
            author_name = "Автор"
        else:
            author_name = f"Аноним #{comment.anonymous_index}"
        author_data = {"name": author_name}
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
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return crud.toggle_comment_like(db, comment_id, user.id)

# ===== REQUEST ENDPOINTS =====

@app.post("/api/requests/create", response_model=schemas.RequestResponse)
async def create_request_endpoint(
    telegram_id: int = Query(...),
    
    # Multipart form fields
    category: str = Form(...),
    title: str = Form(...),
    body: str = Form(...),
    expires_at: str = Form(...),
    tags: Optional[str] = Form(None),
    max_responses: Optional[int] = Form(5),
    
    # ✅ НОВЫЕ ПОЛЯ
    reward_type: Optional[str] = Form(None),
    reward_value: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tags_list = json.loads(tags) if tags else []
    
    if len(images) > 3:
        raise HTTPException(status_code=400, detail="Максимум 3 изображения")
    
    request_data = schemas.RequestCreate(
        category=category,
        title=title,
        body=body,
        tags=tags_list,
        expires_at=expires_at,
        max_responses=max_responses,
        reward_type=reward_type,
        reward_value=reward_value,
        images=[]
    )
    
    try:
        request = await crud.create_request(db, request_data, user.id, uploaded_files=images)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    images_urls = get_image_urls(request.images) if request.images else []
    
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
        has_responded=False,
        reward_type=request.reward_type,
        reward_value=request.reward_value,
        images=images_urls
    )

@app.get("/api/requests/feed", response_model=schemas.RequestsFeedResponse)
def get_requests_feed_endpoint(
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    telegram_id: Optional[int] = Query(None),
    
    # ПАРАМЕТРЫ ФИЛЬТРАЦИИ
    university: Optional[str] = Query(None),      # Фильтр по университету
    institute: Optional[str] = Query(None),       # Фильтр по институту
    status: Optional[str] = Query('active'),      # 'active' | 'all'
    has_reward: Optional[str] = Query(None),      # 'with' | 'without'
    urgency: Optional[str] = Query(None),         # 'soon' (<24h) | 'later'
    sort: Optional[str] = Query('newest'),        # 'newest' | 'expires_soon' | 'most_responses'
    
    db: Session = Depends(get_db)
):
    """Лента запросов с фильтрацией"""
    current_user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            current_user_id = user.id

    # Передаем все параметры фильтрации в CRUD
    feed_data = crud.get_requests_feed(
        db, 
        category, 
        limit, 
        offset, 
        current_user_id,
        university=university,
        institute=institute,
        status=status,
        has_reward=has_reward,
        urgency=urgency,
        sort=sort
    )

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
            has_responded=req_dict['has_responded'],
            reward_type=req_dict.get('reward_type'),
            reward_value=req_dict.get('reward_value'),
            images=req_dict.get('images', [])
        ))

    return schemas.RequestsFeedResponse(
        items=items,
        total=feed_data['total'],
        has_more=feed_data['has_more']
    )

@app.get("/api/requests/my-items", response_model=List[schemas.RequestResponse])
def get_my_requests_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Получить МОИ запросы"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    requests = crud.get_my_requests(db, user.id, limit=limit, offset=offset)
    
    result = []
    for req in requests:
        tags = json.loads(req.tags) if req.tags else []
        images = get_image_urls(req.images) if req.images else []
        
        author_data = schemas.RequestAuthor(
            id=user.id,
            name=user.name,
            course=user.course,
            university=user.university,
            institute=user.institute,
            username=user.username
        )
        
        req_dict = {
            "id": req.id,
            "category": req.category,
            "title": req.title,
            "body": req.body,
            "tags": tags,
            "expires_at": req.expires_at,
            "status": req.status,
            "views_count": req.views_count,
            "responses_count": len(req.responses) if req.responses else 0,
            "created_at": req.created_at,
            "author": author_data,
            "is_author": True,
            "has_responded": False,
            "reward_type": req.reward_type,
            "reward_value": req.reward_value,
            "images": images
        }
        result.append(req_dict)
    
    return result

@app.get("/api/requests/{request_id}", response_model=schemas.RequestResponse)
def get_request_endpoint(
    request_id: int,
    telegram_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    current_user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            current_user_id = user.id
    
    request_dict = crud.get_request_by_id(db, request_id, current_user_id)
    if not request_dict:
        raise HTTPException(status_code=404, detail="Request not found")
    
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
        has_responded=request_dict['has_responded'],
        reward_type=request_dict.get('reward_type'),
        reward_value=request_dict.get('reward_value'),
        images=request_dict.get('images', [])
    )

@app.put("/api/requests/{request_id}", response_model=schemas.RequestResponse)
def update_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    data: schemas.RequestUpdate = Body(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        request = crud.update_request(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    images_urls = get_image_urls(request.images) if request.images else []
    
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
        has_responded=False,
        reward_type=request.reward_type,
        reward_value=request.reward_value,
        images=images_urls
    )

@app.delete("/api/requests/{request_id}")
def delete_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        crud.delete_request(db, request_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/api/requests/{request_id}/respond", response_model=schemas.ResponseItem)
def create_response_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    data: schemas.ResponseCreate = Body(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        response = crud.create_response(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
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
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        responses = crud.get_request_responses(db, request_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
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
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        crud.delete_response(db, response_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

# ===== MARKET ENDPOINTS =====

@app.get("/market/categories", response_model=schemas.MarketCategoriesResponse)
def get_market_categories_endpoint(db: Session = Depends(get_db)):
    return crud.get_market_categories(db)

@app.get("/market/feed", response_model=schemas.MarketFeedResponse)
def get_market_feed_endpoint(
    telegram_id: int = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    sort: Optional[str] = Query("newest"),
    search: Optional[str] = Query(None),
    price_min: Optional[int] = Query(None),
    price_max: Optional[int] = Query(None),
    condition: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    feed_data = crud.get_market_items(
        db,
        skip=skip,
        limit=limit,
        category=category,
        sort=sort,
        search=search,
        price_min=price_min,
        price_max=price_max,
        condition=condition,
        university=university,
        institute=institute,
        current_user_id=user.id
    )
    
    items = []
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
        
        is_seller = item.seller_id == user.id
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
            "is_seller": is_seller,
            "is_favorited": is_favorited
        }
        items.append(item_dict)
    
    return {
        "items": items,
        "total": feed_data['total'],
        "has_more": feed_data['has_more']
    }

@app.get("/market/favorites", response_model=List[schemas.MarketItemResponse])
def get_market_favorites_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    """Получить МОИ товары (которые Я продаю)"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
            "is_favorited": False
        }
        result.append(item_dict)
    
    return result

@app.get("/market/{item_id}", response_model=schemas.MarketItemResponse)
def get_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    item = crud.get_market_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
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
    
    if len(images) < 1:
        raise HTTPException(status_code=400, detail="Минимум 1 фото")
    
    if len(images) > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 фото")
    
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
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    keep_images_list = json.loads(keep_images) if keep_images else []
    
    total_images = len(keep_images_list) + len(new_images)
    if total_images < 1:
        raise HTTPException(status_code=400, detail="Минимум 1 фото")
    
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
        raise HTTPException(status_code=404, detail="Item not found")
    
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
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = crud.delete_market_item(db, item_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"success": True}

@app.post("/market/{item_id}/favorite")
def toggle_market_favorite_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = crud.toggle_market_favorite(db, item_id, user.id)
    return result

# ===== DEV ENDPOINTS =====

@app.post("/dev/generate-mock-dating-data")
def generate_mock_dating_data(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """⚠️ DEV ONLY: Генерирует mock-анкеты для dating!"""
    
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Моковые пользователи
    mock_users = [
        {
            "telegram_id": 999000001,
            "name": "Алексей",
            "age": 19,
            "bio": "Python-разработчик, люблю программирование",
            "university": user.university,
            "institute": user.institute,
            "course": 2,
            "group": "ПИ-23",
            "interests": '["it","music","games"]',
            "show_in_dating": True
        },
        {
            "telegram_id": 999000002,
            "name": "Мария",
            "age": 21,
            "bio": "Обожаю путешествия и искусство. Будем дружить!",
            "university": user.university,
            "institute": user.institute,
            "course": 3,
            "group": "ДП-31",
            "interests": '["art","travel","coffee"]',
            "show_in_dating": True
        },
        {
            "telegram_id": 999000003,
            "name": "Дмитрий",
            "age": 20,
            "bio": "Увлекаюсь ML и AI",
            "university": user.university,
            "institute": user.institute,
            "course": 2,
            "group": "ИИ-22",
            "interests": '["it","science","books"]',
            "show_in_dating": True
        },
        {
            "telegram_id": 999000004,
            "name": "Елена",
            "age": 22,
            "bio": "Спортивная, люблю активный отдых. Пойдём бегать!",
            "university": user.university,
            "institute": user.institute,
            "course": 4,
            "group": "ФК-41",
            "interests": '["sport","fitness","travel"]',
            "show_in_dating": True
        },
        {
            "telegram_id": 999000005,
            "name": "Анна",
            "age": 19,
            "bio": "Люблю читать и пить кофе",
            "university": user.university,
            "institute": user.institute,
            "course": 1,
            "group": "ФЛ-13",
            "interests": '["books","coffee","art"]',
            "show_in_dating": True
        }
    ]
    
    created_users = []
    created_profiles = []
    
    for mock_data in mock_users:
        existing = crud.get_user_by_telegram_id(db, mock_data['telegram_id'])
        if not existing:
            new_user = models.User(**mock_data)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            created_users.append(new_user)
        else:
            created_users.append(existing)
    
    for mock_user in created_users:
        existing_profile = db.query(models.DatingProfile).filter(
            models.DatingProfile.user_id == mock_user.id
        ).first()
        
        if not existing_profile:
            dating_profile = models.DatingProfile(
                user_id=mock_user.id,
                gender="male" if mock_user.name in ["Алексей", "Дмитрий"] else "female",
                age=mock_user.age,
                looking_for="anyone",
                bio=mock_user.bio,
                goals='["friends","study"]',
                photos='[]',
                is_active=True
            )
            db.add(dating_profile)
            db.commit()
            created_profiles.append(mock_user.name)
    
    now = datetime.utcnow()
    matches_created = []
    
    # Матч 1
    user1 = created_users[0]
    match_time_1 = now - timedelta(hours=22)
    user_a_1 = min(user.id, user1.id)
    user_b_1 = max(user.id, user1.id)
    
    existing_match_1 = db.query(models.Match).filter(
        models.Match.user_a_id == user_a_1,
        models.Match.user_b_id == user_b_1
    ).first()
    
    if not existing_match_1:
        match1 = models.Match(user_a_id=user_a_1, user_b_id=user_b_1, matched_at=match_time_1)
        db.add(match1)
        matches_created.append(f"{user1.name} (2 дня назад)")
    
    existing_like_1a = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user.id,
        models.DatingLike.whom_liked_id == user1.id
    ).first()
    if not existing_like_1a:
        like1a = models.DatingLike(who_liked_id=user.id, whom_liked_id=user1.id, is_like=True, matched_at=match_time_1)
        db.add(like1a)
    
    existing_like_1b = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user1.id,
        models.DatingLike.whom_liked_id == user.id
    ).first()
    if not existing_like_1b:
        like1b = models.DatingLike(who_liked_id=user1.id, whom_liked_id=user.id, is_like=True, matched_at=match_time_1)
        db.add(like1b)
    
    # Матч 2
    user2 = created_users[1]
    match_time_2 = now - timedelta(hours=18)
    user_a_2 = min(user.id, user2.id)
    user_b_2 = max(user.id, user2.id)
    
    existing_match_2 = db.query(models.Match).filter(
        models.Match.user_a_id == user_a_2,
        models.Match.user_b_id == user_b_2
    ).first()
    
    if not existing_match_2:
        match2 = models.Match(user_a_id=user_a_2, user_b_id=user_b_2, matched_at=match_time_2)
        db.add(match2)
        matches_created.append(f"{user2.name} (6 часов назад)")
    
    existing_like_2a = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user.id,
        models.DatingLike.whom_liked_id == user2.id
    ).first()
    if not existing_like_2a:
        like2a = models.DatingLike(who_liked_id=user.id, whom_liked_id=user2.id, is_like=True, matched_at=match_time_2)
        db.add(like2a)
    
    existing_like_2b = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user2.id,
        models.DatingLike.whom_liked_id == user.id
    ).first()
    if not existing_like_2b:
        like2b = models.DatingLike(who_liked_id=user2.id, whom_liked_id=user.id, is_like=True, matched_at=match_time_2)
        db.add(like2b)
    
    # Матч 3
    user3 = created_users[2]
    match_time_3 = now - timedelta(hours=9)
    user_a_3 = min(user.id, user3.id)
    user_b_3 = max(user.id, user3.id)
    
    existing_match_3 = db.query(models.Match).filter(
        models.Match.user_a_id == user_a_3,
        models.Match.user_b_id == user_b_3
    ).first()
    
    if not existing_match_3:
        match3 = models.Match(user_a_id=user_a_3, user_b_id=user_b_3, matched_at=match_time_3)
        db.add(match3)
        matches_created.append(f"{user3.name} (15 минут назад)")
    
    existing_like_3a = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user.id,
        models.DatingLike.whom_liked_id == user3.id
    ).first()
    if not existing_like_3a:
        like3a = models.DatingLike(who_liked_id=user.id, whom_liked_id=user3.id, is_like=True, matched_at=match_time_3)
        db.add(like3a)
    
    existing_like_3b = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user3.id,
        models.DatingLike.whom_liked_id == user.id
    ).first()
    if not existing_like_3b:
        like3b = models.DatingLike(who_liked_id=user3.id, whom_liked_id=user.id, is_like=True, matched_at=match_time_3)
        db.add(like3b)
    
    # Обычные лайки (без взаимности)
    user4 = created_users[3]
    existing_like_4 = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user4.id,
        models.DatingLike.whom_liked_id == user.id
    ).first()
    if not existing_like_4:
        like4 = models.DatingLike(who_liked_id=user4.id, whom_liked_id=user.id, is_like=True)
        db.add(like4)
    
    user5 = created_users[4]
    existing_like_5 = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == user5.id,
        models.DatingLike.whom_liked_id == user.id
    ).first()
    if not existing_like_5:
        like5 = models.DatingLike(who_liked_id=user5.id, whom_liked_id=user.id, is_like=True)
        db.add(like5)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Создано {len(created_profiles)} профилей, {len(matches_created)} матчей",
        "profiles": created_profiles,
        "matches": matches_created,
        "regular_likes": "2 лайка без взаимности"
    }