from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Union, Dict, Any

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
    username: Optional[str] = None
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
    username: Optional[str] = None
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
    id: Optional[int] = None
    telegram_id: Optional[int] = None
    username: Optional[str] = None
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

# ===== POLL SCHEMAS (NEW) =====

class PollCreate(BaseModel):
    """Создание опроса"""
    question: str
    options: List[str]  # Минимум 2, максимум 10
    type: str = "regular"  # "regular" | "quiz"
    correct_option: Optional[int] = None  # Только для quiz
    allow_multiple: bool = False
    is_anonymous: bool = True
    closes_at: Optional[datetime] = None
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v):
        if len(v) < 2:
            raise ValueError('Минимум 2 варианта')
        if len(v) > 10:
            raise ValueError('Максимум 10 вариантов')
        return v

    @field_validator('correct_option')
    @classmethod
    def validate_correct_option(cls, v, info):
        # В Pydantic v2 доступ к values через info.data
        if info.data.get('type') == 'quiz' and v is None:
            raise ValueError('Для quiz обязателен correct_option')
        return v

class PollVoteCreate(BaseModel):
    """Голосование в опросе"""
    option_indices: List[int]  # [0] для одиночного, [0, 2] для множественного

class PollOptionResponse(BaseModel):
    """Вариант ответа в опросе"""
    text: str
    votes: int
    percentage: float
    voters: Optional[List[UserShort]] = None  # Только для неанонимных опросов

class PollResponse(BaseModel):
    """Полная информация об опросе"""
    id: int
    post_id: int
    question: str
    options: List[PollOptionResponse]
    type: str
    correct_option: Optional[int] = None
    allow_multiple: bool
    is_anonymous: bool
    closes_at: Optional[datetime] = None
    total_votes: int
    is_closed: bool
    user_votes: List[int]  # Индексы вариантов, за которые проголосовал текущий юзер
    
    class Config:
        from_attributes = True

# ===== POST SCHEMAS =====

class ImageMeta(BaseModel):
    """
    Модель изображения с метаданными.
    """
    url: str
    w: int
    h: int

class PostCreate(BaseModel):
    category: str
    title: Optional[str] = None
    body: Optional[str] = None
    tags: List[str] = []
    is_anonymous: bool = False
    enable_anonymous_comments: bool = False
    
    # Изображения
    images: List[str] = Field(default=[], max_length=3)
    
    # Lost & Found
    lost_or_found: Optional[str] = None
    item_description: Optional[str] = None
    location: Optional[str] = None
    reward_type: Optional[str] = None
    reward_value: Optional[str] = None
    
    # Events
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    event_contact: Optional[str] = None
    
    # News
    is_important: bool = False
    
    # ✅ Polls
    poll_data: Optional[dict] = None
    
    @field_validator('images')
    @classmethod
    def validate_images(cls, v):
        if len(v) > 3:
            raise ValueError('Максимум 3 изображения на пост')
        return v
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v, info):
        """Для polls заголовок опционален (используется вопрос опроса)"""
        category = info.data.get('category')
        if category != 'polls' and (not v or len(v.strip()) < 3):
            raise ValueError('Заголовок обязателен (мин. 3 символа)')
        return v
    
    @field_validator('body')
    @classmethod
    def validate_body(cls, v, info):
        """Для polls описание опционально"""
        category = info.data.get('category')
        if category != 'polls' and (not v or len(v.strip()) < 10):
            raise ValueError('Описание обязательно (мин. 10 символов)')
        return v
    
    @field_validator('poll_data')
    @classmethod
    def validate_poll_required(cls, v, info):
        """Для category=polls опрос обязателен"""
        category = info.data.get('category')
        if category == 'polls' and not v:
            raise ValueError('Для категории Опросы обязательно создать опрос')
        return v

class PostUpdate(BaseModel):
    """Схема для обновления поста"""
    title: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    is_anonymous: Optional[bool] = None
    
    images: Optional[List[str]] = Field(None, max_length=3)
    
    # Специфичные поля
    lost_or_found: Optional[str] = None
    item_description: Optional[str] = None
    location: Optional[str] = None
    reward_type: Optional[str] = None
    reward_value: Optional[str] = None
    
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    event_contact: Optional[str] = None
    
    is_important: Optional[bool] = None
    
    @field_validator('images')
    @classmethod
    def validate_images(cls, v):
        if v is not None and len(v) > 3:
            raise ValueError('Максимум 3 изображения на пост')
        return v

