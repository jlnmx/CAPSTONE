from collections.abc import Generator
import logging
import time

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row

from .config import settings

logger = logging.getLogger(__name__)
CONNECT_ATTEMPTS = 3
CONNECT_TIMEOUT_SECONDS = 5


def get_connection() -> Generator[psycopg.Connection, None, None]:
    connection = None
    for attempt in range(CONNECT_ATTEMPTS):
        try:
            connection = psycopg.connect(
                settings.database_url,
                row_factory=dict_row,
                connect_timeout=CONNECT_TIMEOUT_SECONDS,
            )
            break
        except psycopg.OperationalError as error:
            if attempt == CONNECT_ATTEMPTS - 1:
                logger.warning("Database connection failed after %d attempts: %s", CONNECT_ATTEMPTS, error)
                raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please retry.") from error
            time.sleep(0.5 * (attempt + 1))

    if connection is None:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please retry.")

    with connection:
        yield connection
