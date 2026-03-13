# ===== 📄 ФАЙЛ: backend/app/models.py =====
#
# ✅ Фаза 1.2: Составные индексы для частых запросов
# ✅ Фаза 1.3: MarketItem.institute → nullable=True
# ✅ Фаза 1.4: JSON (Text) → JSONB для всех JSON-полей

from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DateTime, Date, Float, ForeignKey, Enum, CheckConstraint, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone 
from .database import Base


class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    avatar = Column(String(500), nullable=True)
    
    # Академическая инфа — кампус (хардкод из справочника)
    campus_id = Column(String(50), nullable=True, index=True)  # 'ruk_moscow', 'mgu_moscow', null если custom
    
    # Для привязанных (campus_id != null) — денормализованные поля из справочника
    # Для непривязанных (campus_id == null) — пользовательский ввод
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=True)  # nullable=True: факультет не обязателен
    course = Column(Integer, nullable=True)
    group = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    
    # Custom-поля для непривязанных пользователей (campus_id == null)
    custom_university = Column(String(255), nullable=True)
    custom_city = Column(String(100), nullable=True)
    custom_faculty = Column(String(255), nullable=True)
    
    # Роль (user / ambassador / superadmin)
    role = Column(String(20), default='user', nullable=False, index=True)
    
    # Теневой бан (забаненный не знает что забанен, его контент виден только ему)
    is_shadow_banned_posts = Column(Boolean, default=False)
    is_shadow_banned_comments = Column(Boolean, default=False)
    shadow_ban_expires_at = Column(DateTime, nullable=True)  # null = перманентный
    shadow_ban_reason = Column(String(500), nullable=True)
    
    # Privacy настройки
    show_profile = Column(Boolean, default=True)  # Показывать профиль при клике на аватар/имя
    show_telegram_id = Column(Boolean, default=False)  # Показывать @username в профиле
    
    # Dating поля
    show_in_dating = Column(Boolean, default=True)
    hide_course_group = Column(Boolean, default=False)
    interests = Column(JSONB, nullable=True, default=list)  # ✅ JSONB: ["python", "спорт"]
    dating_profile = relationship("DatingProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # Метаданные
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    last_active_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    last_profile_edit = Column(DateTime, nullable=True)
    
    # Отношения
    posts = relationship(
        'Post', 
        foreign_keys='[Post.author_id]',
        back_populates='author', 
        cascade='all, delete-orphan'
    )
    
    # для постов, которые закрепил этот юзер
    pinned_posts = relationship(
        'Post',
        foreign_keys='[Post.pinned_by]',
        cascade='save-update, merge'
    )
    
    # для постов, которые удалил этот модератор
    deleted_posts = relationship(
        'Post',
        foreign_keys='[Post.deleted_by]',
        cascade='save-update, merge'
    )
    requests = relationship(
        'Request', 
        foreign_keys='[Request.author_id]',
        back_populates='author', 
        cascade='all, delete-orphan'
    )
    
    comments = relationship(
        'Comment', 
        foreign_keys='[Comment.author_id]',
        back_populates='author', 
        cascade='all, delete-orphan'
    )
    
    # Dating отношения (Like модель удалена — использовать DatingLike)
    
    # Market отношения
    market_items = relationship(
        'MarketItem', 
        foreign_keys='[MarketItem.seller_id]',
        back_populates='seller', 
        cascade='all, delete-orphan'
    )
    
    market_favorites = relationship(
        'MarketFavorite', 
        foreign_keys='[MarketFavorite.user_id]',
        back_populates='user', 
        cascade='all, delete-orphan'
    )
    auth_sessions = relationship(
        'AuthSession',
        foreign_keys='[AuthSession.user_id]',
        back_populates='user',
        cascade='all, delete-orphan'
    )
    notification_settings = relationship(
        'NotificationSettings',
        back_populates='user',
        uselist=False,
        cascade='all, delete-orphan',
        passive_deletes=True,
    )


class AuthSession(Base):
    __tablename__ = 'auth_sessions'

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    refresh_hash = Column(String(128), nullable=False, unique=True, index=True)
    user_agent = Column(String(500), nullable=True)
    ip = Column(String(64), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, nullable=True, index=True)

    user = relationship('User', back_populates='auth_sessions')


class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    category = Column(
        Enum('general', 'confessions', 'lost_found', 'news', 'events', 'polls', 'ad', name='post_category_enum'),
        nullable=False,
        index=True
    )
    
    title = Column(String(200), nullable=True)
    body = Column(Text, nullable=False)
    tags = Column(JSONB, nullable=True, default=list)      # ✅ JSONB: ["python", "react"]
    images = Column(JSONB, nullable=True, default=list)     # ✅ JSONB: [{url, w, h}, ...]
    
    # АНОНИМНОСТЬ
    is_anonymous = Column(Boolean, default=False)
    enable_anonymous_comments = Column(Boolean, default=False)
    
    # Для lost_found
    lost_or_found = Column(Enum('lost', 'found', name='lost_found_enum'), nullable=True)
    item_description = Column(String(500), nullable=True)
    location = Column(String(200), nullable=True)
    
    reward_type = Column(String(50), nullable=True)
    reward_value = Column(String(255), nullable=True)
    
    # Для events
    event_name = Column(String(200), nullable=True)
    event_date = Column(DateTime, nullable=True)
    event_location = Column(String(200), nullable=True)
    event_contact = Column(String(255), nullable=True)
    
    # Закреплённость
    is_important = Column(Boolean, default=False)
    pinned_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    pinned_at = Column(DateTime, nullable=True)
    
    # Мягкое удаление (модерация)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    deleted_reason = Column(String(500), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    # Счётчики
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Отношения
    author = relationship('User', foreign_keys=[author_id], back_populates='posts')
    comments = relationship('Comment', back_populates='post', cascade='all, delete-orphan')
    poll = relationship("Poll", back_populates="post", uselist=False, cascade="all, delete-orphan")

    # ✅ Фаза 1.2: Составные индексы
    __table_args__ = (
        Index('ix_post_author_deleted', 'author_id', 'is_deleted'),
        Index('ix_post_category_deleted_created', 'category', 'is_deleted', 'created_at'),
    )


class Poll(Base):
    """Модель опроса для постов"""
    __tablename__ = "polls"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    question = Column(String(500), nullable=False)
    options = Column(JSONB, nullable=False)  # ✅ JSONB: [{"text": "Вариант 1", "votes": 5}, ...]
    
    type = Column(String(20), default="regular")  # "regular" | "quiz"
    correct_option = Column(Integer, nullable=True)
    
    allow_multiple = Column(Boolean, default=False)
    is_anonymous = Column(Boolean, default=True)
    
    closes_at = Column(DateTime, nullable=True)
    total_votes = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    # Relationships
    post = relationship("Post", back_populates="poll")
    votes = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")


class PollVote(Base):
    """Голос пользователя в опросе"""
    __tablename__ = "poll_votes"
    
    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    option_indices = Column(JSONB, nullable=False)  # ✅ JSONB: [0, 2]
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    # Relationships
    poll = relationship("Poll", back_populates="votes")
    user = relationship("User")
    
    __table_args__ = (
        UniqueConstraint('poll_id', 'user_id', name='unique_poll_vote'),
    )


class PostLike(Base):
    """Лайки для постов"""
    __tablename__ = 'post_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='unique_post_like'),
    )


