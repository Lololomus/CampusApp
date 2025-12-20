from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# ===== USER SCHEMAS =====

class UserBase(BaseModel):
    """Базовые поля пользователя"""
    name: str
    university: str
    institute: str
    course: int

class UserCreate(UserBase):
    """Создание нового пользователя"""
    telegram_id: int
    username: Optional[str] = None
    age: Optional[int] = None
    group: Optional[str] = None
    bio: Optional[str] = None

class UserUpdate(BaseModel):
    """Обновление профиля"""
    name: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None

class User(UserBase):
    """Полная информация о пользователе (для ответа API)"""
    id: int
    telegram_id: int
    username: Optional[str]
    age: Optional[int]
    group: Optional[str]
    bio: Optional[str]
    avatar: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== POST SCHEMAS =====

class PostBase(BaseModel):
    """Базовые поля поста"""
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    category: str
    tags: List[str] = []

class PostCreate(PostBase):
    """Создание поста"""
    pass

class PostUpdate(BaseModel):
    """Обновление поста"""
    title: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None

class Post(PostBase):
    id: int
    author_id: int
    author: Optional['User'] = None
    is_liked: bool = False
    university: str
    institute: str
    course: int
    likes: int
    views: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== COMMENT SCHEMAS =====

class CommentBase(BaseModel):
    """Базовые поля комментария"""
    text: str = Field(..., min_length=1)
    parent_id: Optional[int] = None

class CommentCreate(CommentBase):
    """Создание комментария"""
    post_id: int

class Comment(CommentBase):
    """Полная информация о комментарии (для ответа API)"""
    id: int
    post_id: int
    author_id: int
    likes: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== AUTH SCHEMAS =====

class TelegramAuth(BaseModel):
    """Данные для авторизации через Telegram"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class Token(BaseModel):
    """JWT токен для авторизации"""
    access_token: str
    token_type: str = "bearer"