class PostResponse(BaseModel):
    """Ответ с данными поста"""
    id: int
    author_id: Optional[int] = None
    author: Optional[UserShort] = None
    category: str
    title: str
    body: str
    tags: List[str] = []
    
    images: List[ImageMeta] = []
    
    # Анонимность
    is_anonymous: bool = False
    enable_anonymous_comments: bool = False
    
    # Lost & Found
    lost_or_found: Optional[str] = None
    item_description: Optional[str] = None
    location: Optional[str] = None
    reward_type: Optional[str] = None
    reward_value: Optional[str] = None
    
    # Events
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    event_contact: Optional[str] = None
    
    # News
    is_important: bool = False
    
    # Опрос
    poll: Optional[PollResponse] = None
    
    # Статистика
    likes_count: int = 0
    comments_count: int = 0
    views_count: int = 0
    is_liked: bool = False
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    @field_validator('tags', 'images', mode='before')
    @classmethod
    def parse_json_fields(cls, v):
        if v is None:
            return []
            
        if isinstance(v, list):
            return v
            
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v) if v else []
                return parsed
            except:
                return []
                
        return v

class PostsFeedResponse(BaseModel):
    """Лента постов"""
    items: List[PostResponse]
    total: int
    has_more: bool

# ===== COMMENT SCHEMAS =====

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

# ===== REQUEST SCHEMAS =====

class RequestCreate(BaseModel):
    """Создание запроса"""
    category: str = Field(..., pattern="^(study|help|hangout)$")
    title: str = Field(..., min_length=10, max_length=100)
    body: str = Field(..., min_length=20, max_length=500)
    tags: List[str] = Field(default=[], max_length=5)
    expires_at: datetime
    max_responses: Optional[int] = Field(default=5, ge=1, le=20)
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 5:
            raise ValueError('Максимум 5 тегов')
        return [tag[:20] for tag in v]

class RequestUpdate(BaseModel):
    """Обновление запроса"""
    title: Optional[str] = Field(None, min_length=10, max_length=100)
    body: Optional[str] = Field(None, min_length=20, max_length=500)
    tags: Optional[List[str]] = None
    is_closed: Optional[bool] = None

class RequestAuthor(BaseModel):
    """Автор запроса"""
    id: int
    name: str
    course: Optional[int] = None
    university: str
    institute: str
    username: Optional[str] = None
    
    class Config:
        from_attributes = True

class RequestResponse(BaseModel):
    """Ответ с данными запроса"""
    id: int
    category: str
    title: str
    body: str
    tags: List[str] = []
    expires_at: datetime
    status: str
    views_count: int = 0
    responses_count: int = 0
    created_at: datetime
    author: RequestAuthor
    is_author: bool = False
    has_responded: bool = False
    
    @field_validator('tags', mode='before')
    @classmethod
    def parse_tags(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            import json
            return json.loads(v) if v else []
        return v
    
    class Config:
        from_attributes = True

class RequestsFeedResponse(BaseModel):
    """Лента запросов"""
    items: List[RequestResponse]
    total: int
    has_more: bool

# ===== RESPONSE SCHEMAS =====

class ResponseCreate(BaseModel):
    """Создание отклика на запрос"""
    message: Optional[str] = Field(None, max_length=500)
    telegram_contact: Optional[str] = None

class ResponseAuthor(BaseModel):
    """Автор отклика"""
    id: int
    name: str
    username: Optional[str] = None
    
    class Config:
        from_attributes = True

class ResponseItem(BaseModel):
    """Отклик на запрос"""
    id: int
    message: Optional[str] = None
    telegram_contact: Optional[str] = None
    created_at: datetime
    author: ResponseAuthor
    
    class Config:
        from_attributes = True

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
    """Результат лайка"""
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
    id: int
    telegram_id: int
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    photos: List[Any] = [] 
    university: str
    institute: str
    course: Optional[int] = None
    group: Optional[str] = None
    interests: List[str] = []

    @field_validator('interests', mode='before')
    @classmethod
    def parse_interests(cls, v):
        if v is None: return []
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

# ===== MARKET SCHEMAS =====

class MarketSeller(BaseModel):
    """Продавец товара"""
    id: int
    name: str
    username: Optional[str] = None
    university: str
    institute: str
    course: Optional[int] = None
    
    class Config:
        from_attributes = True

class MarketItemCreate(BaseModel):
    """Создание товара"""
    category: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=5, max_length=100)
    description: str = Field(..., min_length=20, max_length=1000)
    price: int = Field(..., ge=0, le=1000000)
    condition: str = Field(..., pattern="^(new|like_new|good|fair)$")
    location: Optional[str] = Field(None, max_length=200)
    images: List[str] = Field(..., min_length=1, max_length=5)
    
    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        import re
        if not re.match(r'^[а-яА-ЯёЁa-zA-Z0-9\s]+$', v):
            raise ValueError('Категория может содержать только буквы, цифры и пробелы')
        return v.strip()
    
    @field_validator('images')
    @classmethod
    def validate_images(cls, v):
        if len(v) < 1:
            raise ValueError('Минимум 1 фото обязательно')
        if len(v) > 5:
            raise ValueError('Максимум 5 фото')
        return v