class Request(Base):
    """Запросы (study/help/hangout)"""
    __tablename__ = 'requests'
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    category = Column(
        Enum('study', 'help', 'hangout', name='request_category_enum'),
        nullable=False,
        index=True
    )
    
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    tags = Column(JSONB, nullable=True, default=list)       # ✅ JSONB
    
    expires_at = Column(DateTime, nullable=False, index=True)
    max_responses = Column(Integer, default=5)
    status = Column(
        Enum('active', 'closed', 'expired', name='request_status_enum'),
        default='active',
        index=True
    )
    
    reward_type = Column(String(50), nullable=True)
    reward_value = Column(String(255), nullable=True)
    images = Column(JSONB, nullable=True, default=list)     # ✅ JSONB
    
    # Мягкое удаление (модерация)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    deleted_reason = Column(String(500), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    # Счётчики
    responses_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Отношения
    author = relationship('User', foreign_keys=[author_id], back_populates='requests')
    responses = relationship('RequestResponse', back_populates='request', cascade='all, delete-orphan')

    # ✅ Фаза 1.2: Составные индексы
    __table_args__ = (
        Index('ix_request_author_status', 'author_id', 'status'),
        Index('ix_request_status_expires', 'status', 'expires_at'),
    )


class RequestResponse(Base):
    """Отклики на запросы (ведут в Telegram чат)"""
    __tablename__ = 'request_responses'
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey('requests.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    message = Column(String(500), nullable=True)
    telegram_contact = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    # Отношения
    request = relationship('Request', back_populates='responses')
    author = relationship('User')
    
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
    images = Column(JSONB, nullable=False, default=list)
    
    # АНОНИМНОСТЬ
    is_anonymous = Column(Boolean, default=False)
    anonymous_index = Column(Integer, nullable=True)
    
    # СТАТУС
    is_deleted = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    deleted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    deleted_reason = Column(String(500), nullable=True)
    
    # ЛАЙКИ
    likes_count = Column(Integer, default=0)
    
    updated_at = Column(DateTime, nullable=True, onupdate=lambda: datetime.utcnow())
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    # Отношения
    post = relationship('Post', back_populates='comments')
    author = relationship('User', foreign_keys=[author_id], back_populates='comments')

    # ✅ Фаза 1.2: Составной индекс
    __table_args__ = (
        Index('ix_comment_post_created', 'post_id', 'created_at'),
    )


class CommentLike(Base):
    """Лайки для комментариев"""
    __tablename__ = 'comment_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey('comments.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    __table_args__ = (
        UniqueConstraint('comment_id', 'user_id', name='unique_comment_like'),
    )


# NOTE: class Like удалена (Фаза 0.5) — мёртвая модель, не использовалась в CRUD.
# Для dating-лайков используется DatingLike.
# Alembic: DROP TABLE likes;


class Match(Base):
    """Матчи для знакомств (взаимные лайки)"""
    __tablename__ = 'matches'
    
    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_b_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    matched_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    # Отношения
    user_a = relationship('User', foreign_keys=[user_a_id])
    user_b = relationship('User', foreign_keys=[user_b_id])
    
    __table_args__ = (
        UniqueConstraint('user_a_id', 'user_b_id', name='unique_match'),
        CheckConstraint('user_a_id < user_b_id', name='ordered_match'),
    )


# ========================================
# MARKETPLACE
# ========================================


class MarketItem(Base):
    """Товары барахолки"""
    __tablename__ = 'market_items'
    
    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    category = Column(String(50), nullable=False, index=True)
    
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Integer, nullable=False)
    
    condition = Column(
        Enum('new', 'like_new', 'good', 'fair', name='item_condition_enum'),
        nullable=False,
        default='good'
    )
    
    location = Column(String(200), nullable=True)
    images = Column(JSONB, nullable=False)                  # ✅ JSONB
    
    status = Column(
        Enum('active', 'sold', name='market_status_enum'),
        nullable=False,
        default='active',
        index=True
    )
    
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=True)          # ✅ Фаза 1.3: nullable=True
    
    # Мягкое удаление (модерация)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    deleted_reason = Column(String(500), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    # Счётчики
    views_count = Column(Integer, default=0)
    favorites_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Отношения
    seller = relationship(
    'User', 
    foreign_keys=[seller_id],
    back_populates='market_items'
    )
    favorites = relationship('MarketFavorite', back_populates='item', cascade='all, delete-orphan')

    # ✅ Фаза 1.2: Составные индексы
    __table_args__ = (
        Index('ix_market_seller_status', 'seller_id', 'status'),
        Index('ix_market_status_deleted_created', 'status', 'is_deleted', 'created_at'),
    )


