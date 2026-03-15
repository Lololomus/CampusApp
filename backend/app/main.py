# ===== 📄 ФАЙЛ: backend/app/main.py =====

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI, Depends, HTTPException, Query, Body, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Tuple
from app import models, schemas, crud
from app.database import engine, get_db, init_db
from app.utils import (
    delete_images,
    get_image_urls,
    normalize_uploads_path,
    parse_keep_file_list,
    process_uploaded_files,
)
from app.auth_service import decode_authorization_header
from app.config import get_settings
from app.rate_limiter import close_redis
from app.time_utils import ensure_utc, normalize_datetime_payload
import json
import re
from pydantic import ValidationError
from app.routers import dating, moderation, ads, notifications, auth_router, dev_auth_router, analytics
from app.services import analytics_service
import os
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

TITLE_PARSE_LIMIT = 70
POST_BODY_MIN_LEN = 10
MEMES_MIN_LETTERS = 3
MEMES_LETTERS_RE = re.compile(r"[A-Za-zА-Яа-яЁё]")


def _parse_json_list_form_field(raw_value: Optional[str], field_name: str) -> List:
    """Parse JSON list from multipart form field and return 422 on invalid input."""
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail=[{
                "loc": ["body", field_name],
                "msg": f"{field_name} must be a valid JSON array",
                "type": "value_error.jsondecode",
            }],
        )
    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=422,
            detail=[{
                "loc": ["body", field_name],
                "msg": f"{field_name} must be an array",
                "type": "type_error.list",
            }],
        )
    return parsed


def _parse_post_title_and_body(raw_text: Optional[str]) -> Tuple[Optional[str], str]:
    """
    Extract title/body from a single text field:
    - First line before '\n' is title when <= TITLE_PARSE_LIMIT
    - If there is no '\n', first sentence (.?!…) is title when <= TITLE_PARSE_LIMIT
    - Otherwise title=None and body=full text
    Safety: rollback to full text when extracted body is too short.
    """
    normalized = str(raw_text or "").replace("\r\n", "\n").replace("\r", "\n")
    full_text = normalized.strip()
    if not full_text:
        return None, ""

    if "\n" in normalized:
        first_line_raw, rest_raw = normalized.split("\n", 1)
        first_line = first_line_raw.strip()
        rest_text = rest_raw.strip()
        if first_line and len(first_line) <= TITLE_PARSE_LIMIT:
            if len(rest_text) >= POST_BODY_MIN_LEN:
                return first_line, rest_text
            return None, full_text
        return None, full_text

    sentence_match = re.search("[.!?\u2026]", full_text)
    if sentence_match:
        sentence_end = sentence_match.end()
        first_sentence = full_text[:sentence_end].strip()
        rest_text = full_text[sentence_end:].strip()
        if first_sentence and len(first_sentence) <= TITLE_PARSE_LIMIT:
            if len(rest_text) >= POST_BODY_MIN_LEN:
                return first_sentence, rest_text
            return None, full_text

    return None, full_text


def _count_letters(value: Optional[str]) -> int:
    return len(MEMES_LETTERS_RE.findall(str(value or "")))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup...")
    await init_db()
    logger.info("Database initialized")
    runtime_settings = get_settings()
    stop_event = asyncio.Event()
    nightly_task = None
    if runtime_settings.analytics_nightly_enabled:
        nightly_task = asyncio.create_task(analytics_service.run_nightly_rebuild_loop(stop_event))
    app.state.analytics_stop_event = stop_event
    app.state.analytics_nightly_task = nightly_task
    yield
    stop_event.set()
    if nightly_task:
        try:
            await asyncio.wait_for(nightly_task, timeout=5)
        except asyncio.TimeoutError:
            nightly_task.cancel()
    await engine.dispose()
    await close_redis()
    logger.info("Engines disposed")

app = FastAPI(
    title="Campus App API",
    description="Backend API for campus social app",
    version="2.2.0",
    lifespan=lifespan,
)

# ===== ROUTERS =====
settings = get_settings()

app.include_router(dating.router)
app.include_router(moderation.router)
app.include_router(ads.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(auth_router.router)
if not settings.is_prod and settings.app_env.lower() == "dev" and settings.dev_auth_enabled:
    app.include_router(dev_auth_router.router)

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=[],
)


PUBLIC_PATHS = ("/", "/health", "/openapi.json")
public_prefixes = [
    "/docs",
    "/redoc",
    "/uploads",
    "/auth/telegram/login",
    "/auth/refresh",
    "/auth/logout",
    "/notifications/queue",
    "/notifications/followups",
    "/posts/feed",
    "/api/requests/feed",
]
if settings.app_env.lower() == "dev" and settings.dev_auth_enabled:
    public_prefixes.append("/dev/auth")
PUBLIC_PREFIXES = tuple(public_prefixes)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.method.upper() == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    is_public_path = path in PUBLIC_PATHS or any(
        path == prefix or path.startswith(prefix + "/") for prefix in PUBLIC_PREFIXES
    )

    auth_header = request.headers.get("authorization")
    payload = None
    if auth_header:
        try:
            payload = decode_authorization_header(auth_header)
        except HTTPException as exc:
            if not is_public_path:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
            payload = None
    if payload is not None:
        request.state.auth_payload = payload

    query_telegram_id = request.query_params.get("telegram_id")
    if query_telegram_id is not None and payload is not None:
        try:
            token_tgid = int(payload.get("tgid"))
            query_tgid = int(query_telegram_id)
        except (TypeError, ValueError):
            return JSONResponse(status_code=401, content={"detail": "Invalid telegram_id"})
        if token_tgid != query_tgid:
            return JSONResponse(status_code=403, content={"detail": "telegram_id mismatch"})

    if is_public_path:
        return await call_next(request)

    if payload is None:
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})

    return await call_next(request)

