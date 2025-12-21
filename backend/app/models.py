from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy import UniqueConstraint
from datetime import datetime

class User(Base):
    """Пользователи (студенты)"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=False)
    course = Column(Integer, nullable=False)
    group = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    last_profile_edit = Column(DateTime, nullable=True)
    
    # Relationships (связи с другими таблицами)
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")


class Post(Base):
    """Посты студентов"""
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    university = Column(String(255), nullable=False)
    institute = Column(String(255), nullable=False)
    course = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    tags = Column(Text, default="")  # Храним как строку: "python,backend,fastapi"
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    
    # Helper methods для работы с тегами
    def get_tags_list(self):
        """Конвертирует строку тегов в список"""
        return self.tags.split(",") if self.tags else []
    
    def set_tags_list(self, tags_list):
        """Конвертирует список тегов в строку"""
        self.tags = ",".join(tags_list) if tags_list else ""


class Comment(Base):
    """Комментарии к постам"""
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    is_deleted = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    likes = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")
    replies = relationship("Comment", backref="parent", remote_side=[id])

class CommentReport(Base):
    """Жалобы на комментарии"""
    __tablename__ = "comment_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(50), nullable=False)  # spam, abuse, inappropriate
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        UniqueConstraint('reporter_id', 'comment_id', name='unique_user_comment_report'),
    )

class PostLike(Base):
    """Лайки постов (связь многие ко многим)"""
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Уникальность: один пользователь = один лайк на пост
    __table_args__ = (
        UniqueConstraint('user_id', 'post_id', name='unique_user_post_like'),
    )

class CommentLike(Base):
    """Лайки комментариев (связь многие ко многим)"""
    __tablename__ = "comment_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Уникальность: один пользователь = один лайк на комментарий
    __table_args__ = (
        UniqueConstraint('user_id', 'comment_id', name='unique_user_comment_like'),
    )