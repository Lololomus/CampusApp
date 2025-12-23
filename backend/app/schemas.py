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
    university: Optional[str] = None
    institute: Optional[str] = None
    course: Optional[int] = None
    group: Optional[str] = None

class User(BaseModel):
    id: int
    telegram_id: int
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    university: str
    institute: str
    course: int
    group: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_profile_edit: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserPublic(BaseModel):
    """Публичные данные пользователя (для dating)"""
    id: int
    telegram_id: int
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    university: str
    institute: str
    course: int
    group: Optional[str] = None
    
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
    comments_count: int = 0
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

class CommentUpdate(BaseModel):
    """Обновление комментария"""
    text: str = Field(..., min_length=1)

class Comment(CommentBase):
    """Полная информация о комментарии (для ответа API)"""
    id: int
    post_id: int
    author_id: int
    author: Optional['User'] = None
    is_liked: bool = False
    is_deleted: bool = False
    is_edited: bool = False  # ← НОВОЕ
    likes: int
    created_at: datetime
    updated_at: Optional[datetime] = None  # ← НОВОЕ
    
    class Config:
        from_attributes = True

# ===== REPORT SCHEMAS =====
class CommentReportCreate(BaseModel):
    """Создание жалобы на комментарий"""
    comment_id: int
    reason: str = Field(..., pattern="^(spam|abuse|inappropriate)$")
    description: Optional[str] = None

class CommentReport(BaseModel):
    """Информация о жалобе"""
    id: int
    comment_id: int
    reporter_id: int
    reason: str
    description: Optional[str]
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

# ===== DATING SCHEMAS =====

class LikeCreate(BaseModel):
    """Создание лайка"""
    liked_id: int


class LikeResponse(BaseModel):
    """Ответ на лайк"""
    id: int
    liker_id: int
    liked_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class LikeActionResponse(BaseModel):
    """Результат лайка (с проверкой на матч)"""
    success: bool
    is_match: bool = False
    match_id: Optional[int] = None
    matched_user: Optional['UserPublic'] = None
    error: Optional[str] = None


class MatchResponse(BaseModel):
    """Матч"""
    id: int
    matched_at: datetime
    matched_user: 'UserPublic'
    
    class Config:
        from_attributes = True


class DatingProfile(BaseModel):
    """Профиль для ленты знакомств"""
    id: int
    telegram_id: int
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    university: str
    institute: str
    course: Optional[int] = None
    group: Optional[str] = None
    interests: List[str] = []
    
    # Для режимов study/help/hangout
    active_post: Optional['Post'] = None
    
    class Config:
        from_attributes = True


class DatingSettings(BaseModel):
    """Настройки приватности для знакомств"""
    show_in_dating: Optional[bool] = None
    hide_course_group: Optional[bool] = None
    interests: Optional[str] = None  # теги через запятую


class DatingStats(BaseModel):
    """Статистика знакомств"""
    likes_count: int = 0  # кто меня лайкнул
    matches_count: int = 0
    responses_count: int = 0  # отклики на мои посты


class PeopleWithPostsResponse(BaseModel):
    """Список людей с их постами"""
    items: List[DatingProfile]
    has_more: bool