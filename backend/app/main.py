# ===== 📄 ФАЙЛ: backend/app/main.py =====

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI, Depends, HTTPException, Query, Body, File, UploadFile, Form, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Tuple
from app import models, schemas, crud
from app.database import engine, get_db, init_db
from app.utils import (
    UPLOADS_ROOT,
    delete_images,
    get_image_urls,
    normalize_uploads_path,
    parse_keep_file_list,
    process_uploaded_files,
)
from app.video_utils import process_uploaded_video
from app.auth_service import decode_authorization_header, require_user, optional_user
from app.config import get_settings
from app.rate_limiter import check_rate_limit, close_redis
from app.serialization import public_user_short
from app.time_utils import ensure_utc, normalize_datetime_payload
import json
import re
from pydantic import ValidationError
from app.routers import dating, moderation, ads, notifications, auth_router, dev_auth_router, analytics
from app.services import analytics_service, market_expiry_service, notification_service
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


async def _build_poll_response(
    db: AsyncSession,
    poll: Optional[models.Poll],
    user_id: Optional[int] = None,
) -> Optional[dict]:
    if not poll:
        return None

    user_vote = None
    if user_id:
        user_vote_result = await db.execute(
            select(models.PollVote).where(
                models.PollVote.poll_id == poll.id,
                models.PollVote.user_id == user_id,
            )
        )
        user_vote = user_vote_result.scalar_one_or_none()

    user_votes_indices = user_vote.option_indices if user_vote else []
    options_data = poll.options or []
    options_response = []
    for opt in options_data:
        votes = int(opt.get("votes", 0))
        percentage = (votes / poll.total_votes * 100) if poll.total_votes > 0 else 0
        options_response.append({
            "text": opt.get("text", ""),
            "votes": votes,
            "percentage": round(percentage, 1),
        })

    now_utc = ensure_utc(datetime.utcnow())
    closes_at_utc = ensure_utc(poll.closes_at)

    return {
        "id": poll.id,
        "post_id": poll.post_id,
        "question": poll.question,
        "options": options_response,
        "type": poll.type,
        "correct_option": poll.correct_option,
        "explanation": poll.explanation,
        "allow_multiple": poll.allow_multiple,
        "is_anonymous": poll.is_anonymous,
        "closes_at": poll.closes_at,
        "total_votes": poll.total_votes,
        "is_closed": bool(closes_at_utc and now_utc and closes_at_utc <= now_utc),
        "user_votes": user_votes_indices,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup...")
    await init_db()
    logger.info("Database initialized")
    runtime_settings = get_settings()
    stop_event = asyncio.Event()
    nightly_task = None
    market_expiry_task = None
    if runtime_settings.analytics_nightly_enabled:
        nightly_task = asyncio.create_task(analytics_service.run_nightly_rebuild_loop(stop_event))
    if runtime_settings.is_prod and runtime_settings.deal_flow_v2_enabled and runtime_settings.market_expiry_worker_enabled:
        market_expiry_task = asyncio.create_task(market_expiry_service.run_market_expiry_loop(stop_event))
    app.state.analytics_stop_event = stop_event
    app.state.analytics_nightly_task = nightly_task
    app.state.market_expiry_task = market_expiry_task
    yield
    stop_event.set()
    if nightly_task:
        try:
            await asyncio.wait_for(nightly_task, timeout=5)
        except asyncio.TimeoutError:
            nightly_task.cancel()
    if market_expiry_task:
        try:
            await asyncio.wait_for(market_expiry_task, timeout=5)
        except asyncio.TimeoutError:
            market_expiry_task.cancel()
    await engine.dispose()
    await close_redis()
    logger.info("Engines disposed")

settings = get_settings()

app = FastAPI(
    title="Campus App API",
    description="Backend API for campus social app",
    version="2.2.0",
    lifespan=lifespan,
    docs_url=None if settings.is_prod else "/docs",
    redoc_url=None if settings.is_prod else "/redoc",
    openapi_url=None if settings.is_prod else "/openapi.json",
)

# ===== ROUTERS =====

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


PUBLIC_PATHS = ("/", "/health")
public_prefixes = [
    "/uploads",
    "/auth/telegram/login",
    "/auth/refresh",
    "/auth/logout",
    "/notifications/queue",
    "/notifications/followups",
    "/posts/feed",
    "/api/requests/feed",
    "/market/feed",
    "/market/categories",
    "/market/reviews",   # бот + фронт (проверяют bot_secret / telegram_id внутри)
]
if settings.app_env.lower() == "dev" and settings.dev_auth_enabled:
    public_prefixes.append("/dev/auth")
PUBLIC_PREFIXES = tuple(public_prefixes)
PUBLIC_READ_GET_PATTERNS = (
    re.compile(r"^/posts/\d+$"),
    re.compile(r"^/posts/\d+/comments$"),
    re.compile(r"^/api/requests/\d+$"),
    re.compile(r"^/market/\d+$"),
    re.compile(r"^/users/\d+/rating$"),
    re.compile(r"^/users/\d+/public$"),
)


def _is_public_read_get_path(method: str, path: str) -> bool:
    if method.upper() != "GET":
        return False
    return any(pattern.fullmatch(path) for pattern in PUBLIC_READ_GET_PATTERNS)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_prod:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.method.upper() == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    is_public_path = path in PUBLIC_PATHS or any(
        path == prefix or path.startswith(prefix + "/") for prefix in PUBLIC_PREFIXES
    ) or _is_public_read_get_path(request.method, path)

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

    if is_public_path:
        return await call_next(request)

    if payload is None:
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})

    return await call_next(request)