class MarketFavorite(Base):
    """Избранные товары пользователей"""
    __tablename__ = 'market_favorites'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    item_id = Column(Integer, ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    user = relationship('User', back_populates='market_favorites')
    item = relationship('MarketItem', back_populates='favorites')
    
    __table_args__ = (
        UniqueConstraint('user_id', 'item_id', name='unique_market_favorite'),
    )


# ========================================
# DATING MODELS
# ========================================


class DatingProfile(Base):
    __tablename__ = 'datingprofiles'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    gender = Column(String(50), nullable=False)
    age = Column(Integer, nullable=False)
    looking_for = Column(String(50), nullable=False)
    bio = Column(Text, nullable=True)
    goals = Column(JSONB, nullable=True, default=list)          # ✅ JSONB
    photos = Column(JSONB, nullable=True, default=list)         # ✅ JSONB
    lifestyle = Column(JSONB, nullable=True, default=list)      # ✅ JSONB
    prompts = Column(JSONB, nullable=True)                      # ✅ JSONB
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    user = relationship("User", back_populates="dating_profile")


class DatingLike(Base):
    __tablename__ = 'dating_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    who_liked_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    whom_liked_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    is_like = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    matched_at = Column(DateTime, nullable=True)

    # ✅ Фаза 1.2: Составной индекс + UniqueConstraint (из Фазы 0.4)
    __table_args__ = (
        UniqueConstraint('who_liked_id', 'whom_liked_id', name='unique_dating_like'),
        Index('ix_dating_like_whom', 'whom_liked_id', 'is_like'),
    )


# ========================================
# МОДЕРАЦИЯ И ЖАЛОБЫ
# ========================================


class ModerationLog(Base):
    """
    Лог всех действий модераторов.
    Каждое действие амбассадора/суперадмина фиксируется здесь.
    """
    __tablename__ = 'moderation_logs'
    
    id = Column(Integer, primary_key=True, index=True)
    moderator_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Что сделал
    action = Column(String(50), nullable=False, index=True)
    # Допустимые значения action:
    # delete_post, delete_comment, delete_request, delete_market_item,
    # restore_post, restore_comment, restore_request, restore_market_item,
    # pin_post, unpin_post,
    # shadow_ban, shadow_unban,
    # assign_ambassador, remove_ambassador,
    # dismiss_report, resolve_report,
    # approve_appeal, reject_appeal
    
    # Над чем
    target_type = Column(String(30), nullable=False, index=True)  # post / comment / request / market_item / user
    target_id = Column(Integer, nullable=False)
    
    # Над кем (владелец контента / забаненный юзер)
    target_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Контекст
    reason = Column(String(500), nullable=True)
    university = Column(String(255), nullable=True)  # вуз в момент действия (для аналитики)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    # Отношения
    moderator = relationship('User', foreign_keys=[moderator_id])
    target_user = relationship('User', foreign_keys=[target_user_id])
    
    __table_args__ = (
        Index('ix_mod_log_moderator_created', 'moderator_id', 'created_at'),
        Index('ix_mod_log_target', 'target_type', 'target_id'),
    )


class Report(Base):
    """
    Жалобы пользователей на контент.
    Универсальная таблица для любого типа контента.
    """
    __tablename__ = 'reports'
    
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Что жалуемся
    target_type = Column(String(30), nullable=False, index=True)  # post / comment / request / market_item / dating_profile / user
    target_id = Column(Integer, nullable=False)
    
    # Причина
    reason = Column(String(50), nullable=False)
    # Допустимые значения: spam, abuse, inappropriate, scam, nsfw, harassment, misinformation, other
    description = Column(String(1000), nullable=True)  # опциональное описание от юзера
    source_type = Column(String(30), nullable=True)  # где отправлена жалоба на user: post/comment/request/market_item/profile
    source_id = Column(Integer, nullable=True)
    
    # Статус обработки
    status = Column(String(20), default='pending', nullable=False, index=True)  # pending / reviewed / dismissed
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    moderator_note = Column(String(500), nullable=True)  # заметка модератора при обработке
    
    # Вуз автора контента (для скоупинга амбассадоров)
    university = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    
    # Отношения
    reporter = relationship('User', foreign_keys=[reporter_id])
    reviewer = relationship('User', foreign_keys=[reviewed_by])
    
    __table_args__ = (
        Index('ix_report_status_university', 'status', 'university'),
        Index('ix_report_target', 'target_type', 'target_id'),
    )


class Appeal(Base):
    """
    Обжалования решений модераторов.
    Пользователь может обжаловать удаление своего контента или бан.
    """
    __tablename__ = 'appeals'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    moderation_log_id = Column(Integer, ForeignKey('moderation_logs.id', ondelete='CASCADE'), nullable=False)
    
    message = Column(String(1000), nullable=False)  # текст обжалования
    
    # Статус
    status = Column(String(20), default='pending', nullable=False, index=True)  # pending / approved / rejected
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewer_note = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Отношения
    user = relationship('User', foreign_keys=[user_id])
    moderation_log = relationship('ModerationLog')
    reviewer = relationship('User', foreign_keys=[reviewed_by])
    
    __table_args__ = (
        UniqueConstraint('user_id', 'moderation_log_id', name='unique_appeal_per_action'),
    )


class PostView(Base):
    """
    Журнал уникальных просмотров постов.
    Гарантирует, что один юзер засчитывает +1 просмотр только один раз.
    """
    __tablename__ = 'post_views'
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    viewed_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='unique_post_view'),
        Index('ix_post_view_user', 'post_id', 'user_id'),
    )


