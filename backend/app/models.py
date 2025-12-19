from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

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
    likes = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)  # Для вложенных ответов
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")
    replies = relationship("Comment", backref="parent", remote_side=[id])