# ===== STATIC FILES =====
os.makedirs(UPLOADS_ROOT / "avatars", exist_ok=True)
os.makedirs(UPLOADS_ROOT / "images", exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_ROOT)), name="uploads")

@app.get("/")
def root():
    return {"message": "Campus App API ✅", "version": "2.2.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# ===== USER ENDPOINTS =====

@app.get("/users/me", response_model=schemas.UserResponse)
async def get_current_user(user: models.User = Depends(require_user)):
    return user

@app.post("/users/me/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "upload_avatar", limit=5, window_sec=60)
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
    except SQLAlchemyError:
        await db.rollback()
        delete_images([avatars_meta[0]], default_kind="avatars")
        raise HTTPException(status_code=500, detail="Failed to save avatar")

    if old_avatar and old_avatar != avatar_url:
        delete_images([old_avatar], default_kind="avatars")

    return {"avatar": user.avatar}

@app.patch("/users/me", response_model=schemas.UserResponse)
async def update_current_user(
    user_update: schemas.UserUpdate = Body(...),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    target_user = await crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    posts = await crud.get_user_posts(db, user_id, limit, offset)
    
    result = []
    for post in posts:
        tags = post.tags or []
        is_liked = await crud.is_post_liked_by_user(db, post.id, user.id) if user else False
        images = get_image_urls(post.images) if post.images else []
        
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
        else:
            author_data = public_user_short(target_user, viewer_id=user.id if user else None)

        poll_response = await _build_poll_response(db, post.poll, user.id if user else None)
        
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
            "is_author": post.author_id == user.id,
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
            "scope": post.scope,
            "target_university": post.target_university,
            "help_expires_at": post.help_expires_at,
            "is_resolved": post.is_resolved,
            "resolved_at": post.resolved_at,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "views_count": post.views_count,
            "is_liked": is_liked,
            "poll": poll_response,
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


@app.get("/users/{user_id}/rating", response_model=schemas.SellerRatingResponse)
async def get_user_rating(user_id: int, db: AsyncSession = Depends(get_db)):
    """Рейтинг продавца (публичный эндпоинт)."""
    return await crud.get_seller_rating(db, user_id)

@app.get("/users/{user_id}/public", response_model=schemas.UserShort)
async def get_user_public_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_id(db, user_id)
    if not user or user.show_profile is not True:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user_short(user)

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
    search: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None),      # 'today' | 'week' | 'month'
    sort: Optional[str] = Query('newest'),        # 'newest' | 'popular' | 'discussed'
    viewer_city: Optional[str] = Query(None),     # Город просматривающего (для scope='city')

    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Posts feed with filtering."""
    await check_rate_limit(request, "feed_posts", limit=60, window_sec=60)
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
    posts_data = await crud.get_posts(
        db,
        skip=skip,
        limit=limit,
        category=category,
        university=university,
        institute=institute,
        campus_id=campus_id,
        city=city,
        tags=tags,
        search=search,
        date_range=date_range,
        sort=sort,
        current_user_id=current_user_id,
        viewer_city=viewer_city,
    )

    result = []
    for post in posts_data["items"]:
        tags = post.tags or []
        is_liked = await crud.is_post_liked_by_user(db, post.id, user.id) if user else False
        images = get_image_urls(post.images) if post.images else []

        author_id_data = post.author_id if post.is_anonymous else post.author_id
        if post.is_anonymous:
            author_data = {"name": "Аноним"}
            author_id_data = None
        else:
            author_data = public_user_short(post.author, viewer_id=user.id if user else None)

        poll_response = await _build_poll_response(db, post.poll, user.id if user else None)

        post_dict = {
            "id": post.id,
            "author_id": author_id_data,
            "author": author_data,
            "is_author": post.author_id == user.id if user else False,
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
            "scope": post.scope,
            "target_university": post.target_university,
            "help_expires_at": post.help_expires_at,
            "is_resolved": post.is_resolved,
            "resolved_at": post.resolved_at,
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
        "total_count": posts_data["total_count"],
        "has_more": posts_data["has_more"],
    })

@app.post("/posts/create", response_model=schemas.PostResponse)
async def create_post_endpoint(
    request: Request,
    category: str = Form(...),
    body: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_anonymous: Optional[bool] = Form(False),
    enable_anonymous_comments: Optional[bool] = Form(False),

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
    scope: Optional[str] = Form('university'),
    target_university: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    video: Optional[UploadFile] = File(None),

    poll_data: Optional[str] = Form(None),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "create_post", limit=10, window_sec=300)
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
    logger.debug(f"\n{'='*60}")
    logger.debug("POST CREATE REQUEST")
    logger.debug(f"{'='*60}")
    logger.debug(f"category: {category!r}")
    logger.debug(f"title(raw): {raw_title!r}")
    logger.debug(f"body(raw): {raw_body!r}")
    logger.debug(f"title(parsed): {title!r}")
    logger.debug(f"body(parsed): {body!r}")
    logger.debug(f"is_anonymous: {is_anonymous}")
    logger.debug(f"images raw list length: {len(images)}")

    # LOG EACH UPLOADED FILE
    for idx, img in enumerate(images):
        logger.debug(f"  Image [{idx}]: filename={img.filename!r}, content_type={img.content_type}")

    logger.debug(f"{'='*60}\n")

    tags_list = _parse_json_list_form_field(tags, "tags")
    
    # FILTER OUT EMPTY FILES (KEY FIX)
    valid_images = [
        img for img in images 
        if img.filename and len(img.filename) > 0
    ]
    
    logger.debug(f"Valid images after filter: {len(valid_images)}")
    
    # Проверяем валидность видео-файла
    valid_video = video if (video and video.filename) else None

    # CONFESSIONS VALIDATION (fixed: moved inside IF block)
    if category == "confessions":
        is_anonymous = True
        enable_anonymous_comments = True
        # Validation is inside the block and uses valid_images
        if len(valid_images) > 0 or valid_video:
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

    normalized_target_university = (target_university or "").strip() or None
    if (scope or 'university') != 'university':
        normalized_target_university = None
    elif normalized_target_university == (user.university or "").strip():
        normalized_target_university = None
    
    try:
        post_data = schemas.PostCreate(
            category=category,
            title=title,
            body=body,
            tags=tags_list,
            is_anonymous=is_anonymous,
            enable_anonymous_comments=bool(enable_anonymous_comments),
            lost_or_found=lost_or_found,
            item_description=item_description,
            location=location,
            reward_type=reward_type,
            reward_value=reward_value,
            event_name=event_name,
            event_date=event_date,
            event_location=event_location,
            event_contact=event_contact,
            is_important=bool(is_important),
            scope=scope or 'university',
            target_university=normalized_target_university,
            images=[]
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())

    try:
        # valid_images instead of images
        images_meta = await process_uploaded_files(valid_images) if valid_images else []
        if valid_video:
            video_meta = await process_uploaded_video(valid_video)
            images_meta.append(video_meta)
        post = await crud.create_post(db, post_data, user.id, images_meta=images_meta)
        
        if poll_data:
            try:
                poll_dict = json.loads(poll_data)
                poll_schema = schemas.PollCreate(**poll_dict)
                await crud.create_poll(db, post.id, poll_schema)
            except (json.JSONDecodeError, ValueError, KeyError, ValidationError) as e:
                logger.debug(f"Ошибка создания опроса: {e}")
    
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
    
    return await get_post_endpoint(post.id, user=user, db=db)

@app.get("/posts/{post_id}", response_model=schemas.PostResponse)
async def get_post_endpoint(
    post_id: int,
    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db),
):
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
        author_data = public_user_short(post.author, viewer_id=user.id if user else None)

    poll_response = await _build_poll_response(db, post.poll, user.id if user else None)

    return normalize_datetime_payload({
        "id": post.id,
        "author_id": author_id_data,
        "author": author_data,
        "is_author": post.author_id == user.id if user else False,
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
        "scope": post.scope,
        "target_university": post.target_university,
        "help_expires_at": post.help_expires_at,
        "is_resolved": post.is_resolved,
        "resolved_at": post.resolved_at,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "views_count": post.views_count,
        "is_liked": is_liked,
        "poll": poll_response,
        "created_at": post.created_at,
        "updated_at": post.updated_at
    })

@app.patch("/posts/{post_id}/resolve", response_model=schemas.PostResponse)
async def resolve_post_endpoint(
    post_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Отметить help-пост как решённый. Только автор."""
    post = await crud.resolve_post(db, post_id, user.id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found or not your post")
    images = get_image_urls(post.images) if post.images else []
    is_liked = await crud.is_post_liked_by_user(db, post.id, user.id)
    poll_response = await _build_poll_response(db, post.poll, user.id)
    return normalize_datetime_payload({
        "id": post.id,
        "author_id": post.author_id,
        "author": public_user_short(post.author, viewer_id=user.id),
        "is_author": True,
        "category": post.category,
        "title": post.title,
        "body": post.body,
        "tags": post.tags or [],
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
        "scope": post.scope,
        "target_university": post.target_university,
        "help_expires_at": post.help_expires_at,
        "is_resolved": post.is_resolved,
        "resolved_at": post.resolved_at,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "views_count": post.views_count,
        "is_liked": is_liked,
        "poll": poll_response,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    })


@app.delete("/posts/{post_id}")
async def delete_post_endpoint(post_id: int, user: models.User = Depends(require_user), db: AsyncSession = Depends(get_db)):
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
    new_video: Optional[UploadFile] = File(None),
    keep_video: Optional[bool] = Form(True),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
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
    valid_new_video = new_video if (new_video and new_video.filename) else None

    total_images = len(keep_images_list) + len(valid_new_images)
    if total_images > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")

    if post.category == "confessions" and (valid_new_images or keep_images_list or valid_new_video):
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

        # Если загружено новое видео — добавляем его; старое удалится в merge_images
        if valid_new_video:
            video_meta = await process_uploaded_video(valid_new_video)
            new_images_meta.append(video_meta)

        # keep_video=False + нет нового видео → merge_images удалит старое само
        updated_post = await crud.update_post(
            db, post_id, post_update,
            new_images_meta=new_images_meta,
            keep_filenames=keep_images_list,
            keep_video=keep_video if not valid_new_video else False,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return await get_post_endpoint(updated_post.id, user=user, db=db)

@app.post("/posts/{post_id}/like")
async def toggle_post_like_endpoint(
    post_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await crud.vote_poll(db, poll_id, user.id, vote_data.option_indices)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== COMMENT ENDPOINTS =====

@app.get("/posts/{post_id}/comments", response_model=schemas.CommentsFeedResponse)
async def get_post_comments_endpoint(
    post_id: int,
    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
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
                short = public_user_short(
                    comment.author,
                    viewer_id=user.id if user else None,
                )
                author_data = short.model_dump() if short else None

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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "create_comment", limit=30, window_sec=60)
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
        author_data = public_user_short(user, viewer_id=user.id)

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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.delete_comment(db, comment_id, user.id)

@app.patch("/comments/{comment_id}", response_model=schemas.CommentResponse)
async def update_comment_endpoint(
    comment_id: int,
    comment_update: schemas.CommentUpdate = Body(...),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
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
        author_data = public_user_short(comment.author, viewer_id=user.id)

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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.toggle_comment_like(db, comment_id, user.id)

# ===== REQUEST ENDPOINTS =====

@app.post("/api/requests/create", response_model=schemas.RequestResponse)
async def create_request_endpoint(
    request: Request,
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

    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "create_request", limit=10, window_sec=300)
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

    author_data = public_user_short(user, viewer_id=user.id)

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

    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Requests feed with filtering."""
    await check_rate_limit(request, "feed_requests", limit=60, window_sec=60)
    current_user_id = user.id if user else None

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
        author_data = public_user_short(
            req_dict['author'],
            viewer_id=user.id if user else None,
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
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Get my requests."""
    requests = await crud.get_my_requests(db, user.id, limit=limit, offset=offset)
    
    result = []
    for req in requests:
        tags = req.tags or []
        images = get_image_urls(req.images) if req.images else []
        
        author_data = public_user_short(user, viewer_id=user.id)

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
    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
    current_user_id = user.id if user else None

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
    
    author_data = public_user_short(
        request_dict['author'],
        viewer_id=user.id if user else None,
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
    data: schemas.RequestUpdate = Body(...),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        request = await crud.update_request(db, request_id, user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    images_urls = get_image_urls(request.images) if request.images else []

    author_data = public_user_short(user, viewer_id=user.id)

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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        await crud.delete_request(db, request_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/api/requests/{request_id}/respond", response_model=schemas.ResponseItem)
async def create_response_endpoint(
    request_id: int,
    request: Request,
    data: schemas.ResponseCreate = Body(...),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "create_response", limit=20, window_sec=60)
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
    
    author_data = public_user_short(user, viewer_id=user.id)

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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        responses = await crud.get_request_responses(db, request_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    result = []
    for resp in responses:
        author_data = public_user_short(resp.author, viewer_id=user.id)
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
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        await crud.delete_response(db, response_id, user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

# ===== CAMPUS MANAGEMENT ENDPOINTS =====

@app.get("/admin/campuses/unbound-users")
async def get_unbound_users_endpoint(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """List users without campus binding (for ambassadors/admins)."""
    # Access check
    if user.role not in ('ambassador', 'admin', 'superadmin'):
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
    user_id: int = Body(...),
    campus_id: str = Body(...),
    university: str = Body(...),
    city: Optional[str] = Body(None),
    admin: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """   ."""
    if admin.role not in ('ambassador', 'admin', 'superadmin'):
        raise HTTPException(status_code=403, detail="Нет доступа")

    # Амбассадор может привязывать только к своему кампусу
    if admin.role == 'ambassador' and admin.campus_id != campus_id:
        raise HTTPException(status_code=403, detail="Амбассадор может привязывать только к своему кампусу")

    user = await crud.bind_user_to_campus(db, user_id, campus_id, university, city)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return {"ok": True, "user_id": user.id, "campus_id": user.campus_id}


@app.post("/admin/campuses/unbind-user")
async def unbind_user_from_campus_endpoint(
    user_id: int = Body(..., embed=True),
    admin: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """   ."""
    if admin.role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail="Только для админов")

    user = await crud.unbind_user_from_campus(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return {"ok": True, "user_id": user.id}


# ===== MARKET ENDPOINTS =====

@app.get("/market/categories", response_model=schemas.MarketCategoriesResponse)
async def get_market_categories_endpoint(
    item_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_market_categories(db, item_type=item_type)

@app.get("/market/feed", response_model=schemas.MarketFeedResponse)
async def get_market_feed_endpoint(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    sort: Optional[str] = Query("newest"),
    search: Optional[str] = Query(None),
    price_min: Optional[int] = Query(None),
    price_max: Optional[int] = Query(None),
    condition: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    institute: Optional[str] = Query(None),
    campus_id: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "feed_market", limit=60, window_sec=60)
    current_user_id = user.id if user else None

    feed_data = await crud.get_market_items(
        db,
        skip=skip,
        limit=limit,
        category=category,
        item_type=item_type,
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

        seller_data = public_user_short(
            item.seller,
            viewer_id=user.id if user else None,
        )

        is_seller = bool(user and item.seller_id == user.id)
        is_favorited = await crud.is_item_favorited(db, item.id, user.id) if user else False
        has_requested = await crud.has_active_market_interest(db, item.id, user.id) if user and not is_seller else False
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "item_type": item.item_type,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "capacity": item.capacity,
            "pause_reason": item.pause_reason,
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
            "is_favorited": is_favorited,
            "has_requested": has_requested
        }
        items.append(item_dict)
    
    return normalize_datetime_payload({
        "items": items,
        "total": feed_data['total'],
        "has_more": feed_data['has_more']
    })

@app.get("/market/favorites", response_model=List[schemas.MarketItemResponse])
async def get_market_favorites_endpoint(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    items = await crud.get_user_favorites(db, user.id, limit, offset)
    
    result = []
    for item in items:
        images = get_image_urls(item.images) if item.images else []

        seller_data = public_user_short(item.seller, viewer_id=user.id)

        is_seller = item.seller_id == user.id
        has_requested = await crud.has_active_market_interest(db, item.id, user.id) if not is_seller else False
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "item_type": item.item_type,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "capacity": item.capacity,
            "pause_reason": item.pause_reason,
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
            "is_favorited": True,
            "has_requested": has_requested
        }
        result.append(item_dict)

    return normalize_datetime_payload(result)

@app.get("/market/my-items", response_model=List[schemas.MarketItemResponse])
async def get_my_market_items_endpoint(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Get my market items (items I am selling)."""
    items = await crud.get_user_market_items(db, user.id, limit, offset)
    
    result = []
    for item in items:
        images = get_image_urls(item.images) if item.images else []
        
        seller_data = public_user_short(user, viewer_id=user.id)
        is_favorited = await crud.is_item_favorited(db, item.id, user.id)
        
        item_dict = {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller": seller_data,
            "category": item.category,
            "item_type": item.item_type,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "condition": item.condition,
            "capacity": item.capacity,
            "pause_reason": item.pause_reason,
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
            "is_favorited": is_favorited,
            "has_requested": False
        }
        result.append(item_dict)

    return result

@app.get("/market/{item_id}", response_model=schemas.MarketItemResponse)
async def get_market_item_endpoint(
    item_id: int,
    user: Optional[models.User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
    item = await crud.get_market_item(db, item_id, user.id if user else None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.status == 'archived':
        can_view_archived = bool(
            user and (
                user.id == item.seller_id or
                user.role in ('ambassador', 'admin', 'superadmin')
            )
        )
        if not can_view_archived:
            raise HTTPException(status_code=404, detail="Item not found")
    if item.status == 'paused' and item.pause_reason == 'manual':
        can_view_hidden = bool(
            user and (
                user.id == item.seller_id or
                user.role in ('ambassador', 'admin', 'superadmin')
            )
        )
        if not can_view_hidden:
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

    seller_data = public_user_short(
        item.seller,
        viewer_id=user.id if user else None,
    )

    is_favorited = await crud.is_item_favorited(db, item.id, user.id) if user else False
    is_seller = bool(user and item.seller_id == user.id)
    has_requested = await crud.has_active_market_interest(db, item.id, user.id) if user and not is_seller else False
    
    return normalize_datetime_payload({
        "id": item.id,
        "seller_id": item.seller_id,
        "seller": seller_data,
        "category": item.category,
        "item_type": item.item_type,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "condition": item.condition,
        "capacity": item.capacity,
        "pause_reason": item.pause_reason,
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
        "is_favorited": is_favorited,
        "has_requested": has_requested
    })


@app.post("/market/{item_id}/contact")
async def contact_market_seller_endpoint(
    item_id: int,
    request: Request,
    buyer: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "market_contact", limit=20, window_sec=60)
    item = await db.get(models.MarketItem, item_id)
    if not item or item.is_deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.seller_id == buyer.id:
        raise HTTPException(status_code=400, detail="Cannot contact your own item")

    if settings.deal_flow_v2_enabled:
        try:
            lead, is_waitlist, is_new_interest = await crud.create_market_interest(db, item_id, buyer.id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        seller = await db.get(models.User, item.seller_id)
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found")

        if item.item_type == "service" or is_new_interest:
            await notification_service.notify_market_contact(
                db,
                seller,
                buyer,
                item,
                is_waitlist=is_waitlist,
                related_type="market_lead",
                related_id=lead.id,
                create_sold_followup=False,
            )
            await db.commit()
    else:
        if item.status != 'active':
            raise HTTPException(status_code=404, detail="Item not found")

        seller = await db.get(models.User, item.seller_id)
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found")

        await notification_service.notify_market_contact(db, seller, buyer, item)
        await db.commit()

    await analytics_service.record_server_event(
        db,
        buyer.id,
        "market_contact",
        entity_type="market_item",
        entity_id=item_id,
    )
    return {"ok": True}


@app.post("/market/{item_id}/interest", response_model=schemas.MarketInterestResponse)
async def create_market_interest_endpoint(
    item_id: int,
    request: Request,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "market_interest", limit=20, window_sec=60)
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")

    try:
        lead, is_waitlist, is_new_interest = await crud.create_market_interest(db, item_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    item = await db.get(models.MarketItem, item_id)
    seller = await db.get(models.User, item.seller_id) if item else None
    if item and seller and (item.item_type == "service" or is_new_interest):
        await notification_service.notify_market_contact(
            db,
            seller,
            user,
            item,
            is_waitlist=is_waitlist,
            related_type="market_lead",
            related_id=lead.id,
            create_sold_followup=False,
        )
        await db.commit()

    return normalize_datetime_payload({
        "id": lead.id,
        "item_id": lead.item_id,
        "buyer": public_user_short(user, viewer_id=user.id),
        "status": lead.status,
        "is_waitlist": is_waitlist,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
    })


@app.delete("/market/{item_id}/interest")
async def cancel_market_interest_endpoint(
    item_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")

    removed = await crud.cancel_market_interest(db, item_id, user.id)
    if not removed:
        raise HTTPException(status_code=404, detail="Interest not found")
    return {"ok": True}


@app.get("/market/{item_id}/waitlist", response_model=List[schemas.MarketInterestResponse])
async def get_market_waitlist_endpoint(
    item_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")

    try:
        leads = await crud.get_market_waitlist(db, item_id, user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    payload = []
    for lead in leads:
        payload.append({
            "id": lead.id,
            "item_id": lead.item_id,
            "buyer": public_user_short(lead.buyer, viewer_id=user.id),
            "status": lead.status,
            "is_waitlist": True,
            "created_at": lead.created_at,
            "updated_at": lead.updated_at,
        })
    return normalize_datetime_payload(payload)


@app.post("/market/{item_id}/deals/select-buyer", response_model=schemas.MarketDealResponse)
async def select_market_buyer_endpoint(
    item_id: int,
    data: schemas.MarketSelectBuyerRequest,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")

    try:
        deal = await crud.select_market_buyer(db, item_id, user.id, data.buyer_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.post("/market/deals/{deal_id}/start", response_model=schemas.MarketDealResponse)
async def start_market_deal_endpoint(
    deal_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    try:
        deal = await crud.start_market_deal(db, deal_id, user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.post("/market/deals/{deal_id}/provider-confirm", response_model=schemas.MarketDealResponse)
async def provider_confirm_market_deal_endpoint(
    deal_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    try:
        deal = await crud.provider_confirm_market_deal(db, deal_id, user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.post("/market/deals/{deal_id}/customer-confirm", response_model=schemas.MarketDealResponse)
async def customer_confirm_market_deal_endpoint(
    deal_id: int,
    data: schemas.MarketCustomerConfirmRequest,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    try:
        deal = await crud.customer_confirm_market_deal(db, deal_id, user.id, data.outcome)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.post("/market/deals/{deal_id}/reassign", response_model=schemas.MarketDealResponse)
async def reassign_market_deal_endpoint(
    deal_id: int,
    data: schemas.MarketReassignDealRequest,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    try:
        deal = await crud.reassign_market_deal(db, deal_id, user.id, data.buyer_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.post("/market/deals/{deal_id}/cancel", response_model=schemas.MarketDealResponse)
async def cancel_market_deal_endpoint(
    deal_id: int,
    data: schemas.MarketCancelDealRequest,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    try:
        deal = await crud.cancel_market_deal(db, deal_id, user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.post("/market/deals/{deal_id}/resolve-dispute", response_model=schemas.MarketDealResponse)
async def resolve_market_dispute_endpoint(
    deal_id: int,
    data: schemas.MarketResolveDisputeRequest,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    if user.role not in ("ambassador", "admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Moderator role required")
    try:
        deal = await crud.resolve_market_dispute(db, deal_id, user.id, data.resolution, data.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    deal = await crud.get_market_deal(db, deal.id, user.id, user.role)
    return normalize_datetime_payload(_serialize_market_deal(deal))


@app.get("/market/deals/{deal_id}", response_model=schemas.MarketDealResponse)
async def get_market_deal_endpoint(
    deal_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.deal_flow_v2_enabled:
        raise HTTPException(status_code=404, detail="Deal flow v2 is disabled")
    try:
        deal = await crud.get_market_deal(db, deal_id, user.id, user.role)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return normalize_datetime_payload(_serialize_market_deal(deal))

@app.post("/market/items", response_model=schemas.MarketItemResponse)
async def create_market_item_endpoint(
    request: Request,
    category: str = Form(...),
    item_type: str = Form('product'),
    title: str = Form(...),
    description: str = Form(...),
    price: int = Form(...),
    condition: Optional[str] = Form(None),
    capacity: Optional[int] = Form(3),
    location: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    video: Optional[UploadFile] = File(None),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    await check_rate_limit(request, "create_market_item", limit=5, window_sec=300)

    valid_images = [img for img in images if img.filename and len(img.filename) > 0]
    valid_video = video if (video and video.filename) else None

    if len(valid_images) < 1 and not valid_video:
        raise HTTPException(status_code=400, detail="At least 1 photo or video is required")

    if len(valid_images) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")

    item_data = schemas.MarketItemCreate(
        category=category,
        item_type=item_type if item_type in ('product', 'service') else 'product',
        title=title,
        description=description,
        price=price,
        condition=condition,
        capacity=capacity,
        location=location,
        images=["placeholder"]
    )

    try:
        images_meta = await process_uploaded_files(valid_images) if valid_images else []
        if valid_video:
            video_meta = await process_uploaded_video(valid_video)
            images_meta.append(video_meta)
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
    
    seller_data = public_user_short(user, viewer_id=user.id)

    return normalize_datetime_payload({
        "id": item.id,
        "seller_id": item.seller_id,
        "seller": seller_data,
        "category": item.category,
        "item_type": item.item_type,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "condition": item.condition,
        "capacity": item.capacity,
        "pause_reason": item.pause_reason,
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
        "is_favorited": False,
        "has_requested": False
    })

@app.patch("/market/{item_id}", response_model=schemas.MarketItemResponse)
async def update_market_item_endpoint(
    item_id: int,
    item_type: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[int] = Form(None),
    condition: Optional[str] = Form(None),
    capacity: Optional[int] = Form(None),
    pause_reason: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    new_images: List[UploadFile] = File(default=[]),
    keep_images: Optional[str] = Form(None),
    new_video: Optional[UploadFile] = File(None),
    keep_video: Optional[bool] = Form(True),
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):

    try:
        keep_images_list = parse_keep_file_list(keep_images, kind="images")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    valid_new_images = [img for img in new_images if img.filename and len(img.filename) > 0]
    valid_new_video = new_video if (new_video and new_video.filename) else None

    total_images = len(keep_images_list) + len(valid_new_images)
    if total_images > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images")

    item_update = schemas.MarketItemUpdate(
        item_type=item_type if item_type in ('product', 'service') else None,
        title=title,
        description=description,
        price=price,
        condition=condition,
        capacity=capacity,
        pause_reason=pause_reason if pause_reason in ('manual', 'capacity') else None,
        location=location,
        status=status,
        images=None
    )

    try:
        new_images_meta = await process_uploaded_files(valid_new_images) if valid_new_images else []
        if valid_new_video:
            video_meta = await process_uploaded_video(valid_new_video)
            new_images_meta.append(video_meta)
        updated_item = await crud.update_market_item(
            db, item_id, user.id, item_update,
            new_images_meta=new_images_meta,
            keep_filenames=keep_images_list,
            keep_video=keep_video if not valid_new_video else False,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    images_urls = get_image_urls(updated_item.images) if updated_item.images else []
    
    seller_data = public_user_short(user, viewer_id=user.id)

    is_favorited = await crud.is_item_favorited(db, updated_item.id, user.id)
    
    return normalize_datetime_payload({
        "id": updated_item.id,
        "seller_id": updated_item.seller_id,
        "seller": seller_data,
        "category": updated_item.category,
        "item_type": updated_item.item_type,
        "title": updated_item.title,
        "description": updated_item.description,
        "price": updated_item.price,
        "condition": updated_item.condition,
        "capacity": updated_item.capacity,
        "pause_reason": updated_item.pause_reason,
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
        "is_favorited": is_favorited,
        "has_requested": False
    })

@app.delete("/market/{item_id}")
async def delete_market_item_endpoint(
    item_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    success = await crud.delete_market_item(db, item_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"success": True}

@app.post("/market/{item_id}/favorite")
async def toggle_market_favorite_endpoint(
    item_id: int,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
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


def _verify_bot_secret(x_bot_secret: str = Header(..., alias="X-Bot-Secret")):
    if x_bot_secret != settings.bot_secret:
        raise HTTPException(status_code=403, detail="Invalid bot secret")


async def _resolve_review_user(
    request: Request,
    db: AsyncSession,
    telegram_id: Optional[int],
    x_bot_secret: Optional[str],
) -> models.User:
    """JWT user (front) or bot-auth user (X-Bot-Secret + telegram_id)."""
    if x_bot_secret is not None:
        if x_bot_secret != settings.bot_secret:
            raise HTTPException(status_code=403, detail="Invalid bot secret")
        if telegram_id is None:
            raise HTTPException(status_code=400, detail="telegram_id is required for bot requests")
        user = await crud.get_user_by_telegram_id(db, telegram_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    return await require_user(request, db)


def _serialize_market_deal(deal: models.MarketDeal) -> dict:
    events = []
    for ev in sorted((deal.events or []), key=lambda e: e.created_at or datetime.min):
        events.append({
            "id": ev.id,
            "event_type": ev.event_type,
            "from_status": ev.from_status,
            "to_status": ev.to_status,
            "actor_id": ev.actor_id,
            "payload": ev.payload,
            "created_at": ev.created_at,
        })

    return {
        "id": deal.id,
        "item_id": deal.item_id,
        "seller_id": deal.seller_id,
        "buyer_id": deal.buyer_id,
        "status": deal.status,
        "customer_result": deal.customer_result,
        "selected_at": deal.selected_at,
        "started_at": deal.started_at,
        "provider_confirmed_at": deal.provider_confirmed_at,
        "customer_confirmed_at": deal.customer_confirmed_at,
        "completed_at": deal.completed_at,
        "disputed_at": deal.disputed_at,
        "cancelled_at": deal.cancelled_at,
        "expires_at": deal.expires_at,
        "created_at": deal.created_at,
        "updated_at": deal.updated_at,
        "events": events,
    }


@app.post("/market/reviews", response_model=schemas.MarketReviewResponse)
async def create_market_review(
    data: schemas.MarketReviewCreate,
    request: Request,
    telegram_id: Optional[int] = Query(None),
    x_bot_secret: Optional[str] = Header(None, alias="X-Bot-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Создать отзыв (front через JWT или bot через X-Bot-Secret)."""
    user = await _resolve_review_user(request, db, telegram_id, x_bot_secret)
    if settings.deal_flow_v2_enabled and not data.deal_id:
        raise HTTPException(status_code=400, detail="deal_id is required")

    source = 'bot' if x_bot_secret is not None else 'app'
    status = 'pending_text' if source == 'bot' else 'completed'
    try:
        review = await crud.create_review(db, user.id, data, source=source, status=status)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        if 'unique_review_per_item' in str(e) or 'unique_review_per_deal' in str(e):
            raise HTTPException(status_code=409, detail="Отзыв уже оставлен")
        raise HTTPException(status_code=500, detail="Ошибка сервера")
    return review


@app.get("/market/reviews/pending")
async def get_pending_review(
    telegram_id: int = Query(...),
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Pending_text отзыв для бота (проверка перед обработкой текста)."""
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        return None
    review = await crud.get_pending_review(db, user.id)
    if not review:
        return None
    return {"review_id": review.id}


@app.patch("/market/reviews/{review_id}/text")
async def add_review_text(
    review_id: int,
    telegram_id: int = Query(...),
    text: Optional[str] = Body(None, embed=True),
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Добавить текст к отзыву (или завершить без текста)."""
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    review = await crud.add_review_text(db, review_id, user.id, text)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"ok": True}


@app.post("/market/reviews/skip")
async def skip_review_request(
    telegram_id: int = Query(...),
    item_id: Optional[int] = Query(None),
    deal_id: Optional[int] = Query(None),
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Пропустить запрос отзыва (бот)."""
    if not item_id and not deal_id:
        raise HTTPException(status_code=400, detail="item_id or deal_id is required")
    user = await crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await crud.skip_review_request(db, user.id, item_id=item_id, deal_id=deal_id)
    return {"ok": True}


@app.get("/market/{item_id}/reviews", response_model=List[schemas.MarketReviewResponse])
async def get_item_reviews(
    item_id: int,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Список отзывов на товар."""
    return await crud.get_item_reviews(db, item_id, limit=limit, offset=offset)

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
        "message": f"Создано {len(created_profiles)} профилей, {len(matches_created)} мэтчей",
        "profiles": created_profiles,
        "matches": matches_created,
        "regular_likes": "2   "
    }