class MarketItemView(Base):
    """
    Журнал уникальных просмотров товаров.
    """
    __tablename__ = 'market_item_views'
    
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    viewed_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    __table_args__ = (
        UniqueConstraint('item_id', 'user_id', name='unique_market_view'),
        Index('ix_market_view_user', 'item_id', 'user_id'),
    )

# ========================================
# РЕКЛАМНАЯ СИСТЕМА (ADS)
# ========================================


class AdPost(Base):
    """
    Рекламный пост — метаданные поверх обычного поста.
    Рекламный пост = обычный Post + запись в ad_posts с доп. полями.
    """
    __tablename__ = 'ad_posts'
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id', ondelete='CASCADE'), unique=True, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Рекламодатель
    advertiser_name = Column(String(200), nullable=False)
    advertiser_logo = Column(String(500), nullable=True)
    
    # Таргетинг
    scope = Column(
        Enum('university', 'city', 'all', name='ad_scope_enum'),
        nullable=False,
        default='university'
    )
    target_university = Column(String(255), nullable=True)
    target_city = Column(String(255), nullable=True)
    
    # Расписание и лимиты
    starts_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    ends_at = Column(DateTime, nullable=True)
    impression_limit = Column(Integer, nullable=True)
    daily_impression_cap = Column(Integer, nullable=True)
    
    # Статус
    status = Column(
        Enum('draft', 'pending_review', 'approved', 'active', 'paused', 'completed', 'rejected', name='ad_status_enum'),
        nullable=False,
        default='draft',
        index=True
    )
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reject_reason = Column(String(500), nullable=True)
    
    # Доп. параметры
    priority = Column(Integer, default=5)  # 1-10
    cta_text = Column(String(100), nullable=True)
    cta_url = Column(String(500), nullable=True)
    
    # Счётчики (денормализованные)
    impressions_count = Column(Integer, default=0)
    unique_views_count = Column(Integer, default=0)
    clicks_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Отношения
    post = relationship('Post', backref='ad_data')
    creator = relationship('User', foreign_keys=[created_by])
    reviewer = relationship('User', foreign_keys=[reviewed_by])
    impressions = relationship('AdImpression', back_populates='ad_post', cascade='all, delete-orphan')
    clicks = relationship('AdClick', back_populates='ad_post', cascade='all, delete-orphan')
    
    __table_args__ = (
        Index('ix_ad_status_scope', 'status', 'scope'),
        Index('ix_ad_starts_ends', 'starts_at', 'ends_at'),
    )


