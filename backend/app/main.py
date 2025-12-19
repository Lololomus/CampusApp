from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from app import models, schemas, crud, auth
from app.database import get_db, init_db, engine

# Создаём FastAPI приложение
app = FastAPI(
    title="Campus App API",
    description="Backend для студенческой социальной сети",
    version="1.0.0"
)

# CORS - разрешаем фронтенду обращаться к API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В production поставь конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаём таблицы при запуске
@app.on_event("startup")
def startup_event():
    print("🚀 Запуск сервера...")
    init_db()
    print("✅ База данных готова!")


# ===== ПРОВЕРКА РАБОТЫ =====

@app.get("/")
def root():
    """Главная страница - проверка что API работает"""
    return {
        "message": "Campus App API работает! 🎉",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    """Проверка здоровья сервера"""
    return {"status": "ok"}


# ===== AUTH ENDPOINTS =====

@app.post("/auth/telegram", response_model=schemas.User)
def auth_telegram(
    auth_data: schemas.TelegramAuth,
    db: Session = Depends(get_db)
):
    """
    Авторизация через Telegram
    Если пользователь новый - возвращает None (нужна регистрация)
    """
    # Проверяем существует ли пользователь
    user = crud.get_user_by_telegram_id(db, auth_data.telegram_id)
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден. Нужна регистрация."
        )
    
    return user

@app.post("/auth/register", response_model=schemas.User)
def register_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    """Регистрация нового пользователя"""
    # Проверяем что пользователь не существует
    existing_user = crud.get_user_by_telegram_id(db, user_data.telegram_id)
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже зарегистрирован")
    
    # Создаём пользователя
    return crud.create_user(db, user_data)


# ===== USER ENDPOINTS =====

@app.get("/users/me", response_model=schemas.User)
def get_current_user(
    telegram_id: int,
    db: Session = Depends(get_db)
):
    """Получить данные текущего пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user

@app.patch("/users/me", response_model=schemas.User)
def update_current_user(
    telegram_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db)
):
    """Обновить профиль текущего пользователя"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    updated_user = crud.update_user(db, user.id, user_update)
    return updated_user


# ===== POST ENDPOINTS =====

@app.get("/posts", response_model=List[schemas.Post])
def get_posts(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    university: Optional[str] = None,
    course: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Получить список постов с фильтрами"""
    posts = crud.get_posts(db, skip, limit, category, university, course)
    
    # Конвертируем теги из строки в список для каждого поста
    for post in posts:
        post.tags = post.get_tags_list()
    
    return posts

@app.get("/posts/{post_id}", response_model=schemas.Post)
def get_post(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Получить пост по ID"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    # Увеличиваем счётчик просмотров
    crud.increment_post_views(db, post_id)
    
    # Конвертируем теги
    post.tags = post.get_tags_list()
    
    return post

@app.post("/posts", response_model=schemas.Post)
def create_post(
    telegram_id: int,
    post_data: schemas.PostCreate,
    db: Session = Depends(get_db)
):
    """Создать новый пост"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Создаём пост
    new_post = crud.create_post(db, post_data, user.id, user)
    
    # Конвертируем теги
    new_post.tags = new_post.get_tags_list()
    
    return new_post

@app.post("/posts/{post_id}/like")
def like_post(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Лайкнуть пост"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    crud.like_post(db, post_id)
    return {"success": True, "likes": post.likes + 1}


# ===== COMMENT ENDPOINTS =====

@app.get("/posts/{post_id}/comments", response_model=List[schemas.Comment])
def get_post_comments(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Получить комментарии к посту"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    return crud.get_post_comments(db, post_id)

@app.post("/comments", response_model=schemas.Comment)
def create_comment(
    telegram_id: int,
    comment_data: schemas.CommentCreate,
    db: Session = Depends(get_db)
):
    """Создать комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем что пост существует
    post = crud.get_post(db, comment_data.post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    return crud.create_comment(db, comment_data, user.id)

@app.post("/comments/{comment_id}/like")
def like_comment(
    comment_id: int,
    db: Session = Depends(get_db)
):
    """Лайкнуть комментарий"""
    crud.like_comment(db, comment_id)
    return {"success": True}