class MarketItemUpdate(BaseModel):
    """Обновление товара"""
    title: Optional[str] = Field(None, min_length=5, max_length=100)
    description: Optional[str] = Field(None, min_length=20, max_length=1000)
    price: Optional[int] = Field(None, ge=0, le=1000000)
    condition: Optional[str] = Field(None, pattern="^(new|like_new|good|fair)$")
    location: Optional[str] = Field(None, max_length=200)
    images: Optional[List[str]] = Field(None, min_length=1, max_length=5)
    status: Optional[str] = Field(None, pattern="^(active|sold)$")
    
    @field_validator('images')
    @classmethod
    def validate_images(cls, v):
        if v is not None:
            if len(v) < 1:
                raise ValueError('Минимум 1 фото обязательно')
            if len(v) > 5:
                raise ValueError('Максимум 5 фото')
        return v

class MarketItemResponse(BaseModel):
    """Ответ с данными товара"""
    id: int
    seller_id: int
    seller: MarketSeller
    category: str
    title: str
    description: str
    price: int
    condition: str
    location: Optional[str] = None
    images: List[ImageMeta] = []
    status: str
    university: str
    institute: str
    views_count: int = 0
    favorites_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_seller: bool = False
    is_favorited: bool = False
    
    @field_validator('images', mode='before')
    @classmethod
    def parse_images(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            import json
            try:
                return json.loads(v) if v else []
            except:
                return []
        return v
    
    class Config:
        from_attributes = True

class MarketFeedResponse(BaseModel):
    """Лента товаров"""
    items: List[MarketItemResponse]
    total: int
    has_more: bool

class MarketCategoriesResponse(BaseModel):
    """Список категорий"""
    standard: List[str]
    popular_custom: List[str]

# Схема для создания/обновления анкеты
class DatingProfileCreate(BaseModel):
    gender: str
    looking_for: str
    bio: Optional[str] = None
    goals: List[str] = []
    lifestyle: List[str] = Field(default=[], max_length=2)  # макс 2 элемента
    prompt_question: Optional[str] = Field(None, max_length=100)
    prompt_answer: Optional[str] = Field(None, max_length=100)
    # Фотографии загружаются отдельным списком файлов (UploadFile), 
    # но здесь мы можем принимать метаданные, если нужно.

    @field_validator('goals', mode='before')
    @classmethod
    def parse_goals(cls, v):
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v or []

# Схема для ответа (полная анкета)
class DatingProfileResponse(BaseModel):
    id: int
    user_id: int
    gender: str
    looking_for: str
    bio: Optional[str] = None
    goals: List[str] = []
    photos: List[Any] = [] # List[ImageMeta] или List[str]
    lifestyle: List[str] = []
    prompts: Optional[Dict[str, str]] = None  # {"question": "...", "answer": "..."}
    is_active: bool
    
    # Данные пользователя (для удобства)
    name: str
    age: Optional[int] = None
    university: str
    institute: str
    course: Optional[int] = None

    @field_validator('photos', 'goals', 'lifestyle', 'prompts', mode='before')
    @classmethod
    def parse_json(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except:
                return [] if v != 'prompts' else None
        return v or ([] if v != 'prompts' else None)

    class Config:
        from_attributes = True