from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    avatar = Column(String(500), nullable=True)
    
    # Академическая инфа
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=False)
    course = Column(Integer, nullable=True)
    group = Column(String(100), nullable=True)
    
    # Dating поля
    show_in_dating = Column(Boolean, default=True)  # показывать в знакомствах
    hide_course_group = Column(Boolean, default=False)  # скрыть курс/группу
    interests = Column(Text, nullable=True)  # JSON array как строка: ["python", "спорт"]
    dating_profile = relationship("DatingProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # Метаданные
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_profile_edit = Column(DateTime, nullable=True)  # для cooldown редактирования
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Отношения
    posts = relationship('Post', back_populates='author', cascade='all, delete-orphan')
    requests = relationship('Request', back_populates='author', cascade='all, delete-orphan')
    comments = relationship('Comment', back_populates='author', cascade='all, delete-orphan')
    
    # Dating отношения
    likes_given = relationship('Like', foreign_keys='Like.liker_id', back_populates='liker', cascade='all, delete-orphan')
    likes_received = relationship('Like', foreign_keys='Like.liked_id', back_populates='liked', cascade='all, delete-orphan')
    
    # Market отношения
    market_items = relationship('MarketItem', back_populates='seller', cascade='all, delete-orphan')
    market_favorites = relationship('MarketFavorite', back_populates='user', cascade='all, delete-orphan')

class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # НОВЫЕ категории (general/confessions/lost_found/news/events)
    category = Column(
        Enum('general', 'confessions', 'lost_found', 'news', 'events', 'polls', name='post_category_enum'),
        nullable=False,
        index=True
    )
    
    title = Column(String(200), nullable=True)
    body = Column(Text, nullable=False)
    tags = Column(Text, nullable=True)  # JSON array: '["python", "react"]'
    images = Column(Text, nullable=True)  # JSON array Base64 строк
    
    # АНОНИМНОСТЬ
    is_anonymous = Column(Boolean, default=False)  # пост анонимный
    enable_anonymous_comments = Column(Boolean, default=False)  # комменты анонимные
    
    # Для lost_found
    lost_or_found = Column(Enum('lost', 'found', name='lost_found_enum'), nullable=True)
    item_description = Column(String(500), nullable=True)
    location = Column(String(200), nullable=True)
    
    # ✅ НОВЫЕ ПОЛЯ (REFACTOR)
    reward_type = Column(String(50), nullable=True)    # "money" | "gift" | "favor"
    reward_value = Column(String(255), nullable=True)  # "500 руб" или описание
    
    # Для events
    event_name = Column(String(200), nullable=True)
    event_date = Column(DateTime, nullable=True)
    event_location = Column(String(200), nullable=True)
    
    # ✅ НОВЫЕ ПОЛЯ (REFACTOR)
    event_contact = Column(String(255), nullable=True) # Telegram или email организатора
    
    # Общее
    is_important = Column(Boolean, default=False)  # закреплённость (для news)
    
    # ❌ УДАЛЕНО: expires_at (больше не используем автоудаление для lost_found)
    
    # Счётчики
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    author = relationship('User', back_populates='posts')
    comments = relationship('Comment', back_populates='post', cascade='all, delete-orphan')
    
    # ✅ НОВОЕ ОТНОШЕНИЕ (Polls)
    poll = relationship("Poll", back_populates="post", uselist=False, cascade="all, delete-orphan")

class Poll(Base):
    """
    Модель опроса для постов (НОВОЕ)
    """
    __tablename__ = "polls"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    question = Column(String(500), nullable=False)
    options = Column(Text, nullable=False)  # JSON: [{"text": "Вариант 1", "votes": 5}, ...]
    
    type = Column(String(20), default="regular")  # "regular" | "quiz"
    correct_option = Column(Integer, nullable=True)  # Индекс правильного ответа для quiz
    
    allow_multiple = Column(Boolean, default=False)
    is_anonymous = Column(Boolean, default=True)
    
    closes_at = Column(DateTime, nullable=True)
    total_votes = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    post = relationship("Post", back_populates="poll")
    votes = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")

class PollVote(Base):
    """
    Голос пользователя в опросе (НОВОЕ)
    """
    __tablename__ = "poll_votes"
    
    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    option_indices = Column(Text, nullable=False)  # JSON: [0, 2] (для множественного выбора)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    poll = relationship("Poll", back_populates="votes")
    user = relationship("User")
    
    __table_args__ = (
        UniqueConstraint('poll_id', 'user_id', name='unique_poll_vote'),
    )

class PostLike(Base):
    """
    Лайки для постов
    """
    __tablename__ = 'post_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Ограничения
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='unique_post_like'),
    )

class Request(Base):
    """
    Запросы для карточек Dating (study/help/hangout)
    Временные, исчезают после откликов или expires_at
    """
    __tablename__ = 'requests'
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Только 3 категории для карточек
    category = Column(
        Enum('study', 'help', 'hangout', name='request_category_enum'),
        nullable=False,
        index=True
    )
    
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    tags = Column(Text, nullable=True)  # JSON array
    
    # Временность (ОБЯЗАТЕЛЬНО)
    expires_at = Column(DateTime, nullable=False, index=True)
    max_responses = Column(Integer, default=5)
    status = Column(
        Enum('active', 'closed', 'expired', name='request_status_enum'),
        default='active',
        index=True
    )
    
    # Счётчики
    responses_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    author = relationship('User', back_populates='requests')
    responses = relationship('RequestResponse', back_populates='request', cascade='all, delete-orphan')