class AdImpression(Base):
    """Показ рекламного поста пользователю"""
    __tablename__ = 'ad_impressions'
    
    id = Column(Integer, primary_key=True, index=True)
    ad_post_id = Column(Integer, ForeignKey('ad_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    viewed_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    ad_post = relationship('AdPost', back_populates='impressions')
    
    __table_args__ = (
        UniqueConstraint('ad_post_id', 'user_id', name='unique_ad_impression'),
        Index('ix_ad_imp_ad_user', 'ad_post_id', 'user_id'),
        Index('ix_ad_imp_date', 'ad_post_id', 'viewed_at'),
    )


class AdClick(Base):
    """Клик по CTA рекламного поста"""
    __tablename__ = 'ad_clicks'
    
    id = Column(Integer, primary_key=True, index=True)
    ad_post_id = Column(Integer, ForeignKey('ad_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    clicked_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    ad_post = relationship('AdPost', back_populates='clicks')
    
    __table_args__ = (
        Index('ix_ad_click_ad_user', 'ad_post_id', 'user_id'),
    )


# ========================================
# ANALYTICS
# ========================================


class AnalyticsEvent(Base):
    """
    Raw analytics events (append-only).
    user_id is never stored here, only anonymized user_hash.
    """
    __tablename__ = 'analytics_events'

    id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String(100), nullable=False, index=True)
    event_ts_utc = Column(DateTime, nullable=False, index=True)
    event_date_msk = Column(Date, nullable=False, index=True)

    user_hash = Column(String(64), nullable=False, index=True)
    session_id = Column(String(128), nullable=True, index=True)
    platform = Column(String(32), nullable=True)
    app_version = Column(String(32), nullable=True)
    screen = Column(String(64), nullable=True)
    entity_type = Column(String(64), nullable=True)
    entity_id = Column(Integer, nullable=True)
    properties_json = Column(JSONB, nullable=False, default=dict)
    ingest_source = Column(String(16), nullable=False, default='client')
    request_id = Column(String(128), nullable=False)
    dedup_key = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)

    __table_args__ = (
        Index('ix_analytics_event_date_name', 'event_date_msk', 'event_name'),
        Index('ix_analytics_event_user_date', 'user_hash', 'event_date_msk'),
    )


class AnalyticsDailyMetric(Base):
    """
    Materialized daily slices for KPI/funnel/retention/module/quality metrics.
    """
    __tablename__ = 'analytics_daily_metrics'

    id = Column(Integer, primary_key=True, index=True)
    date_msk = Column(Date, nullable=False, index=True)
    slice_name = Column(String(32), nullable=False, index=True)  # kpi_daily, funnel_daily, ...
    metric_key = Column(String(128), nullable=False, index=True)
    dimension_key = Column(String(128), nullable=False, default='all', index=True)

    value_num = Column(Float, nullable=False, default=0.0)
    numerator = Column(Float, nullable=True)
    denominator = Column(Float, nullable=True)
    pct_value = Column(Float, nullable=True)
    calc_status = Column(String(32), nullable=False, default='ok')

    computed_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)

    __table_args__ = (
        UniqueConstraint(
            'date_msk', 'slice_name', 'metric_key', 'dimension_key',
            name='uq_analytics_daily_metric'
        ),
        Index('ix_analytics_daily_slice_date', 'slice_name', 'date_msk'),
    )


# ========================================
# УВЕДОМЛЕНИЯ (NOTIFICATIONS)
# ========================================


class NotificationSettings(Base):
    """Настройки уведомлений пользователя"""
    __tablename__ = 'notification_settings'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)

    matches_enabled = Column(Boolean, default=True)
    dating_likes_enabled = Column(Boolean, default=True)
    comments_enabled = Column(Boolean, default=True)
    market_enabled = Column(Boolean, default=True)
    requests_enabled = Column(Boolean, default=True)
    milestones_enabled = Column(Boolean, default=True)
    digest_enabled = Column(Boolean, default=False)
    digest_frequency = Column(String(20), default='weekly')
    mute_all = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(),
                        onupdate=lambda: datetime.utcnow())

    user = relationship('User', back_populates='notification_settings')


class Notification(Base):
    """Очередь уведомлений для Telegram бота"""
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    type = Column(String(50), nullable=False, index=True)
    payload = Column(Text, nullable=False)

    status = Column(String(20), default='pending', nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)
    error = Column(String(500), nullable=True)

    is_read = Column(Boolean, default=False, nullable=False, server_default='false')
    read_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.utcnow(), index=True)

    recipient = relationship('User', foreign_keys=[recipient_id])

    __table_args__ = (
        Index('ix_notif_status_created', 'status', 'created_at'),
    )


class Followup(Base):
    """Отложенные follow-up сообщения (макс 2 попытки)"""
    __tablename__ = 'followups'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    type = Column(String(30), nullable=False)
    target_type = Column(String(30), nullable=False)
    target_id = Column(Integer, nullable=False)
    payload = Column(Text, nullable=False)

    scheduled_at = Column(DateTime, nullable=False, index=True)
    attempt = Column(Integer, default=1)

    status = Column(String(20), default='pending', nullable=False, index=True)
    answer = Column(String(30), nullable=True)
    answered_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.utcnow())

    user = relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        Index('ix_followup_scheduled', 'status', 'scheduled_at'),
        Index('ix_followup_target', 'target_type', 'target_id', 'user_id'),
    )
