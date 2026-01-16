from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Any
import json


from app.database import get_db
from app import models, schemas, crud
from app.utils import process_image_sync, get_image_urls


# Префикс пустой, так как подключаем как "/dating" в main
router = APIRouter(prefix="/dating", tags=["dating"])


# --- Helper ---
async def save_dating_photos(files: List[UploadFile]) -> List[dict]:
    saved_photos = []
    from starlette.concurrency import run_in_threadpool
    for file in files:
        if not file.filename: continue
        content = await file.read()
        try:
            meta = await run_in_threadpool(process_image_sync, content)
            saved_photos.append(meta) 
        except Exception as e:
            print(f"Error processing image: {e}")
    return saved_photos


# --- Endpoints ---


@router.get("/profile/me", response_model=Optional[schemas.DatingProfileResponse])
def get_my_dating_profile(telegram_id: int, db: Session = Depends(get_db)):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = crud.get_dating_profile(db, user.id)
    if not profile:
        return None 
    
    # Парсим prompts из JSON строки в dict
    prompts_dict = None
    if profile.prompts:
        try:
            prompts_dict = json.loads(profile.prompts)
        except:
            prompts_dict = None
    
    return {
        **profile.__dict__,
        "user_id": user.id,
        "name": user.name,
        "age": user.age,
        "university": user.university,
        "institute": user.institute,
        "course": user.course,
        "photos": get_image_urls(profile.photos) if profile.photos else [],
        "goals": json.loads(profile.goals) if profile.goals else [],
        "lifestyle": json.loads(profile.lifestyle) if profile.lifestyle else [],
        "prompts": prompts_dict
    }


