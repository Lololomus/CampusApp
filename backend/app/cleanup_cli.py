import argparse
import asyncio
import json
import logging
import os
import sys

from app.cleanup import run_cleanup
from app.database import AsyncSessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("cleanup_cli")


def format_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    if n < 1024 * 1024 * 1024:
        return f"{n / 1024 / 1024:.1f} MB"
    return f"{n / 1024 / 1024 / 1024:.1f} GB"


async def main():
    parser = argparse.ArgumentParser(description="CampusApp orphaned files cleanup")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Only scan, do not delete (default)",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Actually delete orphaned files",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of human-readable text",
    )
    parser.add_argument(
        "--min-age-hours",
        type=int,
        default=int(os.getenv("CLEANUP_MIN_AGE_HOURS", "24")),
        help="Only consider orphaned files older than this many hours (default: 24)",
    )
    args = parser.parse_args()

    dry_run = not args.confirm

    async with AsyncSessionLocal() as db:
        stats = await run_cleanup(
            db,
            dry_run=dry_run,
            min_age_hours=max(0, args.min_age_hours),
        )

    if args.json:
        print(json.dumps(stats, ensure_ascii=False, indent=2))
        sys.exit(0)

    print("=" * 50)
    print("CampusApp Cleanup Report")
    print("=" * 50)
    print(f"Mode:          {'DRY RUN' if dry_run else 'LIVE DELETE'}")
    print(f"Min age:       {stats['min_age_hours']}h")
    print(f"Upload refs:   {stats['upload_referenced']}")
    print(f"Upload orphans:{stats['upload_orphaned']}")
    if not dry_run:
        print(f"  deleted:     {stats['upload_deleted']}")
        print(f"  freed:       {format_bytes(stats['upload_bytes_freed'])}")
    print(f"Document refs: {stats['document_referenced']}")
    print(f"Document orphans:{stats['document_orphaned']}")
    if not dry_run:
        print(f"  deleted:     {stats['document_deleted']}")
        print(f"  freed:       {format_bytes(stats['document_bytes_freed'])}")
    if stats["errors"]:
        print(f"Errors:        {len(stats['errors'])}")
        for err in stats["errors"][:10]:
            print(f"  - {err}")
    print("=" * 50)

    if stats["errors"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
