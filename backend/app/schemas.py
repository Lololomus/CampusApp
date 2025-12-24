from pydantic import BaseModel, Field, field_validator
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
    interests: Optional[List[str]] = None

class UserResponse(BaseModel):
    """Ответ с данными пользователя"""
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
    interests: List[str] = []
    show_in_dating: bool = True
    hide_course_group: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_profile_edit: Optional[datetime] = None

    @field_validator('interests', mode='before')
    @classmethod
    def parse_interests(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            import json
            return json.loads(v) if v else []
        return v

    class Config:
        from_attributes = True

class UserShort(BaseModel):
    """Краткие данные пользователя"""
    id: Optional[int] = None           # ОПЦИОНАЛЬНО для анонимов
    telegram_id: Optional[int] = None  # ОПЦИОНАЛЬНО для анонимов
    name: str
    avatar: Optional[str] = None
    university: Optional[str] = None
    institute: Optional[str] = None
    course: Optional[int] = None
    
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
    course: Optional[int] = None
    group: Optional[str] = None
    interests: List[str] = []

    @field_validator('interests', mode='before')
    @classmethod
    def parse_interests(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            import json
            return json.loads(v) if v else []
        return v

    class Config:
        from_attributes = True

# ===== POST SCHEMAS (ОБНОВЛЕНЫ) =====

class PostCreate(BaseModel):
    """Создание поста"""
    category: str
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    tags: List[str] = []
    
    # Анонимность
    is_anonymous: bool = False
    enable_anonymous_comments: bool = False
    
    # Lost & Found
    lost_or_found: Optional[str] = None  # 'lost' | 'found'
    item_description: Optional[str] = None
    location: Optional[str] = None
    
    # Events
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    
    # News
    is_important: bool = False

class PostUpdate(BaseModel):
    """Обновление поста"""
    title: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None

class PostResponse(BaseModel):
    """Ответ с данными поста"""
    id: int
    author_id: Optional[int] = None
    author: Optional[UserShort] = None
    category: str
    title: str
    body: str
    tags: List[str] = []
    
    # Анонимность
    is_anonymous: bool = False
    enable_anonymous_comments: bool = False
    
    # Lost & Found
    lost_or_found: Optional[str] = None
    item_description: Optional[str] = None
    location: Optional[str] = None
    
    # Events
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    
    # News
    is_important: bool = False
    expires_at: Optional[datetime] = None
    
    # Статистика
    likes_count: int = 0
    comments_count: int = 0
    views_count: int = 0
    
    created_at: datetime
    updated_at: Optional[datetime] = None

class PostsFeedResponse(BaseModel):
    """Лента постов"""
    items: List[PostResponse]
    total: int
    has_more: bool

# ===== COMMENT SCHEMAS (ОБНОВЛЕНЫ) =====

class CommentCreate(BaseModel):
    """Создание комментария"""
    post_id: int
    body: str = Field(..., min_length=1)
    parent_id: Optional[int] = None
    is_anonymous: bool = False

class CommentUpdate(BaseModel):
    """Обновление комментария"""
    body: str = Field(..., min_length=1)

class CommentResponse(BaseModel):
    """Ответ с данными комментария"""
    id: int
    post_id: int
    author_id: Optional[int] = None
    author: Optional[UserShort] = None
    body: str
    parent_id: Optional[int] = None
    is_anonymous: bool = False
    anonymous_index: Optional[int] = None
    likes: int = 0
    is_liked: bool = False
    is_deleted: bool = False
    is_edited: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CommentsFeedResponse(BaseModel):
    """Лента комментариев"""
    items: List[CommentResponse]
    total: int

# ===== REQUEST SCHEMAS (НОВОЕ) =====

class RequestCreate(BaseModel):
    """Создание запроса"""
    category: str  # 'study' | 'help' | 'hangout'
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    tags: List[str] = []
    expires_at: datetime
    max_responses: int = 10

class RequestResponse(BaseModel):
    """Ответ с данными запроса"""
    id: int
    author_id: int
    author: Optional[UserShort] = None
    category: str
    title: str
    body: str
    tags: List[str] = []
    expires_at: datetime
    max_responses: int
    responses_count: int = 0
    views_count: int = 0
    status: str  # 'active' | 'closed' | 'expired'
    created_at: datetime

class RequestsFeedResponse(BaseModel):
    """Лента запросов"""
    items: List[RequestResponse]
    total: int
    has_more: bool

class ResponseToRequestCreate(BaseModel):
    """Отклик на запрос"""
    message: str = Field(..., min_length=1, max_length=500)

# ===== REPORT SCHEMAS =====

class CommentReportCreate(BaseModel):
    """Создание жалобы на комментарий"""
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

class LikeResult(BaseModel):
    """Результат лайка (с проверкой на матч)"""
    success: bool
    is_match: bool = False
    match_id: Optional[int] = None
    matched_user: Optional[UserShort] = None

class MatchResponse(BaseModel):
    """Матч"""
    id: int
    user_a_id: int
    user_b_id: int
    matched_at: datetime
    matched_user: UserShort

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
    
    # Для режимов study/help/hangout - активный REQUEST
    active_request: Optional[dict] = None

    @field_validator('interests', mode='before')
    @classmethod
    def parse_interests(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            import json
            return json.loads(v) if v else []
        return v

    class Config:
        from_attributes = True

class DatingFeedResponse(BaseModel):
    """Лента профилей"""
    items: List[DatingProfile]
    total: int
    has_more: bool

class DatingSettings(BaseModel):
    """Настройки приватности для знакомств"""
    show_in_dating: Optional[bool] = None
    hide_course_group: Optional[bool] = None
    interests: Optional[List[str]] = None

class DatingStatsResponse(BaseModel):
    """Статистика знакомств"""
    likes_count: int = 0
    matches_count: int = 0
    responses_count: int = 0