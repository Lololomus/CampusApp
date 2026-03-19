import asyncio
import logging

from app.config import get_settings
from app.crud import market as market_crud
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_market_expiry_loop(stop_event: asyncio.Event) -> None:
    settings = get_settings()
    poll_seconds = max(10, int(settings.market_expiry_poll_seconds))

    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                result = await market_crud.expire_market_entities(db)
                expired_leads = int(result.get("expired_leads", 0))
                expired_deals = int(result.get("expired_deals", 0))
                if expired_leads or expired_deals:
                    logger.info(
                        "Market expiry tick: expired_leads=%s expired_deals=%s",
                        expired_leads,
                        expired_deals,
                    )
        except Exception:
            logger.exception("Market expiry tick failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_seconds)
        except asyncio.TimeoutError:
            continue
