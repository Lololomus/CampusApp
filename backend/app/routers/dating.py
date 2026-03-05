# ===== 📄 ФАЙЛ: backend/app/routers/dating.py =====
#
# ✅ Фаза 3: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession
#    - legacy_query_api() → select() + await db.execute()
#    - crud.*() → await crud.*()

from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File, Query, Body
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json
import logging
import re

from app.database import get_db
from app import models, schemas, crud
from app.utils import (
    delete_images,
    get_image_urls,
    get_storage_key,
    parse_keep_file_list,
    process_uploaded_files,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dating", tags=["dating"])


async def save_dating_photos(files: List[UploadFile]) -> List[dict]:
    return await process_uploaded_files(files, kind="images")


@router.get("/profile/me", response_model=Optional[schemas.DatingProfileResponse])
async def get_my_dating_profile(telegram_id: int, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = await crud.get_dating_profile(db, user.id)
    if not profile:
        return None

    prompts_dict = None
    if profile.prompts:
        prompts_dict = profile.prompts if isinstance(profile.prompts, dict) else None

    return {
        **profile.__dict__,
        "user_id": user.id,
        "name": user.name,
        "age": user.age,
        "university": user.university,
        "institute": user.institute,
        "course": user.course,
        "photos": get_image_urls(profile.photos) if profile.photos else [],
        "goals": profile.goals or [],
        "interests": user.interests or [],
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
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if age < 16 or age > 50:
        raise HTTPException(status_code=400, detail="Age must be between 16 and 50")

    if bio:
        if len(bio) < 10:
            raise HTTPException(status_code=400, detail="Bio must be at least 10 characters")
        if len(bio) > 200:
            raise HTTPException(status_code=400, detail="Bio must not exceed 200 characters")

        bio_without_emoji = re.sub(r"[\U00010000-\U0010ffff]", "", bio, flags=re.UNICODE)
        bio_letters_only = re.sub(r"[^\w\s]", "", bio_without_emoji, flags=re.UNICODE)
        if len(bio_letters_only.strip()) < 10:
            raise HTTPException(status_code=400, detail="Bio must contain at least 10 letters")

    profile = await crud.get_dating_profile(db, user.id)

    try:
        keep_photo_keys = parse_keep_file_list(keep_photos, kind="images")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    valid_new_photos = [img for img in (photos or []) if img.filename and len(img.filename) > 0]
    if len(valid_new_photos) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos")

    if len(keep_photo_keys) + len(valid_new_photos) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos")

    saved_photos_meta: List[dict] = []
    if valid_new_photos:
        try:
            saved_photos_meta = await save_dating_photos(valid_new_photos)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    existing_photos_raw = []
    if profile and profile.photos:
        existing_photos_raw = profile.photos if isinstance(profile.photos, list) else []

    existing_photo_map = {}
    for item in existing_photos_raw:
        if isinstance(item, str):
            key = get_storage_key(item, kind="images")
            if key:
                existing_photo_map[key] = {"url": key, "w": 1000, "h": 1000}
        elif isinstance(item, dict):
            key = get_storage_key(item.get("url", ""), kind="images")
            if key:
                normalized_item = dict(item)
                normalized_item["url"] = key
                normalized_item.setdefault("w", 1000)
                normalized_item.setdefault("h", 1000)
                existing_photo_map[key] = normalized_item

    kept_photos_meta: List[dict] = []
    for key in keep_photo_keys:
        if key in existing_photo_map:
            kept_photos_meta.append(existing_photo_map[key])

    final_photos = kept_photos_meta + saved_photos_meta

    if not final_photos:
        delete_images(saved_photos_meta, default_kind="images")
        raise HTTPException(status_code=400, detail="At least one photo is required")

    if len(final_photos) > 3:
        delete_images(saved_photos_meta, default_kind="images")
        raise HTTPException(status_code=400, detail="Maximum 3 photos")

    try:
        goals_list = json.loads(goals) if goals else []
        interests_list = json.loads(interests) if interests else []
    except json.JSONDecodeError:
        delete_images(saved_photos_meta, default_kind="images")
        raise HTTPException(status_code=400, detail="Invalid goals or interests payload")

    prompts_dict = None
    if prompt_question and prompt_answer:
        if len(prompt_answer.strip()) < 10:
            delete_images(saved_photos_meta, default_kind="images")
            raise HTTPException(status_code=400, detail="Prompt answer must be at least 10 characters")
        if len(prompt_answer) > 150:
            delete_images(saved_photos_meta, default_kind="images")
            raise HTTPException(status_code=400, detail="Prompt answer must not exceed 150 characters")
        prompts_dict = {
            "question": prompt_question[:100],
            "answer": prompt_answer[:150],
        }

    files_to_delete: List[str] = []
    if profile:
        kept_keys = {item["url"] for item in kept_photos_meta}
        files_to_delete = [key for key in existing_photo_map.keys() if key not in kept_keys]

    try:
        if profile:
            profile.gender = gender
            profile.age = age
            profile.looking_for = looking_for
            profile.bio = bio
            profile.goals = goals_list
            profile.photos = final_photos
            profile.prompts = prompts_dict
            profile.is_active = True
            user.show_in_dating = True
        else:
            profile = models.DatingProfile(
                user_id=user.id,
                gender=gender,
                age=age,
                looking_for=looking_for,
                bio=bio,
                goals=goals_list,
                photos=final_photos,
                prompts=prompts_dict,
                is_active=True,
            )
            db.add(profile)
            user.show_in_dating = True

        user.age = age
        user.interests = interests_list

        await db.commit()
        await db.refresh(profile)
        await db.refresh(user)
    except Exception:
        await db.rollback()
        delete_images(saved_photos_meta, default_kind="images")
        raise HTTPException(status_code=500, detail="Failed to save dating profile")

    if files_to_delete:
        delete_images(files_to_delete, default_kind="images")

    prompts_response = None
    if profile.prompts:
        prompts_response = profile.prompts if isinstance(profile.prompts, dict) else None

    return {
        **profile.__dict__,
        "user_id": user.id,
        "name": user.name,
        "age": user.age,
        "university": user.university,
        "institute": user.institute,
        "course": user.course,
        "photos": get_image_urls(profile.photos) if profile.photos else [],
        "goals": profile.goals or [],
        "interests": user.interests or [],
        "prompts": prompts_response,
    }


@router.get("/feed")
async def get_dating_feed(
    telegram_id: int,
    limit: int = 10,
    offset: int = 0,
    debug: bool = Query(False, description="Показать breakdown скоринга"),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    my_profile = await crud.get_dating_profile(db, user.id)
    looking_for = my_profile.looking_for if my_profile else None

    return await crud.get_dating_feed(db, user.id, limit, offset, looking_for, debug=debug)


@router.post("/{target_user_id}/like", response_model=schemas.LikeResult)
async def like_user(
    target_user_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime

    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await crud.create_like(db, liker_id=user.id, liked_id=target_user_id)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))

    if result.get("is_match"):
        res1 = await db.execute(
            select(models.DatingLike).where(
                models.DatingLike.who_liked_id == user.id,
                models.DatingLike.whom_liked_id == target_user_id
            )
        )
        like1 = res1.scalar_one_or_none()

        res2 = await db.execute(
            select(models.DatingLike).where(
                models.DatingLike.who_liked_id == target_user_id,
                models.DatingLike.whom_liked_id == user.id
            )
        )
        like2 = res2.scalar_one_or_none()

        now = datetime.utcnow()
        if like1:
            like1.matched_at = now
        if like2:
            like2.matched_at = now

        await db.commit()

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
async def dislike_user(
    target_user_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(404, detail="Пользователь не найден")

    if target_user_id == user.id:
        raise HTTPException(400, detail="Нельзя дизлайкнуть себя")

    result = await crud.create_dislike(db, user.id, target_user_id)
    if not result["success"]:
        raise HTTPException(400, detail=result.get("error"))

    return {"success": True}


@router.get("/likes-received", response_model=List[schemas.DatingProfile])
async def get_likes_received(
    telegram_id: int = Query(...),
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    users = await crud.get_who_liked_me(db, user.id, limit, offset)
    result = []

    for u in users:
        dp = await crud.get_dating_profile(db, u.id)
        photos = get_image_urls(dp.photos) if (dp and dp.photos) else []
        if not photos and u.avatar:
            photos = [{"url": u.avatar, "w": 500, "h": 500}]

        interests_list = u.interests or []

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
async def get_my_matches(
    telegram_id: int = Query(...),
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    matches = await crud.get_my_matches(db, user.id, limit, offset)
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
async def get_dating_stats(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return await crud.get_dating_stats(db, user.id)


@router.patch("/settings", response_model=schemas.UserResponse)
async def update_dating_settings(
    telegram_id: int = Query(...),
    settings: schemas.DatingSettings = Body(...),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    settings_dict = settings.model_dump(exclude_unset=True)
    return await crud.update_dating_settings(db, user.id, settings_dict)


@router.get("/matches-active")
async def get_active_matches(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Получить активные мэтчи (в течение 24 часов)"""
    from datetime import datetime, timedelta

    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)

    res = await db.execute(
        select(models.Match).where(
            or_(
                models.Match.user_a_id == user.id,
                models.Match.user_b_id == user.id
            ),
            models.Match.matched_at >= cutoff
        )
    )
    matches_query = res.scalars().all()

    result = []

    for match in matches_query:
        try:
            other_user_id = match.user_b_id if match.user_a_id == user.id else match.user_a_id

            other_user = await db.get(models.User, other_user_id)
            if not other_user:
                continue

            dp = await crud.get_dating_profile(db, other_user_id)
            if not dp:
                continue

            photos = get_image_urls(dp.photos) if dp.photos else []
            if not photos and other_user.avatar:
                photos = [{"url": other_user.avatar, "w": 500, "h": 500}]

            expires_at = match.matched_at + timedelta(hours=24)
            time_left = expires_at - now

            if time_left.total_seconds() <= 0:
                continue

            hours_left = int(time_left.total_seconds() / 3600)
            minutes_left = int((time_left.total_seconds() % 3600) / 60)

            interests_list = other_user.interests or []
            goals_list = dp.goals or []

            prompts_dict = None
            if dp.prompts:
                prompts_dict = dp.prompts if isinstance(dp.prompts, dict) else None

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
            logger.warning(f"Error processing match {match.id}: {e}")
            continue

    result.sort(key=lambda x: x["expires_at"])
    return result