# ===== STATIC FILES =====
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/images", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def root():
    return {"message": "Campus App API ✅", "version": "2.2.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# ===== USER ENDPOINTS =====

@app.get("/users/me", response_model=schemas.UserResponse)
async def get_current_user(telegram_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    telegram_id: int = Query(...)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_avatar = user.avatar
    try:
        avatars_meta = await process_uploaded_files([file], kind="avatars")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not avatars_meta:
        raise HTTPException(status_code=400, detail="Avatar file is required")

    avatar_url = normalize_uploads_path(avatars_meta[0]["url"], "avatars")
    try:
        user.avatar = avatar_url
        await db.commit()
        await db.refresh(user)
    except Exception:
        await db.rollback()
        delete_images([avatars_meta[0]], default_kind="avatars")
        raise HTTPException(status_code=500, detail="Failed to save avatar")

    if old_avatar and old_avatar != avatar_url:
        delete_images([old_avatar], default_kind="avatars")

    return {"avatar": user.avatar}

@app.patch("/users/me", response_model=schemas.UserResponse)
async def update_current_user(
    telegram_id: int = Query(...),
    user_update: schemas.UserUpdate = Body(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    critical_fields = ["campus_id", "university", "institute", "course"]
    changing_critical = any(
        field in update_data and update_data[field] != getattr(user, field)
        for field in critical_fields
    )
    
    if changing_critical:
        if not await crud.can_edit_critical_fields(db, user.id):
            days_left = await crud.get_cooldown_days_left(db, user.id)
            raise HTTPException(
                status_code=403,
                detail=f"Can be changed in {days_left} days (30-day cooldown)"
            )
    
    updated_user = await crud.update_user(db, user.id, user_update)
    
    if changing_critical:
        updated_user.last_profile_edit = datetime.utcnow()
        await db.commit()
        await db.refresh(updated_user)
    
    return updated_user

@app.get("/users/{user_id}/posts", response_model=List[schemas.PostResponse])
async def get_user_posts_endpoint(
    user_id: int,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    requesting_user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user = await crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    posts = await crud.get_user_posts(db, user_id, limit, offset)
    
    result = []
    for post in posts:
        tags = post.tags or []
        images = get_image_urls(post.images) if post.images else []
        
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
        else:
            author_data = schemas.UserShort.from_orm(target_user)
        
        # === LOGIC FOR AD FIELDS ===
        ad_data = {}
        if post.category == 'ad':
            # Load related ad metadata
            ad_info_result = await db.execute(
                select(models.AdPost).where(models.AdPost.post_id == post.id)
            )
            ad_info = ad_info_result.scalar_one_or_none()
            if ad_info:
                ad_data = {
                    "ad_id": ad_info.id,
                    "advertiser_name": ad_info.advertiser_name,
                    "advertiser_logo": ad_info.advertiser_logo,
                    "cta_text": ad_info.cta_text,
                    "cta_url": ad_info.cta_url,
                    "scope": ad_info.scope,
                    "target_university": ad_info.target_university,
                    "target_city": ad_info.target_city
                }
        # ==========================
        
        post_dict = {
            "id": post.id,
            "author_id": post.author_id,
            "author": author_data,
            "category": post.category,
            "title": post.title,
            "body": post.body,
            "tags": tags,
            "images": images,
            "is_anonymous": post.is_anonymous,
            "enable_anonymous_comments": post.enable_anonymous_comments,
            "lost_or_found": post.lost_or_found,
            "item_description": post.item_description,
            "location": post.location,
            "reward_type": post.reward_type,
            "reward_value": post.reward_value,
            "event_name": post.event_name,
            "event_date": post.event_date,
            "event_location": post.event_location,
            "event_contact": post.event_contact,
            "is_important": post.is_important,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "views_count": post.views_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            **ad_data #   
        }
        result.append(post_dict)
    
    return normalize_datetime_payload(result)

@app.get("/users/{user_id}/stats")
async def get_user_stats(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "posts_count": await crud.count_user_posts(db, user_id),
        "comments_count": await crud.count_user_comments(db, user_id),
        "likes_count": await crud.count_user_total_likes(db, user_id)
    }

# ===== POST ENDPOINTS + POLLS =====
@app.get("/posts/feed", response_model=schemas.PostsFeedResponse)
async def get_posts_feed(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),

    # FILTER PARAMS
    university: Optional[str] = Query(None),      # Filter by university
    institute: Optional[str] = Query(None),       # Filter by institute
    campus_id: Optional[str] = Query(None),       # Filter by campus
    city: Optional[str] = Query(None),            # Filter by city
    tags: Optional[str] = Query(None),            # Comma-separated: "help,urgent"
    date_range: Optional[str] = Query(None),      # 'today' | 'week' | 'month'
    sort: Optional[str] = Query('newest'),        # 'newest' | 'popular' | 'discussed'
    
    db: AsyncSession = Depends(get_db)
):
    """Posts feed with filtering."""
    auth_payload = getattr(request.state, "auth_payload", None)
    telegram_id = None
    if auth_payload:
        try:
            telegram_id = int(auth_payload.get("tgid"))
        except (TypeError, ValueError):
            telegram_id = None

    user = await crud.get_user_by_telegram_id(db, telegram_id) if telegram_id else None
    current_user_id = user.id if user else None
    if user:
        await analytics_service.record_server_event(
            db,
            user.id,
            "feed_open",
            entity_type="feed",
            entity_id=0,
            properties_json={"surface": "posts_feed"},
        )

    # Pass all filter params into CRUD
    posts = await crud.get_posts(
        db, 
        skip=skip, 
        limit=limit, 
        category=category,
        university=university,
        institute=institute,
        campus_id=campus_id,
        city=city,
        tags=tags,
        date_range=date_range,
        sort=sort,
        current_user_id=current_user_id
    )

    result = []
    for post in posts:
        tags = post.tags or []
        is_liked = await crud.is_post_liked_by_user(db, post.id, user.id) if user else False
        images = get_image_urls(post.images) if post.images else []

        author_id_data = post.author_id if post.is_anonymous else post.author_id
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
            author_id_data = None
        else:
            author_data = schemas.UserShort.from_orm(post.author) if post.author else None

        poll_response = None
        if post.poll:
            user_vote = None
            if user:
                user_vote_result = await db.execute(
                    select(models.PollVote).where(
                    models.PollVote.poll_id == post.poll.id,
                    models.PollVote.user_id == user.id
                    )
                )
                user_vote = user_vote_result.scalar_one_or_none()
            user_votes_indices = user_vote.option_indices if user_vote else []

            options_data = post.poll.options or []
            options_response = []
            for opt in options_data:
                percentage = (opt['votes'] / post.poll.total_votes * 100) if post.poll.total_votes > 0 else 0
                options_response.append({
                    "text": opt['text'],
                    "votes": opt['votes'],
                    "percentage": round(percentage, 1)
                })

            poll_response = {
                "id": post.poll.id,
                "post_id": post.poll.post_id,
                "question": post.poll.question,
                "options": options_response,
                "type": post.poll.type,
                "correct_option": post.poll.correct_option,
                "allow_multiple": post.poll.allow_multiple,
                "is_anonymous": post.poll.is_anonymous,
                "closes_at": post.poll.closes_at,
                "total_votes": post.poll.total_votes,
                "is_closed": False,
                "user_votes": user_votes_indices
            }

        post_dict = {
            "id": post.id,
            "author_id": author_id_data,
            "author": author_data,
            "category": post.category,
            "title": post.title,
            "body": post.body,
            "tags": tags,
            "images": images,
            "is_anonymous": post.is_anonymous,
            "enable_anonymous_comments": post.enable_anonymous_comments,
            "lost_or_found": post.lost_or_found,
            "item_description": post.item_description,
            "location": post.location,
            "reward_type": post.reward_type,
            "reward_value": post.reward_value,
            "event_name": post.event_name,
            "event_date": post.event_date,
            "event_location": post.event_location,
            "event_contact": post.event_contact,
            "is_important": post.is_important,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "views_count": post.views_count,
            "is_liked": is_liked,
            "poll": poll_response,
            "created_at": post.created_at,
            "updated_at": post.updated_at
        }
        result.append(post_dict)

    return normalize_datetime_payload({
        "items": result,
        "total": len(result),
        "has_more": len(posts) == limit
    })

@app.post("/posts/create", response_model=schemas.PostResponse)
async def create_post_endpoint(
    telegram_id: int = Query(...),
    category: str = Form(...),
    body: str = Form(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_anonymous: Optional[bool] = Form(False),
    
    lost_or_found: Optional[str] = Form(None),
    item_description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    reward_type: Optional[str] = Form(None),
    reward_value: Optional[str] = Form(None),
    
    event_name: Optional[str] = Form(None),
    event_date: Optional[str] = Form(None),
    event_location: Optional[str] = Form(None),
    event_contact: Optional[str] = Form(None),
    
    is_important: Optional[bool] = Form(False),
    images: List[UploadFile] = File(default=[]),
    
    poll_data: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    raw_title = title
    raw_body = body

    if category != "polls":
        incoming_title = (title or "").strip()
        if incoming_title:
            title = incoming_title
            body = (body or "").strip()
        else:
            title, body = _parse_post_title_and_body(body)
    else:
        title = (title or "").strip() or None
        body = (body or "").strip()

    # DETAILED DEBUG LOGGING
    print(f"\n{'='*60}")
    print("POST CREATE REQUEST")
    print(f"{'='*60}")
    print(f"category: {category!r}")
    print(f"title(raw): {raw_title!r}")
    print(f"body(raw): {raw_body!r}")
    print(f"title(parsed): {title!r}")
    print(f"body(parsed): {body!r}")
    print(f"is_anonymous: {is_anonymous}")
    print(f"images raw list length: {len(images)}")
    
    # LOG EACH UPLOADED FILE
    for idx, img in enumerate(images):
        print(f"  Image [{idx}]: filename={img.filename!r}, content_type={img.content_type}")
    
    print(f"{'='*60}\n")
    
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tags_list = _parse_json_list_form_field(tags, "tags")
    
    # FILTER OUT EMPTY FILES (KEY FIX)
    valid_images = [
        img for img in images 
        if img.filename and len(img.filename) > 0
    ]
    
    print(f"Valid images after filter: {len(valid_images)}")
    
    # CONFESSIONS VALIDATION (fixed: moved inside IF block)
    if category == "confessions":
        is_anonymous = True
        # Validation is inside the block and uses valid_images
        if len(valid_images) > 0:
            raise HTTPException(status_code=400, detail="Confessions не поддерживают изображения")
    
    # MAX IMAGE COUNT CHECK (use valid_images)
    if len(valid_images) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")

    if category == "memes":
        has_images = len(valid_images) > 0
        has_text = _count_letters(body) >= MEMES_MIN_LETTERS
        if not has_images and not has_text:
            raise HTTPException(
                status_code=400,
                detail="Для категории Мемы нужно добавить фото или текст от 3 букв",
            )
    
    try:
        post_data = schemas.PostCreate(
            category=category,
            title=title,
            body=body,
            tags=tags_list,
            is_anonymous=is_anonymous,
            lost_or_found=lost_or_found,
            item_description=item_description,
            location=location,
            reward_type=reward_type,
            reward_value=reward_value,
            event_name=event_name,
            event_date=event_date,
            event_location=event_location,
            event_contact=event_contact,
            is_important=is_important,
            images=[]
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    
    try:
        # valid_images instead of images
        images_meta = await process_uploaded_files(valid_images) if valid_images else []
        post = await crud.create_post(db, post_data, user.id, images_meta=images_meta)
        
        if poll_data:
            try:
                poll_dict = json.loads(poll_data)
                poll_schema = schemas.PollCreate(**poll_dict)
                await crud.create_poll(db, post.id, poll_schema)
            except Exception as e:
                print(f"   : {e}")
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await analytics_service.record_server_event(
        db,
        user.id,
        "create_success",
        entity_type="post",
        entity_id=post.id,
        properties_json={"category": category},
    )
    
    return await get_post_endpoint(post.id, telegram_id, db)

@app.get("/posts/{post_id}", response_model=schemas.PostResponse)
async def get_post_endpoint(post_id: int, telegram_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    
    post = await crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if user:
        await crud.increment_post_views(db, post_id, user.id)
        await analytics_service.record_server_event(
            db,
            user.id,
            "post_open",
            entity_type="post",
            entity_id=post_id,
        )
    
    is_liked = await crud.is_post_liked_by_user(db, post_id, user.id) if user else False
    tags = post.tags or []
    images = get_image_urls(post.images) if post.images else []
    
    author_id_data = post.author_id if post.is_anonymous else post.author_id
    
    if post.is_anonymous:
        author_data = {"name": "Аноним"}
        author_id_data = None
    else:
        author_data = schemas.UserShort.from_orm(post.author) if post.author else None
    
    poll_response = None
    if post.poll:
        user_vote = None
        if user:
            user_vote_result = await db.execute(
                select(models.PollVote).where(
                models.PollVote.poll_id == post.poll.id,
                models.PollVote.user_id == user.id
                )
            )
            user_vote = user_vote_result.scalar_one_or_none()
        
        user_votes_indices = user_vote.option_indices if user_vote else []
        
        options_data = post.poll.options or []
        options_response = []
        for opt in options_data:
            percentage = (opt['votes'] / post.poll.total_votes * 100) if post.poll.total_votes > 0 else 0
            options_response.append({
                "text": opt['text'],
                "votes": opt['votes'],
                "percentage": round(percentage, 1)
            })
        
        poll_response = {
            "id": post.poll.id,
            "post_id": post.poll.post_id,
            "question": post.poll.question,
            "options": options_response,
            "type": post.poll.type,
            "correct_option": post.poll.correct_option,
            "allow_multiple": post.poll.allow_multiple,
            "is_anonymous": post.poll.is_anonymous,
            "closes_at": post.poll.closes_at,
            "total_votes": post.poll.total_votes,
            "is_closed": False,
            "user_votes": user_votes_indices
        }
    
    return normalize_datetime_payload({
        "id": post.id,
        "author_id": author_id_data,
        "author": author_data,
        "category": post.category,
        "title": post.title,
        "body": post.body,
        "tags": tags,
        "images": images,
        "is_anonymous": post.is_anonymous,
        "enable_anonymous_comments": post.enable_anonymous_comments,
        "lost_or_found": post.lost_or_found,
        "item_description": post.item_description,
        "location": post.location,
        "reward_type": post.reward_type,
        "reward_value": post.reward_value,
        "event_name": post.event_name,
        "event_date": post.event_date,
        "event_location": post.event_location,
        "event_contact": post.event_contact,
        "is_important": post.is_important,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "views_count": post.views_count,
        "is_liked": is_liked,
        "poll": poll_response,
        "created_at": post.created_at,
        "updated_at": post.updated_at
    })

@app.delete("/posts/{post_id}")
async def delete_post_endpoint(post_id: int, telegram_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = await crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    success = await crud.delete_post(db, post_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete")
    
    return {"success": True}

@app.patch("/posts/{post_id}", response_model=schemas.PostResponse)
async def update_post_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    title: Optional[str] = Form(None),
    body: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    lost_or_found: Optional[str] = Form(None),
    item_description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    reward_type: Optional[str] = Form(None),
    reward_value: Optional[str] = Form(None),
    event_name: Optional[str] = Form(None),
    event_date: Optional[str] = Form(None),
    event_location: Optional[str] = Form(None),
    event_contact: Optional[str] = Form(None),
    is_important: Optional[bool] = Form(None),
    new_images: List[UploadFile] = File(default=[]),
    keep_images: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    post = await crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    tags_list = _parse_json_list_form_field(tags, "tags") if tags is not None else None
    try:
        keep_images_list = parse_keep_file_list(keep_images, kind="images")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    valid_new_images = [img for img in new_images if img.filename and len(img.filename) > 0]

    total_images = len(keep_images_list) + len(valid_new_images)
    if total_images > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")
    
    if post.category == "confessions" and (len(valid_new_images) > 0 or len(keep_images_list) > 0):
        raise HTTPException(status_code=400, detail="Confessions не поддерживают изображения")
    
    try:
        post_update = schemas.PostUpdate(
            title=title,
            body=body,
            tags=tags_list,
            lost_or_found=lost_or_found,
            item_description=item_description,
            location=location,
            reward_type=reward_type,
            reward_value=reward_value,
            event_name=event_name,
            event_date=event_date,
            event_location=event_location,
            event_contact=event_contact,
            is_important=is_important,
            images=None
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    
    try:
        new_images_meta = await process_uploaded_files(valid_new_images) if valid_new_images else []
        updated_post = await crud.update_post(
            db, post_id, post_update,
            new_images_meta=new_images_meta,
            keep_filenames=keep_images_list
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return await get_post_endpoint(updated_post.id, telegram_id, db)

@app.post("/posts/{post_id}/like")
async def toggle_post_like_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await crud.toggle_post_like(db, post_id, user.id)
    if result.get("is_liked"):
        await analytics_service.record_server_event(
            db,
            user.id,
            "post_like",
            entity_type="post",
            entity_id=post_id,
        )
    return result

# ===== POLL ENDPOINTS (NEW) =====

@app.post("/polls/{poll_id}/vote")
async def vote_poll_endpoint(
    poll_id: int,
    vote_data: schemas.PollVoteCreate,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        result = await crud.vote_poll(db, poll_id, user.id, vote_data.option_indices)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== COMMENT ENDPOINTS =====

@app.get("/posts/{post_id}/comments", response_model=schemas.CommentsFeedResponse)
async def get_post_comments_endpoint(
    post_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    comments = await crud.get_post_comments(db, post_id, user.id if user else None)
    
    result = []
    for comment in comments:
        author_data = None
        author_id_data = comment.author_id
        
        if comment.is_anonymous:
            if comment.anonymous_index == 0 or comment.anonymous_index is None:
                author_name = "Автор"
            else:
                author_name = f"Аноним #{comment.anonymous_index}"
            
            author_data = {
                "name": author_name,
                "id": None,
                "telegram_id": None,
                "avatar": None,
                "university": None,
                "institute": None,
                "course": None
            }
            author_id_data = comment.author_id
        else:
            if comment.author:
                author_data = schemas.UserShort.from_orm(comment.author).dict()
                author_data['id'] = comment.author.id
                author_data['telegram_id'] = comment.author.telegram_id
        
        comment_dict = {
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": author_id_data,
            "author": author_data,
            "body": comment.body,
            "parent_id": comment.parent_id,
            "is_anonymous": comment.is_anonymous,
            "anonymous_index": comment.anonymous_index,
            "is_deleted": comment.is_deleted,
            "likes": comment.likes_count,
            "is_liked": comment.is_liked,
            "images": get_image_urls(comment.images) if comment.images else [],
            "created_at": comment.created_at
        }
        result.append(comment_dict)
    
    return normalize_datetime_payload({"items": result, "total": len(result)})

@app.post("/posts/{post_id}/comments", response_model=schemas.CommentResponse)
async def create_comment_endpoint(
    post_id: int,
    request: Request,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    content_type = (request.headers.get("content-type") or "").lower()

    try:
        if "multipart/form-data" in content_type:
            form = await request.form()

            body_raw = form.get("body")
            body = body_raw if isinstance(body_raw, str) else ""
            body = (body or "").strip()

            parent_raw = form.get("parent_id")
            parent_id = int(parent_raw) if parent_raw not in (None, "", "null") else None

            is_anonymous_raw = str(form.get("is_anonymous", "false")).lower()
            is_anonymous = is_anonymous_raw in {"1", "true", "yes", "on"}

            raw_images = [*form.getlist("images"), *form.getlist("images[]")]
            valid_images = [
                img for img in raw_images
                if hasattr(img, "filename") and img.filename and len(img.filename) > 0
            ]

            if len(valid_images) > 3:
                raise HTTPException(status_code=400, detail="Maximum 3 images")
            if not body and not valid_images:
                raise HTTPException(status_code=422, detail="Comment must contain text or images")

            images_meta = await process_uploaded_files(valid_images) if valid_images else []
            comment_data = schemas.CommentCreate(
                post_id=post_id,
                body=body,
                parent_id=parent_id,
                is_anonymous=is_anonymous,
                images=images_meta,
            )
        else:
            payload = await request.json()
            if not isinstance(payload, dict):
                raise HTTPException(status_code=422, detail="Invalid payload")
            payload["post_id"] = post_id
            comment_data = schemas.CommentCreate(**payload)
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    comment = await crud.create_comment(db, comment_data, user.id)
    if not comment:
        raise HTTPException(status_code=404, detail="Post not found")

    await analytics_service.record_server_event(
        db,
        user.id,
        "comment_create",
        entity_type="comment",
        entity_id=comment.id,
        properties_json={"post_id": post_id},
    )
    
    author_data = None
    author_id_data = comment.author_id
    
    if comment.is_anonymous:
        if comment.anonymous_index == 0 or comment.anonymous_index is None:
            author_name = "Автор"
        else:
            author_name = f"Аноним #{comment.anonymous_index}"
        author_data = {"name": author_name}
    else:
        author_data = schemas.UserShort.from_orm(user)
    
    return normalize_datetime_payload({
        "id": comment.id,
        "post_id": comment.post_id,
        "author_id": author_id_data,
        "author": author_data,
        "body": comment.body,
        "parent_id": comment.parent_id,
        "is_anonymous": comment.is_anonymous,
        "anonymous_index": comment.anonymous_index,
        "likes": 0,
        "is_liked": False,
        "images": get_image_urls(comment.images) if comment.images else [],
        "created_at": comment.created_at
    })

@app.delete("/comments/{comment_id}")
async def delete_comment_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return await crud.delete_comment(db, comment_id, user.id)

@app.patch("/comments/{comment_id}", response_model=schemas.CommentResponse)
async def update_comment_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    comment_update: schemas.CommentUpdate = Body(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    comment = await crud.update_comment(db, comment_id, comment_update.body, user.id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found or permission denied")
    
    author_data = None
    author_id_data = comment.author_id
    
    if comment.is_anonymous:
        if comment.anonymous_index == 0 or comment.anonymous_index is None:
            author_name = "Автор"
        else:
            author_name = f"Аноним #{comment.anonymous_index}"
        author_data = {"name": author_name}
    else:
        author_data = schemas.UserShort.from_orm(comment.author) if comment.author else None
    
    return normalize_datetime_payload({
        "id": comment.id,
        "post_id": comment.post_id,
        "author_id": author_id_data,
        "author": author_data,
        "body": comment.body,
        "parent_id": comment.parent_id,
        "is_anonymous": comment.is_anonymous,
        "anonymous_index": comment.anonymous_index,
        "is_edited": comment.is_edited,
        "likes": comment.likes_count,
        "is_liked": getattr(comment, 'is_liked', False),
        "images": get_image_urls(comment.images) if comment.images else [],
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    })

@app.post("/comments/{comment_id}/like")
async def toggle_comment_like_endpoint(
    comment_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return await crud.toggle_comment_like(db, comment_id, user.id)

# ===== REQUEST ENDPOINTS =====

@app.post("/api/requests/create", response_model=schemas.RequestResponse)
async def create_request_endpoint(
    telegram_id: int = Query(...),
    
    # Multipart form fields
    category: str = Form(...),
    title: str = Form(...),
    body: str = Form(...),
    expires_at: str = Form(...),
    tags: Optional[str] = Form(None),
    max_responses: Optional[int] = Form(5),
    
    # REWARD FIELDS
    reward_type: Optional[str] = Form(None),
    reward_value: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tags_list = _parse_json_list_form_field(tags, "tags")
    valid_images = [img for img in images if img.filename and len(img.filename) > 0]

    if len(valid_images) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")
    
    try:
        request_data = schemas.RequestCreate(
            category=category,
            title=title,
            body=body,
            tags=tags_list,
            expires_at=expires_at,
            max_responses=max_responses,
            reward_type=reward_type,
            reward_value=reward_value,
            images=[]
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    
    try:
        images_meta = await process_uploaded_files(valid_images) if valid_images else []
        request = await crud.create_request(db, request_data, user.id, images_meta=images_meta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await analytics_service.record_server_event(
        db,
        user.id,
        "create_success",
        entity_type="request",
        entity_id=request.id,
        properties_json={"category": category},
    )
    
    images_urls = get_image_urls(request.images) if request.images else []
    
    author_data = schemas.UserShort(
        id=user.id,
        name=user.name,
        course=user.course,
        university=user.university,
        institute=user.institute,
        username=user.username,
        avatar=user.avatar
    )
    
    return schemas.RequestResponse(
        id=request.id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=request.tags or [],
        expires_at=ensure_utc(request.expires_at),
        status=request.status,
        views_count=request.views_count,
        responses_count=0,
        created_at=ensure_utc(request.created_at),
        author=author_data,
        is_author=True,
        has_responded=False,
        reward_type=request.reward_type,
        reward_value=request.reward_value,
        images=images_urls
    )

@app.get("/api/requests/feed", response_model=schemas.RequestsFeedResponse)
async def get_requests_feed_endpoint(
    request: Request,
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),

    # FILTER PARAMS
    university: Optional[str] = Query(None),      # Filter by university
    institute: Optional[str] = Query(None),       # Filter by institute
    campus_id: Optional[str] = Query(None),       # Filter by campus
    city: Optional[str] = Query(None),            # Filter by city
    status: Optional[str] = Query('active'),      # 'active' | 'all'
    has_reward: Optional[str] = Query(None),      # 'with' | 'without'
    urgency: Optional[str] = Query(None),         # 'soon' (<24h) | 'later'
    sort: Optional[str] = Query('newest'),        # 'newest' | 'expires_soon' | 'most_responses'
    
    db: AsyncSession = Depends(get_db)
):
    """Requests feed with filtering."""
    current_user_id = None
    auth_payload = getattr(request.state, "auth_payload", None)
    telegram_id = None
    if auth_payload:
        try:
            telegram_id = int(auth_payload.get("tgid"))
        except (TypeError, ValueError):
            telegram_id = None

    if telegram_id:
        user = await crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            current_user_id = user.id

    # Pass all filter params into CRUD
    feed_data = await crud.get_requests_feed(
        db, 
        category, 
        limit, 
        offset, 
        current_user_id,
        university=university,
        institute=institute,
        campus_id=campus_id,
        city=city,
        status=status,
        has_reward=has_reward,
        urgency=urgency,
        sort=sort
    )

    items = []
    for req_dict in feed_data['items']:
        author_data = schemas.UserShort(
            id=req_dict['author'].id,
            name=req_dict['author'].name,
            course=req_dict['author'].course,
            university=req_dict['author'].university,
            institute=req_dict['author'].institute,
            username=req_dict['author'].username,
            avatar=req_dict['author'].avatar
        )

        items.append(schemas.RequestResponse(
            id=req_dict['id'],
            category=req_dict['category'],
            title=req_dict['title'],
            body=req_dict['body'],
            tags=req_dict['tags'],
            expires_at=ensure_utc(req_dict['expires_at']),
            status=req_dict['status'],
            views_count=req_dict['views_count'],
            responses_count=req_dict['responses_count'],
            created_at=ensure_utc(req_dict['created_at']),
            author=author_data,
            is_author=req_dict['is_author'],
            has_responded=req_dict['has_responded'],
            reward_type=req_dict.get('reward_type'),
            reward_value=req_dict.get('reward_value'),
            images=req_dict.get('images', [])
        ))

    return schemas.RequestsFeedResponse(
        items=items,
        total=feed_data['total'],
        has_more=feed_data['has_more']
    )

@app.get("/api/requests/my-items", response_model=List[schemas.RequestResponse])
async def get_my_requests_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Get my requests."""
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    requests = await crud.get_my_requests(db, user.id, limit=limit, offset=offset)
    
    result = []
    for req in requests:
        tags = req.tags or []
        images = get_image_urls(req.images) if req.images else []
        
        author_data = schemas.UserShort(
            id=user.id,
            name=user.name,
            course=user.course,
            university=user.university,
            institute=user.institute,
            username=user.username,
            avatar=user.avatar
        )
        
        req_dict = {
            "id": req.id,
            "category": req.category,
            "title": req.title,
            "body": req.body,
            "tags": tags,
            "expires_at": req.expires_at,
            "status": req.status,
            "views_count": req.views_count,
            "responses_count": len(req.responses) if req.responses else 0,
            "created_at": req.created_at,
            "author": author_data,
            "is_author": True,
            "has_responded": False,
            "reward_type": req.reward_type,
            "reward_value": req.reward_value,
            "images": images
        }
        result.append(req_dict)
    
    return normalize_datetime_payload(result)

@app.get("/api/requests/{request_id}", response_model=schemas.RequestResponse)
async def get_request_endpoint(
    request_id: int,
    telegram_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    current_user_id = None
    if telegram_id:
        user = await crud.get_user_by_telegram_id(db, telegram_id)
        if user:
            current_user_id = user.id
    
    request_dict = await crud.get_request_by_id(db, request_id, current_user_id)
    if not request_dict:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user_id:
        await analytics_service.record_server_event(
            db,
            current_user_id,
            "request_open",
            entity_type="request",
            entity_id=request_id,
        )
    
    author_data = schemas.UserShort(
        id=request_dict['author'].id,
        name=request_dict['author'].name,
        course=request_dict['author'].course,
        university=request_dict['author'].university,
        institute=request_dict['author'].institute,
        username=request_dict['author'].username,
        avatar=request_dict['author'].avatar
    )
    
    return schemas.RequestResponse(
        id=request_dict['id'],
        category=request_dict['category'],
        title=request_dict['title'],
        body=request_dict['body'],
        tags=request_dict['tags'],
        expires_at=ensure_utc(request_dict['expires_at']),
        status=request_dict['status'],
        views_count=request_dict['views_count'],
        responses_count=request_dict['responses_count'],
        created_at=ensure_utc(request_dict['created_at']),
        author=author_data,
        is_author=request_dict['is_author'],
        has_responded=request_dict['has_responded'],
        reward_type=request_dict.get('reward_type'),
        reward_value=request_dict.get('reward_value'),
        images=request_dict.get('images', [])
    )

@app.put("/api/requests/{request_id}", response_model=schemas.RequestResponse)
async def update_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    data: schemas.RequestUpdate = Body(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        request = await crud.update_request(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    images_urls = get_image_urls(request.images) if request.images else []
    
    author_data = schemas.UserShort(
        id=user.id,
        name=user.name,
        course=user.course,
        university=user.university,
        institute=user.institute,
        username=user.username,
        avatar=user.avatar
    )
    
    return schemas.RequestResponse(
        id=request.id,
        category=request.category,
        title=request.title,
        body=request.body,
        tags=request.tags or [],
        expires_at=ensure_utc(request.expires_at),
        status=request.status,
        views_count=request.views_count,
        responses_count=len(request.responses) if request.responses else 0,
        created_at=ensure_utc(request.created_at),
        author=author_data,
        is_author=True,
        has_responded=False,
        reward_type=request.reward_type,
        reward_value=request.reward_value,
        images=images_urls
    )

@app.delete("/api/requests/{request_id}")
async def delete_request_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        await crud.delete_request(db, request_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/api/requests/{request_id}/respond", response_model=schemas.ResponseItem)
async def create_response_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    data: schemas.ResponseCreate = Body(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        response = await crud.create_response(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await analytics_service.record_server_event(
        db,
        user.id,
        "request_response_create",
        entity_type="request",
        entity_id=request_id,
        properties_json={"response_id": response.id},
    )
    
    author_data = schemas.ResponseAuthor(
        id=user.id,
        name=user.name,
        username=user.username
    )
    
    return schemas.ResponseItem(
        id=response.id,
        message=response.message,
        telegram_contact=response.telegram_contact,
        created_at=ensure_utc(response.created_at),
        author=author_data
    )

@app.get("/api/requests/{request_id}/responses", response_model=List[schemas.ResponseItem])
async def get_responses_endpoint(
    request_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        responses = await crud.get_request_responses(db, request_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    result = []
    for resp in responses:
        author_data = schemas.ResponseAuthor(
            id=resp.author.id,
            name=resp.author.name,
            username=resp.author.username
        )
        result.append(schemas.ResponseItem(
            id=resp.id,
            message=resp.message,
            telegram_contact=resp.telegram_contact,
            created_at=ensure_utc(resp.created_at),
            author=author_data
        ))
    
    return result

@app.delete("/api/responses/{response_id}")
async def delete_response_endpoint(
    response_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        await crud.delete_response(db, response_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

# ===== CAMPUS MANAGEMENT ENDPOINTS =====

@app.get("/admin/campuses/unbound-users")
async def get_unbound_users_endpoint(
    telegram_id: int = Query(...),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List users without campus binding (for ambassadors/admins)."""
    # Access check
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user or user.role not in ('ambassador', 'admin', 'superadmin'):
        raise HTTPException(status_code=403, detail="Access denied")

    data = await crud.get_unbound_users(db, search=search, limit=limit, offset=offset)

    items = []
    for u in data["items"]:
        items.append({
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "username": u.username,
            "university": u.university,
            "custom_university": u.custom_university,
            "custom_city": u.custom_city,
            "custom_faculty": u.custom_faculty,
            "institute": u.institute,
            "course": u.course,
            "avatar": u.avatar,
            "created_at": u.created_at,
        })

    return normalize_datetime_payload({"items": items, "total": data["total"], "has_more": data["has_more"]})


@app.post("/admin/campuses/bind-user")
async def bind_user_to_campus_endpoint(
    telegram_id: int = Query(...),
    user_id: int = Body(...),
    campus_id: str = Body(...),
    university: str = Body(...),
    city: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    """   ."""
    admin = await crud.get_user_by_telegram_id(db, telegram_id)
    if not admin or admin.role not in ('ambassador', 'admin', 'superadmin'):
        raise HTTPException(status_code=403, detail="Нет доступа")

    user = await crud.bind_user_to_campus(db, user_id, campus_id, university, city)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return {"ok": True, "user_id": user.id, "campus_id": user.campus_id}


@app.post("/admin/campuses/unbind-user")
async def unbind_user_from_campus_endpoint(
    telegram_id: int = Query(...),
    user_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """   ."""
    admin = await crud.get_user_by_telegram_id(db, telegram_id)
    if not admin or admin.role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail="Только для админов")

    user = await crud.unbind_user_from_campus(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return {"ok": True, "user_id": user.id}


# ===== MARKET ENDPOINTS =====

@app.get("/market/categories", response_model=schemas.MarketCategoriesResponse)
async def get_market_categories_endpoint(db: AsyncSession = Depends(get_db)):
    return await crud.get_market_categories(db)

@app.get("/market/feed", response_model=schemas.MarketFeedResponse)
async def get_market_feed_endpoint(
    telegram_id: int = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    sort: Optional[str] = Query("newest"),
    search: Optional[str] = Query(None),
    price_min: Optional[int] = Query(None),
    price_max: Optional[int] = Query(None),
    condition: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    campus_id: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    current_user_id = user.id if user else None
    
    feed_data = await crud.get_market_items(
        db,
        skip=skip,
        limit=limit,
        category=category,
        sort=sort,
        search=search,
        price_min=price_min,
        price_max=price_max,
        condition=condition,
        university=university,
        institute=institute,
        campus_id=campus_id,
        city=city,
        current_user_id=current_user_id
    )
    
    items = []
    for item in feed_data['items']:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = schemas.UserShort(
            id=item.seller.id,
            name=item.seller.name,
            username=item.seller.username,
            university=item.seller.university,
            institute=item.seller.institute,
            course=item.seller.course,
            avatar=item.seller.avatar, 
            show_profile=item.seller.show_profile, 
            show_telegram_id=item.seller.show_telegram_id
        )

        is_seller = bool(user and item.seller_id == user.id)
        is_favorited = await crud.is_item_favorited(db, item.id, user.id) if user else False
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "location": item.location,
            "images": images,
            "status": item.status,
            "university": item.university,
            "institute": item.institute,
            "views_count": item.views_count,
            "favorites_count": item.favorites_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_seller": is_seller,
            "is_favorited": is_favorited
        }
        items.append(item_dict)
    
    return normalize_datetime_payload({
        "items": items,
        "total": feed_data['total'],
        "has_more": feed_data['has_more']
    })

@app.get("/market/favorites", response_model=List[schemas.MarketItemResponse])
async def get_market_favorites_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    items = await crud.get_user_favorites(db, user.id, limit, offset)
    
    result = []
    for item in items:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = schemas.UserShort(
            id=item.seller.id,
            name=item.seller.name,
            username=item.seller.username,
            university=item.seller.university,
            institute=item.seller.institute,
            course=item.seller.course,
            avatar=item.seller.avatar,
            show_profile=item.seller.show_profile,
            show_telegram_id=item.seller.show_telegram_id
        )
        
        is_seller = item.seller_id == user.id
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "location": item.location,
            "images": images,
            "status": item.status,
            "university": item.university,
            "institute": item.institute,
            "views_count": item.views_count,
            "favorites_count": item.favorites_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_seller": is_seller,
            "is_favorited": True
        }
        result.append(item_dict)
    
    return normalize_datetime_payload(result)

@app.get("/market/my-items", response_model=List[schemas.MarketItemResponse])
async def get_my_market_items_endpoint(
    telegram_id: int = Query(...),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Get my market items (items I am selling)."""
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    items = await crud.get_user_market_items(db, user.id, limit, offset)
    
    result = []
    for item in items:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = schemas.UserShort(
            id=user.id,
            name=user.name,
            username=user.username,
            university=user.university,
            institute=user.institute,
            course=user.course,
            avatar=user.avatar, 
            show_profile=user.show_profile,
            show_telegram_id=user.show_telegram_id
        )
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "location": item.location,
            "images": images,
            "status": item.status,
            "university": item.university,
            "institute": item.institute,
            "views_count": item.views_count,
            "favorites_count": item.favorites_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_seller": True,
            "is_favorited": False
        }
        result.append(item_dict)
    
    return result

@app.get("/market/{item_id}", response_model=schemas.MarketItemResponse)
async def get_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    item = await crud.get_market_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if user:
        await analytics_service.record_server_event(
            db,
            user.id,
            "market_item_open",
            entity_type="market_item",
            entity_id=item_id,
        )
    
    images = get_image_urls(item.images) if item.images else []
    
    seller_data = schemas.UserShort(
        id=item.seller.id,
        name=item.seller.name,
        username=item.seller.username,
        university=item.seller.university,
        institute=item.seller.institute,
        course=item.seller.course,
        avatar=item.seller.avatar,
        show_profile=item.seller.show_profile,
        show_telegram_id=item.seller.show_telegram_id
    )
    
    is_favorited = await crud.is_item_favorited(db, item.id, user.id) if user else False
    is_seller = bool(user and item.seller_id == user.id)
    
    return normalize_datetime_payload({
        "id": item.id,
        "seller_id": item.seller_id,
        "seller": seller_data,
        "category": item.category,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "condition": item.condition,
        "location": item.location,
        "images": images,
        "status": item.status,
        "university": item.university,
        "institute": item.institute,
        "views_count": item.views_count,
        "favorites_count": item.favorites_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "is_seller": is_seller,
        "is_favorited": is_favorited
    })

@app.post("/market/items", response_model=schemas.MarketItemResponse)
async def create_market_item_endpoint(
    telegram_id: int = Query(...),
    category: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    price: int = Form(...),
    condition: str = Form(...),
    location: Optional[str] = Form(None),
    images: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    valid_images = [img for img in images if img.filename and len(img.filename) > 0]

    if len(valid_images) < 1:
        raise HTTPException(status_code=400, detail="At least 1 photo is required")
    
    if len(valid_images) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")
    
    item_data = schemas.MarketItemCreate(
        category=category,
        title=title,
        description=description,
        price=price,
        condition=condition,
        location=location,
        images=["placeholder"]
    )
    
    try:
        images_meta = await process_uploaded_files(valid_images) if valid_images else []
        item = await crud.create_market_item(db, item_data, user.id, images_meta=images_meta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await analytics_service.record_server_event(
        db,
        user.id,
        "create_success",
        entity_type="market_item",
        entity_id=item.id,
        properties_json={"category": category},
    )
    
    images_urls = get_image_urls(item.images) if item.images else []
    
    seller_data = schemas.UserShort(
        id=user.id,
        name=user.name,
        username=user.username,
        university=user.university,
        institute=user.institute,
        course=user.course,
        avatar=user.avatar,
        show_profile=user.show_profile,
        show_telegram_id=user.show_telegram_id
    )
    
    return normalize_datetime_payload({
        "id": item.id,
        "seller_id": item.seller_id,
        "seller": seller_data,
        "category": item.category,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "condition": item.condition,
        "location": item.location,
        "images": images_urls,
        "status": item.status,
        "university": item.university,
        "institute": item.institute,
        "views_count": item.views_count,
        "favorites_count": item.favorites_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "is_seller": True,
        "is_favorited": False
    })

@app.patch("/market/{item_id}", response_model=schemas.MarketItemResponse)
async def update_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[int] = Form(None),
    condition: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    new_images: List[UploadFile] = File(default=[]),
    keep_images: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        keep_images_list = parse_keep_file_list(keep_images, kind="images")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    valid_new_images = [img for img in new_images if img.filename and len(img.filename) > 0]

    total_images = len(keep_images_list) + len(valid_new_images)
    if total_images < 1:
        raise HTTPException(status_code=400, detail="At least 1 photo is required")
    
    if total_images > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")
    
    item_update = schemas.MarketItemUpdate(
        title=title,
        description=description,
        price=price,
        condition=condition,
        location=location,
        status=status,
        images=None
    )
    
    try:
        new_images_meta = await process_uploaded_files(valid_new_images) if valid_new_images else []
        updated_item = await crud.update_market_item(
            db, item_id, user.id, item_update,
            new_images_meta=new_images_meta,
            keep_filenames=keep_images_list
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    images_urls = get_image_urls(updated_item.images) if updated_item.images else []
    
    seller_data = schemas.UserShort(
        id=user.id,
        name=user.name,
        username=user.username,
        university=user.university,
        institute=user.institute,
        course=user.course,
        avatar=user.avatar,
        show_profile=user.show_profile,
        show_telegram_id=user.show_telegram_id
    )
    
    is_favorited = await crud.is_item_favorited(db, updated_item.id, user.id)
    
    return normalize_datetime_payload({
        "id": updated_item.id,
        "seller_id": updated_item.seller_id,
        "seller": seller_data,
        "category": updated_item.category,
        "title": updated_item.title,
        "description": updated_item.description,
        "price": updated_item.price,
        "condition": updated_item.condition,
        "location": updated_item.location,
        "images": images_urls,
        "status": updated_item.status,
        "university": updated_item.university,
        "institute": updated_item.institute,
        "views_count": updated_item.views_count,
        "favorites_count": updated_item.favorites_count,
        "created_at": updated_item.created_at,
        "updated_at": updated_item.updated_at,
        "is_seller": True,
        "is_favorited": is_favorited
    })

@app.delete("/market/{item_id}")
async def delete_market_item_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = await crud.delete_market_item(db, item_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"success": True}

@app.post("/market/{item_id}/favorite")
async def toggle_market_favorite_endpoint(
    item_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await crud.toggle_market_favorite(db, item_id, user.id)
    if result.get("is_favorited"):
        await analytics_service.record_server_event(
            db,
            user.id,
            "market_favorite",
            entity_type="market_item",
            entity_id=item_id,
        )
    return result

# ===== DEV ENDPOINTS =====

@app.post("/dev/generate-mock-dating-data")
async def generate_mock_dating_data(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """DEV ONLY: Generate mock dating profiles."""
    if settings.app_env.lower() != "dev":
        raise HTTPException(status_code=404, detail="Not found")

    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Mock users
    mock_users = [
        {
            "telegram_id": 999000001,
            "name": "",
            "age": 19,
            "bio": "Python-,  ",
            "university": user.university,
            "institute": user.institute,
            "course": 2,
            "group": "ПИ-23",
            "interests": ["it","music","games"],
            "show_in_dating": True
        },
        {
            "telegram_id": 999000002,
            "name": "",
            "age": 21,
            "bio": "   .  !",
            "university": user.university,
            "institute": user.institute,
            "course": 3,
            "group": "ДП-31",
            "interests": ["art","travel","coffee"],
            "show_in_dating": True
        },
        {
            "telegram_id": 999000003,
            "name": "",
            "age": 20,
            "bio": " ML  AI",
            "university": user.university,
            "institute": user.institute,
            "course": 2,
            "group": "ИИ-22",
            "interests": ["it","science","books"],
            "show_in_dating": True
        },
        {
            "telegram_id": 999000004,
            "name": "",
            "age": 22,
            "bio": ",   .  !",
            "university": user.university,
            "institute": user.institute,
            "course": 4,
            "group": "ФК-41",
            "interests": ["sport","fitness","travel"],
            "show_in_dating": True
        },
        {
            "telegram_id": 999000005,
            "name": "",
            "age": 19,
            "bio": "    ",
            "university": user.university,
            "institute": user.institute,
            "course": 1,
            "group": "ФЛ-13",
            "interests": ["books","coffee","art"],
            "show_in_dating": True
        }
    ]
    
    created_users = []
    created_profiles = []
    
    for mock_data in mock_users:
        existing = await crud.get_user_by_telegram_id(db, mock_data['telegram_id'])
        if not existing:
            new_user = models.User(**mock_data)
            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)
            created_users.append(new_user)
        else:
            created_users.append(existing)
    
    for mock_user in created_users:
        existing_profile_result = await db.execute(
            select(models.DatingProfile).where(
            models.DatingProfile.user_id == mock_user.id
            )
        )
        existing_profile = existing_profile_result.scalar_one_or_none()
        
        if not existing_profile:
            dating_profile = models.DatingProfile(
                user_id=mock_user.id,
                gender="male" if mock_user.name in ["Алексей", "Дмитрий"] else "female",
                age=mock_user.age,
                looking_for="anyone",
                bio=mock_user.bio,
                goals=["friends","study"],
                photos=[],
                is_active=True
            )
            db.add(dating_profile)
            await db.commit()
            created_profiles.append(mock_user.name)
    
    now = datetime.utcnow()
    matches_created = []
    
    #  1
    user1 = created_users[0]
    match_time_1 = now - timedelta(hours=22)
    user_a_1 = min(user.id, user1.id)
    user_b_1 = max(user.id, user1.id)
    
    existing_match_1_result = await db.execute(
        select(models.Match).where(
        models.Match.user_a_id == user_a_1,
        models.Match.user_b_id == user_b_1
        )
    )
    existing_match_1 = existing_match_1_result.scalar_one_or_none()
    
    if not existing_match_1:
        match1 = models.Match(user_a_id=user_a_1, user_b_id=user_b_1, matched_at=match_time_1)
        db.add(match1)
        matches_created.append(f"{user1.name} (2 дня назад)")
    
    existing_like_1a_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user.id,
        models.DatingLike.whom_liked_id == user1.id
        )
    )
    existing_like_1a = existing_like_1a_result.scalar_one_or_none()
    if not existing_like_1a:
        like1a = models.DatingLike(who_liked_id=user.id, whom_liked_id=user1.id, is_like=True, matched_at=match_time_1)
        db.add(like1a)
    
    existing_like_1b_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user1.id,
        models.DatingLike.whom_liked_id == user.id
        )
    )
    existing_like_1b = existing_like_1b_result.scalar_one_or_none()
    if not existing_like_1b:
        like1b = models.DatingLike(who_liked_id=user1.id, whom_liked_id=user.id, is_like=True, matched_at=match_time_1)
        db.add(like1b)
    
    #  2
    user2 = created_users[1]
    match_time_2 = now - timedelta(hours=18)
    user_a_2 = min(user.id, user2.id)
    user_b_2 = max(user.id, user2.id)
    
    existing_match_2_result = await db.execute(
        select(models.Match).where(
        models.Match.user_a_id == user_a_2,
        models.Match.user_b_id == user_b_2
        )
    )
    existing_match_2 = existing_match_2_result.scalar_one_or_none()
    
    if not existing_match_2:
        match2 = models.Match(user_a_id=user_a_2, user_b_id=user_b_2, matched_at=match_time_2)
        db.add(match2)
        matches_created.append(f"{user2.name} (6 часов назад)")
    
    existing_like_2a_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user.id,
        models.DatingLike.whom_liked_id == user2.id
        )
    )
    existing_like_2a = existing_like_2a_result.scalar_one_or_none()
    if not existing_like_2a:
        like2a = models.DatingLike(who_liked_id=user.id, whom_liked_id=user2.id, is_like=True, matched_at=match_time_2)
        db.add(like2a)
    
    existing_like_2b_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user2.id,
        models.DatingLike.whom_liked_id == user.id
        )
    )
    existing_like_2b = existing_like_2b_result.scalar_one_or_none()
    if not existing_like_2b:
        like2b = models.DatingLike(who_liked_id=user2.id, whom_liked_id=user.id, is_like=True, matched_at=match_time_2)
        db.add(like2b)
    
    #  3
    user3 = created_users[2]
    match_time_3 = now - timedelta(hours=9)
    user_a_3 = min(user.id, user3.id)
    user_b_3 = max(user.id, user3.id)
    
    existing_match_3_result = await db.execute(
        select(models.Match).where(
        models.Match.user_a_id == user_a_3,
        models.Match.user_b_id == user_b_3
        )
    )
    existing_match_3 = existing_match_3_result.scalar_one_or_none()
    
    if not existing_match_3:
        match3 = models.Match(user_a_id=user_a_3, user_b_id=user_b_3, matched_at=match_time_3)
        db.add(match3)
        matches_created.append(f"{user3.name} (15 минут назад)")
    
    existing_like_3a_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user.id,
        models.DatingLike.whom_liked_id == user3.id
        )
    )
    existing_like_3a = existing_like_3a_result.scalar_one_or_none()
    if not existing_like_3a:
        like3a = models.DatingLike(who_liked_id=user.id, whom_liked_id=user3.id, is_like=True, matched_at=match_time_3)
        db.add(like3a)
    
    existing_like_3b_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user3.id,
        models.DatingLike.whom_liked_id == user.id
        )
    )
    existing_like_3b = existing_like_3b_result.scalar_one_or_none()
    if not existing_like_3b:
        like3b = models.DatingLike(who_liked_id=user3.id, whom_liked_id=user.id, is_like=True, matched_at=match_time_3)
        db.add(like3b)
    
    #   ( )
    user4 = created_users[3]
    existing_like_4_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user4.id,
        models.DatingLike.whom_liked_id == user.id
        )
    )
    existing_like_4 = existing_like_4_result.scalar_one_or_none()
    if not existing_like_4:
        like4 = models.DatingLike(who_liked_id=user4.id, whom_liked_id=user.id, is_like=True)
        db.add(like4)
    
    user5 = created_users[4]
    existing_like_5_result = await db.execute(
        select(models.DatingLike).where(
        models.DatingLike.who_liked_id == user5.id,
        models.DatingLike.whom_liked_id == user.id
        )
    )
    existing_like_5 = existing_like_5_result.scalar_one_or_none()
    if not existing_like_5:
        like5 = models.DatingLike(who_liked_id=user5.id, whom_liked_id=user.id, is_like=True)
        db.add(like5)
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"Создано {len(created_profiles)} профилей, {len(matches_created)} матчей",
        "profiles": created_profiles,
        "matches": matches_created,
        "regular_likes": "2   "
    }

