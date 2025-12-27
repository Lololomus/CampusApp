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
    
    # Dating поля (НОВЫЕ)
    show_in_dating = Column(Boolean, default=True)  # показывать в знакомствах
    hide_course_group = Column(Boolean, default=False)  # скрыть курс/группу
    interests = Column(Text, nullable=True)  # JSON array как строка: ["python", "спорт"]
    
    # Метаданные
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    posts = relationship('Post', back_populates='author', cascade='all, delete-orphan')
    requests = relationship('Request', back_populates='author', cascade='all, delete-orphan')
    comments = relationship('Comment', back_populates='author', cascade='all, delete-orphan')
    
    # Dating отношения
    likes_given = relationship('Like', foreign_keys='Like.liker_id', back_populates='liker', cascade='all, delete-orphan')
    likes_received = relationship('Like', foreign_keys='Like.liked_id', back_populates='liked', cascade='all, delete-orphan')


class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # НОВЫЕ категории (general/confessions/lost_found/news/events)
    category = Column(
        Enum('general', 'confessions', 'lost_found', 'news', 'events', name='post_category_enum'),
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
    
    # Для events
    event_name = Column(String(200), nullable=True)
    event_date = Column(DateTime, nullable=True)
    event_location = Column(String(200), nullable=True)
    
    # Общее
    is_important = Column(Boolean, default=False)  # закреплённость (для news)
    expires_at = Column(DateTime, nullable=True)  # для lost_found (7 дней)
    
    # Счётчики
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    author = relationship('User', back_populates='posts')
    comments = relationship('Comment', back_populates='post', cascade='all, delete-orphan')

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