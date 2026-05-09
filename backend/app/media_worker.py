import asyncio
import logging
import os

from app.database import AsyncSessionLocal
from app.media_processing import run_worker_loop


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def main() -> None:
    poll_seconds = float(os.getenv("MEDIA_WORKER_POLL_SECONDS", "2"))
    asyncio.run(run_worker_loop(AsyncSessionLocal, poll_seconds=poll_seconds))


if __name__ == "__main__":
    main()