@router.post("/profile")
async def create_or_update_dating_profile(
    telegram_id: int = Query(...),
    gender: str = Form(...),
    looking_for: str = Form(...),
    bio: Optional[str] = Form(None),
    goals: str = Form("[]"),
    lifestyle: str = Form("[]"),
    prompt_question: Optional[str] = Form(None),
    prompt_answer: Optional[str] = Form(None),
    photos: List[UploadFile] = File(None),
    keep_photos: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # === ВАЛИДАЦИЯ БИО ===
    if bio:
        if len(bio) < 10:
            raise HTTPException(400, detail="Минимум 10 символов в био")
        if len(bio) > 200:
            raise HTTPException(400, detail="Максимум 200 символов в био")
        
        import re
        bio_without_emoji = re.sub(r'[\U00010000-\U0010ffff]', '', bio, flags=re.UNICODE)
        bio_letters_only = re.sub(r'[^\w\s]', '', bio_without_emoji, flags=re.UNICODE)
        if len(bio_letters_only.strip()) < 10:
            raise HTTPException(400, detail="Напиши хотя бы пару слов 😊")

    # 1. НОВЫЕ ФОТО
    saved_photos_meta = []
    if photos:
        saved_photos_meta = await save_dating_photos(photos)
    
    # 2. СТАРЫЕ ФОТО
    keep_photos_list = []
    if keep_photos:
        try:
            keep_photos_list = json.loads(keep_photos)
            print(f"📸 Сохраняем старые фото: {len(keep_photos_list)}")
        except Exception as e:
            print(f"⚠️ Ошибка парсинга keep_photos: {e}")
    
    # 3. ОБЪЕДИНЯЕМ
    final_photos = keep_photos_list + saved_photos_meta
    print(f"📤 Итого фото: {len(final_photos)}")
    
    # 4. ВАЛИДАЦИЯ
    if not final_photos:
        raise HTTPException(400, detail="Минимум 1 фото обязательно")

    # 5. СОХРАНЕНИЕ
    profile = crud.get_dating_profile(db, user.id)
    goals_list = json.loads(goals) if goals else []
    lifestyle_list = json.loads(lifestyle) if lifestyle else []
    
    # Валидация lifestyle (макс 2)
    if len(lifestyle_list) > 2:
        lifestyle_list = lifestyle_list[:2]
    
    # Формируем prompts
    prompts_dict = None
    if prompt_question and prompt_answer:
        prompts_dict = {
            "question": prompt_question[:100],  # макс 100 символов
            "answer": prompt_answer[:100]
        }
    
    if profile:
        profile.gender = gender
        profile.looking_for = looking_for
        profile.bio = bio
        profile.goals = json.dumps(goals_list)
        profile.photos = json.dumps(final_photos)
        profile.lifestyle = json.dumps(lifestyle_list)
        profile.prompts = json.dumps(prompts_dict) if prompts_dict else None
        profile.is_active = True
        user.show_in_dating = True 
    else:
        profile = models.DatingProfile(
            user_id=user.id,
            gender=gender,
            looking_for=looking_for,
            bio=bio,
            goals=json.dumps(goals_list),
            photos=json.dumps(final_photos),
            lifestyle=json.dumps(lifestyle_list),
            prompts=json.dumps(prompts_dict) if prompts_dict else None,
            is_active=True
        )
        db.add(profile)
        user.show_in_dating = True


    db.commit()
    db.refresh(profile)
    
    # ✅ ВОЗВРАЩАЕМ ПОЛНЫЙ ПРОФИЛЬ (КАК В GET /profile/me)
    prompts_dict = None
    if profile.prompts:
        try:
            prompts_dict = json.loads(profile.prompts)
        except:
            prompts_dict = None
    
    return {
        **profile.__dict__,
        "user_id": user.id,
        "name": user.name,
        "age": user.age,
        "university": user.university,
        "institute": user.institute,
        "course": user.course,
        "photos": get_image_urls(profile.photos) if profile.photos else [],
        "goals": json.loads(profile.goals) if profile.goals else [],
        "lifestyle": json.loads(profile.lifestyle) if profile.lifestyle else [],
        "prompts": prompts_dict
    }


@router.get("/feed")
def get_dating_feed(
    telegram_id: int,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    my_profile = crud.get_dating_profile(db, user.id)
    looking_for = my_profile.looking_for if my_profile else None

    return crud.get_dating_feed(db, user.id, limit, offset, looking_for)


@router.post("/{target_user_id}/like", response_model=schemas.LikeResult)
def like_user(
    target_user_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = crud.create_like(db, liker_id=user.id, liked_id=target_user_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    response = {
        "success": True,
        "is_match": result.get("is_match", False),
        "match_id": result.get("match_id"),
        "matched_user": None
    }
    if result.get("is_match") and result.get("matched_user"):
        response["matched_user"] = schemas.UserShort.from_orm(result["matched_user"])
        
    return response


@router.post("/{target_user_id}/dislike")
def dislike_user(
    target_user_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Дизлайк (skip) пользователя.
    Записываем в DatingLike с is_like=False
    """
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(404, detail="Пользователь не найден")
    
    # Проверка что не себя
    if target_user_id == user.id:
        raise HTTPException(400, detail="Нельзя дизлайкнуть себя")
    
    # Создаём запись (или обновляем)
    result = crud.create_dislike(db, user.id, target_user_id)
    
    if not result["success"]:
        raise HTTPException(400, detail=result.get("error"))
    
    return {"success": True}


@router.get("/likes-received", response_model=List[schemas.DatingProfile])
def get_likes_received(
    telegram_id: int = Query(...),
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    users = crud.get_who_liked_me(db, user.id, limit, offset)
    
    result = []
    for u in users:
        dp = crud.get_dating_profile(db, u.id)
        photos = get_image_urls(dp.photos) if (dp and dp.photos) else []
        if not photos and u.avatar:
             photos = [{"url": u.avatar, "w": 500, "h": 500}]

        interests_list = json.loads(u.interests) if u.interests else []
        
        result.append({
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "age": u.age,
            "bio": dp.bio if dp else u.bio,
            "photos": photos,
            "university": u.university,
            "institute": u.institute,
            "course": u.course,
            "group": None if u.hide_course_group else u.group,
            "interests": interests_list,
            "user_id": u.id
        })
    return result


@router.get("/matches", response_model=List[schemas.MatchResponse])
def get_my_matches(
    telegram_id: int = Query(...),
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    matches = crud.get_my_matches(db, user.id, limit, offset)
    result = []
    for m in matches:
        result.append({
            "id": m["id"],
            "user_a_id": 0, 
            "user_b_id": 0,
            "matched_at": m["matched_at"],
            "matched_user": schemas.UserShort.from_orm(m["matched_user"])
        })
    return result


@router.get("/stats", response_model=schemas.DatingStatsResponse)
def get_dating_stats(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.get_dating_stats(db, user.id)


@router.patch("/settings", response_model=schemas.UserResponse)
def update_dating_settings(
    telegram_id: int = Query(...),
    settings: schemas.DatingSettings = Body(...),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings_dict = settings.model_dump(exclude_unset=True)
    return crud.update_dating_settings(db, user.id, settings_dict)