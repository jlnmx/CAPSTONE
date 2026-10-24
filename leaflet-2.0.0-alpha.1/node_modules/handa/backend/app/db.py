from collections.abc import Generator
import logging
import random
import time

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row

from .config import settings

logger = logging.getLogger(__name__)
CONNECT_ATTEMPTS = 2
CONNECT_TIMEOUT_SECONDS = 4
RETRY_BACKOFF_SECONDS = 0.25


def _is_transient_connection_error(error: psycopg.OperationalError) -> bool:
    sqlstate = getattr(error, "sqlstate", None)
    return sqlstate is None or sqlstate.startswith("08")


def get_connection() -> Generator[psycopg.Connection, None, None]:
    connection = None
    for attempt in range(CONNECT_ATTEMPTS):
        started_at = time.monotonic()
        try:
            connection = psycopg.connect(
                settings.database_url,
                row_factory=dict_row,
                connect_timeout=CONNECT_TIMEOUT_SECONDS,
            )
            break
        except psycopg.OperationalError as error:
            elapsed_ms = round((time.monotonic() - started_at) * 1000)
            sqlstate = getattr(error, "sqlstate", None)
            if not _is_transient_connection_error(error):
                logger.error(
                    "Database connection rejected error_type=%s sqlstate=%s elapsed_ms=%d",
                    type(error).__name__, sqlstate, elapsed_ms,
                )
                raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please retry.") from error
            if attempt == CONNECT_ATTEMPTS - 1:
                logger.warning(
                    "Database connection failed attempts=%d error_type=%s sqlstate=%s elapsed_ms=%d",
                    CONNECT_ATTEMPTS, type(error).__name__, sqlstate, elapsed_ms,
                )
                raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please retry.") from error
            backoff = RETRY_BACKOFF_SECONDS * (2 ** attempt)
            delay = random.uniform(backoff, backoff * 2)
            logger.warning(
                "Retrying database connection attempt=%d/%d error_type=%s sqlstate=%s elapsed_ms=%d",
                attempt + 1, CONNECT_ATTEMPTS, type(error).__name__, sqlstate, elapsed_ms,
            )
            time.sleep(delay)

    if connection is None:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please retry.")

    with connection:
        yield connection
