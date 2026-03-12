# ===== 📄 ФАЙЛ: backend/app/rate_limiter.py =====
# Async rate limiter на Redis (sliding window)
#
# ✅ Фаза 4.2: Заменяет in-memory _rate_buckets из auth_router.py

import time
from typing import Optional

import redis.asyncio as redis
from fastapi import HTTPException, Request

from app.config import get_settings

_redis_pool: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Получить (или создать) пул подключений к Redis."""
    global _redis_pool
    if _redis_pool is None:
        settings = get_settings()
        _redis_pool = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_pool


async def close_redis() -> None:
    """Закрыть пул подключений (вызывать в lifespan shutdown)."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None


async def check_rate_limit(
    request: Request,
    key: str,
    limit: int = 20,
    window_sec: int = 60,
) -> None:
    """
    Sliding window rate limiter.

    Использует sorted set в Redis:
      - score = timestamp запроса
      - member = уникальный id запроса (timestamp:random)
      - при каждом запросе удаляем записи старше window_sec
      - если количество записей >= limit → 429

    Args:
        request: FastAPI Request (для извлечения IP)
        key: логический ключ ("auth_login", "auth_refresh", ...)
        limit: максимум запросов в окне
        window_sec: размер окна в секундах
    """
    # X-Real-IP или первый адрес из X-Forwarded-For (за nginx/caddy)
    # Если за прокси — всегда request.client.host == 127.0.0.1, rate limit бесполезен
    forwarded_for = request.headers.get("X-Forwarded-For")
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        ip = real_ip.strip()
    elif forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    bucket_key = f"rate:{key}:{ip}"

    r = await get_redis()
    now = time.time()
    window_start = now - window_sec

    pipe = r.pipeline(transaction=True)
    pipe.zremrangebyscore(bucket_key, 0, window_start)
    pipe.zcard(bucket_key)
    pipe.zadd(bucket_key, {f"{now}": now})
    pipe.expire(bucket_key, window_sec + 1)
    results = await pipe.execute()

    current_count = results[1]  # zcard result

    if current_count >= limit:
        raise HTTPException(status_code=429, detail="Too many requests")