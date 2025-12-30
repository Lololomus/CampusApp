# ===== 📄 ФАЙЛ: backend/app/routers/dating.py =====

from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, not_
from typing import List, Optional
import json
import uuid
import os
import shutil

from app.database import get_db
from app import models, schemas, crud
from app.utils import process_image_sync, get_image_urls

router = APIRouter(prefix="/dating", tags=["dating"])

# Папка для фото знакомств (можно использовать общую, но для порядка разделим)
UPLOAD_DIR = "uploads/dating"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Хелперы ---

async def save_dating_photos(files: List[UploadFile]) -> List[dict]:
    saved_photos = []
    from starlette.concurrency import run_in_threadpool
    
    for file in files:
        if not file.filename: continue
        content = await file.read()
        # Используем твою утилиту для сжатия и обработки
        try:
            meta = await run_in_threadpool(process_image_sync, content)
            # Перемещаем файл в папку dating, если нужно, или оставляем в общей uploads/images
            # Твоя утилита сохраняет в uploads/images, это ОК.
            saved_photos.append(meta) 
        except Exception as e:
            print(f"Error processing image: {e}")
    return saved_photos

# --- Эндпоинты ---

@router.get("/profile/me", response_model=Optional[schemas.DatingProfileResponse])
def get_my_dating_profile(telegram_id: int, db: Session = Depends(get_db)):
    """Получить мою анкету"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = db.query(models.DatingProfile).filter(models.DatingProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Собираем ответ, объединяя данные User и DatingProfile
    return {
        **profile.__dict__,
        "name": user.name,
        "age": user.age,
        "university": user.university,
        "institute": user.institute,
        "course": user.course,
        "photos": get_image_urls(profile.photos) if profile.photos else []
    }

@router.post("/profile")
async def create_or_update_dating_profile(
    telegram_id: int = Query(...),
    gender: str = Form(...),
    looking_for: str = Form(...),
    bio: Optional[str] = Form(None),
    goals: str = Form("[]"), # JSON string
    photos: List[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Создать или обновить анкету"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Обработка фото
    saved_photos_meta = []
    if photos:
        saved_photos_meta = await save_dating_photos(photos)
    
    # 2. Ищем существующую анкету
    profile = db.query(models.DatingProfile).filter(models.DatingProfile.user_id == user.id).first()
    
    goals_list = json.loads(goals) if goals else []
    
    if profile:
        # Обновление
        profile.gender = gender
        profile.looking_for = looking_for
        profile.bio = bio
        profile.goals = json.dumps(goals_list)
        # Если загрузили новые фото - заменяем старые (или можно сделать логику добавления)
        if saved_photos_meta:
            profile.photos = json.dumps(saved_photos_meta)
        
        # Обновляем user поля (если нужно синхронизировать)
        user.show_in_dating = True 
        
    else:
        # Создание
        profile = models.DatingProfile(
            user_id=user.id,
            gender=gender,
            looking_for=looking_for,
            bio=bio,
            goals=json.dumps(goals_list),
            photos=json.dumps(saved_photos_meta) if saved_photos_meta else "[]",
            is_active=True
        )
        db.add(profile)
        # Включаем флаг у юзера
        user.show_in_dating = True 

    db.commit()
    db.refresh(profile)
    return {"status": "ok", "profile_id": profile.id}

@router.get("/feed")
def get_dating_feed_v2(
    telegram_id: int,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Умная лента знакомств (на основе DatingProfile)"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Моя анкета (чтобы знать кого искать)
    my_profile = db.query(models.DatingProfile).filter(models.DatingProfile.user_id == user.id).first()
    
    # Кого я уже лайкнул/дизлайкнул
    liked_ids = db.query(models.Like.liked_id).filter(models.Like.liker_id == user.id).subquery()
    
    # Запрос
    query = db.query(models.DatingProfile).join(models.User).filter(
        models.DatingProfile.user_id != user.id,
        models.DatingProfile.is_active == True,
        models.DatingProfile.user_id.notin_(liked_ids)
    )
    
    # Фильтрация по полу (если есть анкета)
    if my_profile and my_profile.looking_for != 'all':
        query = query.filter(models.DatingProfile.gender == my_profile.looking_for)
    
    # Фильтрация по ВУЗу (опционально, сейчас просто всех)
    # query = query.filter(models.User.university == user.university)

    profiles = query.offset(offset).limit(limit).all()
    
    results = []
    for p in profiles:
        results.append({
            "id": p.user.id, # ID юзера (для лайков)
            "name": p.user.name,
            "age": p.user.age,
            "university": p.user.university,
            "institute": p.user.institute,
            "course": p.user.course,
            "bio": p.bio, # Био из анкеты приоритетнее
            "goals": json.loads(p.goals) if p.goals else [],
            "photos": get_image_urls(p.photos) if p.photos else [],
            "interests": json.loads(p.user.interests) if p.user.interests else []
        })
        
    return results