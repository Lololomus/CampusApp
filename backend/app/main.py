from fastapi import FastAPI, Depends, HTTPException, Query
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
    telegram_id: int = Query(None),  # Опциональный параметр
    db: Session = Depends(get_db)
):
    """Получить список постов с фильтрами"""
    posts = crud.get_posts(db, skip, limit, category, university, course)
    
    # Получаем user_id если telegram_id передан
    user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            user_id = user.id
    
    # Конвертируем теги и загружаем автора + проверяем лайк
    for post in posts:
        post.tags = post.get_tags_list()
        post.author = crud.get_user_by_id(db, post.author_id)
        
        # Проверяем лайкнул ли текущий пользователь
        if user_id:
            post.is_liked = crud.is_post_liked_by_user(db, post.id, user_id)
        else:
            post.is_liked = False
    
    return posts

@app.get("/posts/{post_id}", response_model=schemas.Post)
def get_post(
    post_id: int,
    telegram_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """Получить конкретный пост"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    # Увеличиваем просмотры
    crud.increment_post_views(db, post_id)
    
    # Загружаем автора
    post.author = crud.get_user_by_id(db, post.author_id)
    
    # Конвертируем теги
    post.tags = post.get_tags_list()
    
    # Проверяем лайк текущего пользователя
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            post.is_liked = crud.is_post_liked_by_user(db, post.id, user.id)
        else:
            post.is_liked = False
    else:
        post.is_liked = False
    
    return post

@app.post("/posts", response_model=schemas.Post)
def create_post(
    post_data: schemas.PostCreate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Создать новый пост"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    new_post = crud.create_post(db, post_data, user.id, user)
    new_post.tags = new_post.get_tags_list()
    return new_post

@app.post("/posts/{post_id}/like")
def toggle_like_post(
    post_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle лайка поста"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    result = crud.toggle_post_like(db, post_id, user.id)
    return {"success": True, **result}

# ===== COMMENT ENDPOINTS =====

@app.get("/posts/{post_id}/comments", response_model=List[schemas.Comment])
def get_post_comments(
    post_id: int,
    telegram_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """Получить комментарии к посту с авторами и лайками"""
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    
    # Получаем user_id если telegram_id передан
    user_id = None
    if telegram_id:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            user_id = user.id
    
    # Загружаем комментарии с авторами и проверкой лайков
    comments = crud.get_post_comments(db, post_id, user_id)
    
    return comments

@app.post("/comments", response_model=schemas.Comment)
def create_comment(
    comment_data: schemas.CommentCreate,
    telegram_id: int = Query(...),
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
    
    db_comment = crud.create_comment(db, comment_data, user.id)
    
    # Загружаем автора комментария
    db_comment.author = user
    db_comment.is_liked = False
    
    return db_comment

@app.post("/comments/{comment_id}/like")
def toggle_like_comment(
    comment_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Toggle лайка комментария"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем что комментарий существует
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    
    # Toggle лайка
    result = crud.toggle_comment_like(db, comment_id, user.id)
    return {"success": True, **result}

@app.delete("/comments/{comment_id}")
def delete_comment_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Удалить комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Удаляем комментарий
    result = crud.delete_comment(db, comment_id, user.id)
    
    if not result["success"]:
        raise HTTPException(status_code=403, detail=result["error"])
    
    return result

@app.patch("/comments/{comment_id}", response_model=schemas.Comment)
def update_comment_endpoint(
    comment_id: int,
    text: str = Query(..., min_length=1),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Редактировать комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Обновляем комментарий
    updated_comment = crud.update_comment(db, comment_id, text, user.id)
    
    if not updated_comment:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование или комментарий не найден")
    
    # Загружаем автора
    updated_comment.author = crud.get_user_by_id(db, updated_comment.author_id)
    updated_comment.is_liked = crud.is_comment_liked_by_user(db, comment_id, user.id)
    
    return updated_comment


@app.post("/comments/{comment_id}/report", response_model=schemas.CommentReport)
def report_comment(
    comment_id: int,
    report_data: schemas.CommentReportCreate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Пожаловаться на комментарий"""
    # Проверяем что пользователь существует
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Создаём жалобу
    report = crud.create_comment_report(
        db, 
        comment_id, 
        user.id, 
        report_data.reason, 
        report_data.description
    )
    
    if not report:
        raise HTTPException(status_code=400, detail="Невозможно создать жалобу")
    
    return report