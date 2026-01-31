import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Загружаем .env из корня проекта
load_dotenv(dotenv_path="../.env")

# Читаем переменные
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://campus:campus123@localhost:5432/campusapp")

# Создаём engine
engine = create_engine(
    DATABASE_URL,
    echo=True
)

# Создаём фабрику сессий
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class для моделей
Base = declarative_base()

# Dependency для FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Функция создания таблиц
def init_db():
    """Создаёт все таблицы в БД"""
    from app.models import User, Post, Comment
    Base.metadata.create_all(bind=engine)