class RequestResponse(Base):
    """
    Отклики на запросы (ведут в Telegram чат)
    """
    __tablename__ = 'request_responses'
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey('requests.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Контакт (берётся из профиля User.username)
    message = Column(String(500), nullable=True)  # optional сообщение
    telegram_contact = Column(String(255), nullable=True)  # @username
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Отношения
    request = relationship('Request', back_populates='responses')
    author = relationship('User')
    
    # Ограничения (один пользователь = один отклик на запрос)
    __table_args__ = (
        UniqueConstraint('request_id', 'user_id', name='unique_request_response'),
    )

class Comment(Base):
    __tablename__ = 'comments'
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    parent_id = Column(Integer, ForeignKey('comments.id', ondelete='CASCADE'), nullable=True)
    body = Column(Text, nullable=False)
    
    # АНОНИМНОСТЬ
    is_anonymous = Column(Boolean, default=False)
    anonymous_index = Column(Integer, nullable=True)
    
    # СТАТУС
    is_deleted = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    
    # ЛАЙКИ
    likes_count = Column(Integer, default=0)
    
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Отношения
    post = relationship('Post', back_populates='comments')
    author = relationship('User', back_populates='comments')

class CommentLike(Base):
    """
    Лайки для комментариев
    """
    __tablename__ = 'comment_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey('comments.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Ограничения
    __table_args__ = (
        UniqueConstraint('comment_id', 'user_id', name='unique_comment_like'),
    )

class Like(Base):
    """
    Лайки для знакомств (dating режим)
    """
    __tablename__ = 'likes'
    
    id = Column(Integer, primary_key=True, index=True)
    liker_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    liked_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Отношения
    liker = relationship('User', foreign_keys=[liker_id], back_populates='likes_given')
    liked = relationship('User', foreign_keys=[liked_id], back_populates='likes_received')
    
    # Ограничения
    __table_args__ = (
        UniqueConstraint('liker_id', 'liked_id', name='unique_like'),
        CheckConstraint('liker_id != liked_id', name='no_self_like'),
    )

class Match(Base):
    """
    Матчи для знакомств (взаимные лайки)
    """
    __tablename__ = 'matches'
    
    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_b_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    matched_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Отношения
    user_a = relationship('User', foreign_keys=[user_a_id])
    user_b = relationship('User', foreign_keys=[user_b_id])
    
    # Ограничения (user_a_id всегда меньше user_b_id для нормализации)
    __table_args__ = (
        UniqueConstraint('user_a_id', 'user_b_id', name='unique_match'),
        CheckConstraint('user_a_id < user_b_id', name='ordered_match'),
    )

# ========================================
# MARKETPLACE
# ========================================

class MarketItem(Base):
    """
    Товары барахолки
    """
    __tablename__ = 'market_items'
    
    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Категория (String, не Enum! Для кастомных категорий)
    category = Column(String(50), nullable=False, index=True)
    
    # Основная информация
    title = Column(String(100), nullable=False)  # 5-100 символов
    description = Column(Text, nullable=False)  # 20-1000 символов
    price = Column(Integer, nullable=False)  # 0-1000000 рублей
    
    # Состояние товара
    condition = Column(
        Enum('new', 'like_new', 'good', 'fair', name='item_condition_enum'),
        nullable=False,
        default='good'
    )
    
    # Локация (опционально, автозаполнение из профиля)
    location = Column(String(200), nullable=True)
    
    # Изображения (JSON array, первое = обложка)
    # Формат: [{"url": "abc.jpg", "w": 800, "h": 600}, ...]
    images = Column(Text, nullable=False)  # минимум 1 фото, максимум 5
    
    # Статус товара
    status = Column(
        Enum('active', 'sold', name='market_status_enum'),
        nullable=False,
        default='active',
        index=True
    )
    
    # Университет/институт продавца (копируются из User при создании)
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=False)
    
    # Счётчики
    views_count = Column(Integer, default=0)
    favorites_count = Column(Integer, default=0)
    
    # Временные метки
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    seller = relationship('User', back_populates='market_items')
    favorites = relationship('MarketFavorite', back_populates='item', cascade='all, delete-orphan')

class MarketFavorite(Base):
    """
    Избранные товары пользователей
    """
    __tablename__ = 'market_favorites'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    item_id = Column(Integer, ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Отношения
    user = relationship('User', back_populates='market_favorites')
    item = relationship('MarketItem', back_populates='favorites')
    
    # Ограничения (один пользователь = один лайк на товар)
    __table_args__ = (
        UniqueConstraint('user_id', 'item_id', name='unique_market_favorite'),
    )

# ===== DATING MODELS =====

class DatingProfile(Base):
    __tablename__ = 'datingprofiles'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    gender = Column(String(50), nullable=False)  # 'male' | 'female'
    age = Column(Integer, nullable=False)  # 16-50
    looking_for = Column(String(50), nullable=False)  # 'male' | 'female' | 'all'
    bio = Column(Text, nullable=True)
    goals = Column(Text, nullable=True)  # JSON string ["relationship", "friends"]
    photos = Column(Text, nullable=True)  # JSON string [{"url": "...", "w": 1000, "h": 1000}]
    lifestyle = Column(Text, nullable=True)  # JSON string ["nightowl", "coffeelover"]
    prompts = Column(Text, nullable=True)  # JSON string [{"question": "...", "answer": "..."}]
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="dating_profile")

class DatingLike(Base):
    __tablename__ = 'dating_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    who_liked_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    whom_liked_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    is_like = Column(Boolean, default=True)  # True = лайк, False = дизлайк/скип
    created_at = Column(DateTime, default=datetime.utcnow)
    matched_at = Column(DateTime, nullable=True)