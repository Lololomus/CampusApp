# ===== 📄 ФАЙЛ: backend/app/models.py =====

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum, CheckConstraint, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone 
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
    
    # Роль (user / ambassador / superadmin)
    role = Column(String(20), default='user', nullable=False, index=True)
    
    # Теневой бан (забаненный не знает что забанен, его контент виден только ему)
    is_shadow_banned_posts = Column(Boolean, default=False)
    is_shadow_banned_comments = Column(Boolean, default=False)
    shadow_ban_expires_at = Column(DateTime, nullable=True)  # null = перманентный
    shadow_ban_reason = Column(String(500), nullable=True)
    
    # Dating поля
    show_in_dating = Column(Boolean, default=True)
    hide_course_group = Column(Boolean, default=False)
    interests = Column(Text, nullable=True)  # JSON array как строка: ["python", "спорт"]
    dating_profile = relationship("DatingProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # Метаданные
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_active_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
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
    
    # Dating отношения
    likes_given = relationship('Like', foreign_keys='Like.liker_id', back_populates='liker', cascade='all, delete-orphan')
    likes_received = relationship('Like', foreign_keys='Like.liked_id', back_populates='liked', cascade='all, delete-orphan')
    
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
    tags = Column(Text, nullable=True)  # JSON array: '["python", "react"]'
    images = Column(Text, nullable=True)  # JSON array
    
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
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Отношения
    author = relationship('User', foreign_keys=[author_id], back_populates='posts')
    comments = relationship('Comment', back_populates='post', cascade='all, delete-orphan')
    poll = relationship("Poll", back_populates="post", uselist=False, cascade="all, delete-orphan")


class Poll(Base):
    """Модель опроса для постов"""
    __tablename__ = "polls"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    question = Column(String(500), nullable=False)
    options = Column(Text, nullable=False)  # JSON: [{"text": "Вариант 1", "votes": 5}, ...]
    
    type = Column(String(20), default="regular")  # "regular" | "quiz"
    correct_option = Column(Integer, nullable=True)
    
    allow_multiple = Column(Boolean, default=False)
    is_anonymous = Column(Boolean, default=True)
    
    closes_at = Column(DateTime, nullable=True)
    total_votes = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    post = relationship("Post", back_populates="poll")
    votes = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")


class PollVote(Base):
    """Голос пользователя в опросе"""
    __tablename__ = "poll_votes"
    
    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    option_indices = Column(Text, nullable=False)  # JSON: [0, 2]
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
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
    tags = Column(Text, nullable=True)
    
    expires_at = Column(DateTime, nullable=False, index=True)
    max_responses = Column(Integer, default=5)
    status = Column(
        Enum('active', 'closed', 'expired', name='request_status_enum'),
        default='active',
        index=True
    )
    
    reward_type = Column(String(50), nullable=True)
    reward_value = Column(String(255), nullable=True)
    images = Column(Text, nullable=True)
    
    # Мягкое удаление (модерация)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    deleted_reason = Column(String(500), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    # Счётчики
    responses_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Отношения
    author = relationship('User', foreign_keys=[author_id], back_populates='requests')
    responses = relationship('RequestResponse', back_populates='request', cascade='all, delete-orphan')


class RequestResponse(Base):
    """Отклики на запросы (ведут в Telegram чат)"""
    __tablename__ = 'request_responses'
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey('requests.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    message = Column(String(500), nullable=True)
    telegram_contact = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
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
    
    updated_at = Column(DateTime, nullable=True, onupdate=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Отношения
    post = relationship('Post', back_populates='comments')
    author = relationship('User', foreign_keys=[author_id], back_populates='comments')


class CommentLike(Base):
    """Лайки для комментариев"""
    __tablename__ = 'comment_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey('comments.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    __table_args__ = (
        UniqueConstraint('comment_id', 'user_id', name='unique_comment_like'),
    )


class Like(Base):
    """Лайки для знакомств (dating режим)"""
    __tablename__ = 'likes'
    
    id = Column(Integer, primary_key=True, index=True)
    liker_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    liked_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Отношения
    liker = relationship('User', foreign_keys=[liker_id], back_populates='likes_given')
    liked = relationship('User', foreign_keys=[liked_id], back_populates='likes_received')
    
    __table_args__ = (
        UniqueConstraint('liker_id', 'liked_id', name='unique_like'),
        CheckConstraint('liker_id != liked_id', name='no_self_like'),
    )


class Match(Base):
    """Матчи для знакомств (взаимные лайки)"""
    __tablename__ = 'matches'
    
    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_b_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    matched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
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
    images = Column(Text, nullable=False)
    
    status = Column(
        Enum('active', 'sold', name='market_status_enum'),
        nullable=False,
        default='active',
        index=True
    )
    
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=False)
    
    # Мягкое удаление (модерация)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    deleted_reason = Column(String(500), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    # Счётчики
    views_count = Column(Integer, default=0)
    favorites_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Отношения
    seller = relationship(
    'User', 
    foreign_keys=[seller_id],
    back_populates='market_items'
    )
    favorites = relationship('MarketFavorite', back_populates='item', cascade='all, delete-orphan')


class MarketFavorite(Base):
    """Избранные товары пользователей"""
    __tablename__ = 'market_favorites'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    item_id = Column(Integer, ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
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
    goals = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)
    lifestyle = Column(Text, nullable=True)
    prompts = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="dating_profile")


class DatingLike(Base):
    __tablename__ = 'dating_likes'
    
    id = Column(Integer, primary_key=True, index=True)
    who_liked_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    whom_liked_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    is_like = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    matched_at = Column(DateTime, nullable=True)


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
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
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
    target_type = Column(String(30), nullable=False, index=True)  # post / comment / request / market_item / dating_profile
    target_id = Column(Integer, nullable=False)
    
    # Причина
    reason = Column(String(50), nullable=False)
    # Допустимые значения: spam, abuse, inappropriate, scam, nsfw, harassment, misinformation, other
    description = Column(String(1000), nullable=True)  # опциональное описание от юзера
    
    # Статус обработки
    status = Column(String(20), default='pending', nullable=False, index=True)  # pending / reviewed / dismissed
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    moderator_note = Column(String(500), nullable=True)  # заметка модератора при обработке
    
    # Вуз автора контента (для скоупинга амбассадоров)
    university = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
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
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
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
    viewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    viewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    starts_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
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
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
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
    viewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    ad_post = relationship('AdPost', back_populates='impressions')
    
    __table_args__ = (
        Index('ix_ad_imp_ad_user', 'ad_post_id', 'user_id'),
        Index('ix_ad_imp_date', 'ad_post_id', 'viewed_at'),
    )


class AdClick(Base):
    """Клик по CTA рекламного поста"""
    __tablename__ = 'ad_clicks'
    
    id = Column(Integer, primary_key=True, index=True)
    ad_post_id = Column(Integer, ForeignKey('ad_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    clicked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    ad_post = relationship('AdPost', back_populates='clicks')
    
    __table_args__ = (
        Index('ix_ad_click_ad_user', 'ad_post_id', 'user_id'),
    )