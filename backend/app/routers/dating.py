from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File, Query, Body
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import re

from app.database import get_db
from app import models, schemas, crud
from app.utils import process_image_sync, get_image_urls

router = APIRouter(prefix="/dating", tags=["dating"])


async def save_dating_photos(files: List[UploadFile]) -> List[dict]:
    """Save and process uploaded dating photos"""
    saved_photos = []
    from starlette.concurrency import run_in_threadpool
    
    for file in files:
        if not file.filename:
            continue
        content = await file.read()
        try:
            meta = await run_in_threadpool(process_image_sync, content)
            saved_photos.append(meta)
        except Exception as e:
            print(f"Error processing image: {e}")
    
    return saved_photos


@router.get("/profile/me", response_model=Optional[schemas.DatingProfileResponse])
def get_my_dating_profile(telegram_id: int, db: Session = Depends(get_db)):
    """Get current user's dating profile"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = crud.get_dating_profile(db, user.id)
    if not profile:
        return None
    
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
        "interests": json.loads(user.interests) if user.interests else [],
        "prompts": prompts_dict
    }


@router.post("/profile")
async def create_or_update_dating_profile(
    telegram_id: int = Query(...),
    gender: str = Form(...),
    looking_for: str = Form(...),
    age: int = Form(...),
    bio: Optional[str] = Form(None),
    goals: str = Form(...),
    interests: str = Form(...),
    prompt_question: Optional[str] = Form(None),
    prompt_answer: Optional[str] = Form(None),
    photos: List[UploadFile] = File(None),
    keep_photos: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Create or update dating profile"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if age < 16 or age > 50:
        raise HTTPException(status_code=400, detail="Возраст должен быть от 16 до 50 лет")
    
    if bio:
        if len(bio) < 10:
            raise HTTPException(400, detail="Биография должна содержать минимум 10 символов")
        if len(bio) > 200:
            raise HTTPException(400, detail="Биография не должна превышать 200 символов")
        
        bio_without_emoji = re.sub(r'[\U00010000-\U0010ffff]', '', bio, flags=re.UNICODE)
        bio_letters_only = re.sub(r'[^\w\s]', '', bio_without_emoji, flags=re.UNICODE)
        
        if len(bio_letters_only.strip()) < 10:
            raise HTTPException(400, detail="Биография должна содержать минимум 10 букв (без учёта эмодзи и символов)")
    
    saved_photos_meta = []
    if photos:
        saved_photos_meta = await save_dating_photos(photos)
    
    keep_photos_list = []
    if keep_photos:
        try:
            raw_keep_photos = json.loads(keep_photos)
            for photo in raw_keep_photos:
                if isinstance(photo, str):
                    filename = photo.replace("/uploads/images/", "").split("?")[0]
                    if "." in filename and any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                        keep_photos_list.append(filename)
                elif isinstance(photo, dict):
                    url = photo.get("url", "")
                    filename = url.replace("/uploads/images/", "").split("?")[0]
                    if "." in filename and any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                        keep_photos_list.append({
                            "url": filename,
                            "w": photo.get("w", 1000),
                            "h": photo.get("h", 1000)
                        })
        except Exception as e:
            print(f"Error parsing keep_photos: {e}")
    
    final_photos = keep_photos_list + saved_photos_meta
    
    if not final_photos:
        raise HTTPException(400, detail="Необходимо загрузить хотя бы 1 фото")
    
    profile = crud.get_dating_profile(db, user.id)
    goals_list = json.loads(goals) if goals else []
    interests_list = json.loads(interests) if interests else []
    
    prompts_dict = None
    if prompt_question and prompt_answer:
        if len(prompt_answer.strip()) < 10:
            raise HTTPException(400, detail="Ответ на вопрос должен быть минимум 10 символов")
        if len(prompt_answer) > 150:
            raise HTTPException(400, detail="Ответ на вопрос не должен превышать 150 символов")
        prompts_dict = {
            "question": prompt_question[:100],
            "answer": prompt_answer[:150]
        }
    
    if profile:
        profile.gender = gender
        profile.age = age
        profile.looking_for = looking_for
        profile.bio = bio
        profile.goals = json.dumps(goals_list)
        profile.photos = json.dumps(final_photos)
        profile.prompts = json.dumps(prompts_dict) if prompts_dict else None
        profile.is_active = True
        user.show_in_dating = True
    else:
        profile = models.DatingProfile(
            user_id=user.id,
            gender=gender,
            age=age,
            looking_for=looking_for,
            bio=bio,
            goals=json.dumps(goals_list),
            photos=json.dumps(final_photos),
            prompts=json.dumps(prompts_dict) if prompts_dict else None,
            is_active=True
        )
        db.add(profile)
        user.show_in_dating = True
    
    user.age = age
    user.interests = json.dumps(interests_list)
    
    db.commit()
    db.refresh(profile)
    db.refresh(user)
    
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
        "interests": json.loads(user.interests) if user.interests else [],
        "prompts": prompts_dict
    }


@router.get("/feed")
def get_dating_feed(
    telegram_id: int,
    limit: int = 10,
    offset: int = 0,
    debug: bool = Query(False, description="Показать breakdown скоринга"),
    db: Session = Depends(get_db)
):
    """Get dating feed with CampusMatch scoring"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    my_profile = crud.get_dating_profile(db, user.id)
    looking_for = my_profile.looking_for if my_profile else None
    
    return crud.get_dating_feed(db, user.id, limit, offset, looking_for, debug=debug)


@router.post("/{target_user_id}/like", response_model=schemas.LikeResult)
def like_user(
    target_user_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Like another user"""
    from datetime import datetime
    
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = crud.create_like(db, liker_id=user.id, liked_id=target_user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    # ✅ НОВОЕ: Сохраняем matched_at если это мэтч
    if result.get("is_match"):
        # Обновляем оба лайка с matched_at
        like1 = db.query(models.DatingLike).filter(
            models.DatingLike.liker_id == user.id,
            models.DatingLike.liked_id == target_user_id
        ).first()
        
        like2 = db.query(models.DatingLike).filter(
            models.DatingLike.liker_id == target_user_id,
            models.DatingLike.liked_id == user.id
        ).first()
        
        now = datetime.utcnow()
        if like1:
            like1.matched_at = now
        if like2:
            like2.matched_at = now
        
        db.commit()
    
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
    """Dislike/skip another user"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(404, detail="Пользователь не найден")
    
    if target_user_id == user.id:
        raise HTTPException(400, detail="Нельзя дизлайкнуть себя")
    
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
    """Get users who liked current user"""
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
    """Get all matches for current user"""
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
    """Get dating statistics for current user"""
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
    """Update dating settings"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings_dict = settings.model_dump(exclude_unset=True)
    return crud.update_dating_settings(db, user.id, settings_dict)

def ensure_mock_matches(db: Session, user_id: int) -> int:
    """
    Автоматически создаёт/обновляет моки для активных матчей.
    Гарантирует минимум 3 активных мэтча (< 24ч) для разработки.
    """
    from datetime import datetime, timedelta
    import random
    
    # Найди текущего юзера
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return 0
    
    # Проверь сколько активных матчей уже есть
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)
    
    active_matches = db.query(models.Match).filter(
        or_(
            models.Match.user_a_id == user.id,
            models.Match.user_b_id == user.id
        ),
        models.Match.matched_at >= cutoff
    ).all()
    
    if len(active_matches) >= 3:
        return len(active_matches)  # Уже достаточно
    
    # Найди всех пользователей с dating профилями (кроме текущего)
    potential_matches = db.query(models.User).join(
        models.DatingProfile
    ).filter(
        models.User.id != user.id,
        models.DatingProfile.is_active == True
    ).limit(5).all()
    
    if not potential_matches:
        return 0
    
    # Создай/обнови матчи
    created_count = 0
    mock_times = [
        timedelta(hours=22, minutes=30),  # Почти истёк
        timedelta(hours=15),
        timedelta(hours=6),
        timedelta(hours=2),
        timedelta(minutes=45),
    ]
    
    for i, other_user in enumerate(potential_matches[:5]):
        # Правильный порядок: user_a_id < user_b_id
        user_a = min(user.id, other_user.id)
        user_b = max(user.id, other_user.id)
        
        # Проверь существующий мэтч
        existing = db.query(models.Match).filter(
            models.Match.user_a_id == user_a,
            models.Match.user_b_id == user_b
        ).first()
        
        time_delta = mock_times[i] if i < len(mock_times) else timedelta(hours=5)
        fresh_time = now - time_delta
        
        if existing:
            # Обнови timestamp если мэтч "истёк" (старше 24ч)
            if existing.matched_at < cutoff:
                existing.matched_at = fresh_time
                created_count += 1
        else:
            # Создай новый мэтч
            new_match = models.Match(
                user_a_id=user_a,
                user_b_id=user_b,
                matched_at=fresh_time
            )
            db.add(new_match)
            created_count += 1
            
            # Создай соответствующие likes (для корректности)
            like1 = db.query(models.DatingLike).filter(
                models.DatingLike.who_liked_id == user.id,
                models.DatingLike.whom_liked_id == other_user.id
            ).first()
            
            if not like1:
                like1 = models.DatingLike(
                    who_liked_id=user.id,
                    whom_liked_id=other_user.id,
                    is_like=True,
                    matched_at=fresh_time
                )
                db.add(like1)
            
            like2 = db.query(models.DatingLike).filter(
                models.DatingLike.who_liked_id == other_user.id,
                models.DatingLike.whom_liked_id == user.id
            ).first()
            
            if not like2:
                like2 = models.DatingLike(
                    who_liked_id=other_user.id,
                    whom_liked_id=user.id,
                    is_like=True,
                    matched_at=fresh_time
                )
                db.add(like2)
    
    try:
        db.commit()
        print(f"✅ Auto-refresh matches: обновлено/создано {created_count} матчей")
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка auto-refresh: {e}")
        return 0
    
    return created_count


@router.get("/matches-active")
def get_active_matches(telegram_id: int = Query(...), db: Session = Depends(get_db)):
    """Получить активные мэтчи (24 часа) с авто-обновлением моков"""
    from datetime import datetime, timedelta
    
    try:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # ✅ НОВОЕ: Авто-создание моков для разработки
        ensure_mock_matches(db, user.id)
        
        # Остальной код БЕЗ ИЗМЕНЕНИЙ
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=24)
        
        matches_query = db.query(models.Match).filter(
            or_(
                models.Match.user_a_id == user.id,
                models.Match.user_b_id == user.id
            ),
            models.Match.matched_at >= cutoff
        ).all()
        
        print(f"🔍 [MATCHES] User: {user.name} (id={user.id})")
        print(f"📊 [MATCHES] Найдено {len(matches_query)} активных матчей")
        
        result = []
        for match in matches_query:
            try:
                # Определи другого юзера
                other_user_id = match.user_b_id if match.user_a_id == user.id else match.user_a_id
                
                other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
                if not other_user:
                    continue
                
                dp = crud.get_dating_profile(db, other_user_id)
                if not dp:
                    continue
                
                # Photos
                photos = get_image_urls(dp.photos) if dp.photos else []
                if not photos and other_user.avatar:
                    photos = [{"url": other_user.avatar, "w": 500, "h": 500}]
                
                # Expires
                expires_at = match.matched_at + timedelta(hours=24)
                time_left = expires_at - now
                
                if time_left.total_seconds() <= 0:
                    continue
                
                hours_left = int(time_left.total_seconds() / 3600)
                minutes_left = int((time_left.total_seconds() % 3600) / 60)
                
                # Data
                interests_list = json.loads(other_user.interests) if other_user.interests else []
                goals_list = json.loads(dp.goals) if dp.goals else []
                
                prompts_dict = None
                if dp.prompts:
                    try:
                        prompts_dict = json.loads(dp.prompts)
                    except:
                        pass
                
                result.append({
                    "id": dp.id,
                    "user_id": other_user_id,
                    "name": other_user.name,
                    "age": other_user.age,
                    "bio": dp.bio,
                    "university": other_user.university,
                    "institute": other_user.institute,
                    "course": other_user.course,
                    "photos": photos,
                    "interests": interests_list,
                    "goals": goals_list,
                    "prompts": prompts_dict,
                    "matched_at": match.matched_at.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "hours_left": hours_left,
                    "minutes_left": minutes_left,
                })
                
            except Exception as e:
                print(f"❌ Error processing match {match.id}: {e}")
                continue
        
        result.sort(key=lambda x: x['expires_at'])
        return result
        
    except Exception as e:
        print(f"❌ Error in get_active_matches: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/matches-active")
def get_active_matches(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Получить активные мэтчи (в течение 24 часов)"""
    from datetime import datetime, timedelta
    
    try:
        user = crud.get_user_by_telegram_id(db, telegram_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # ✅ ПРАВИЛЬНО: Используем таблицу Match
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=24)
        
        # Получаем мэтчи где user - это user_a или user_b
        matches_query = db.query(models.Match).filter(
            or_(
                models.Match.user_a_id == user.id,
                models.Match.user_b_id == user.id
            ),
            models.Match.matched_at >= cutoff
        ).all()
        
        result = []
        
        for match in matches_query:
            try:
                # Определяем второго пользователя
                other_user_id = match.user_b_id if match.user_a_id == user.id else match.user_a_id
                
                # Получаем профиль
                other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
                if not other_user:
                    continue
                
                dp = crud.get_dating_profile(db, other_user_id)
                if not dp:
                    continue
                
                # Получаем фото
                photos = get_image_urls(dp.photos) if dp.photos else []
                if not photos and other_user.avatar:
                    photos = [{"url": other_user.avatar, "w": 500, "h": 500}]
                
                # Вычисляем оставшееся время
                expires_at = match.matched_at + timedelta(hours=24)
                time_left = expires_at - now
                
                if time_left.total_seconds() <= 0:
                    continue  # Пропускаем истёкшие
                
                hours_left = int(time_left.total_seconds() / 3600)
                minutes_left = int((time_left.total_seconds() % 3600) / 60)
                
                # Интересы
                interests_list = json.loads(other_user.interests) if other_user.interests else []
                goals_list = json.loads(dp.goals) if dp.goals else []
                
                # Prompts
                prompts_dict = None
                if dp.prompts:
                    try:
                        prompts_dict = json.loads(dp.prompts)
                    except:
                        pass
                
                result.append({
                    "id": dp.id,
                    "user_id": other_user_id,
                    "name": other_user.name,
                    "age": other_user.age,
                    "bio": dp.bio,
                    "university": other_user.university,
                    "institute": other_user.institute,
                    "course": other_user.course,
                    "photos": photos,
                    "interests": interests_list,
                    "goals": goals_list,
                    "prompts": prompts_dict,
                    "matched_at": match.matched_at.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "hours_left": hours_left,
                    "minutes_left": minutes_left,
                })
            except Exception as e:
                print(f"❌ Error processing match {match.id}: {e}")
                continue
        
        # Сортируем по времени истечения (срочные первыми)
        result.sort(key=lambda x: x["expires_at"])
        
        return result
        
    except Exception as e:
        print(f"❌ Error in get_active_matches: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))