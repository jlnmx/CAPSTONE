from collections.abc import Generator
import logging
import sys
from threading import Lock

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

from .config import settings

logger = logging.getLogger(__name__)
CONNECT_TIMEOUT_SECONDS = 4
_pool: ConnectionPool | None = None
_pool_lock = Lock()


def open_connection_pool() -> ConnectionPool:
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = ConnectionPool(
                conninfo=settings.database_url,
                min_size=1,
                max_size=settings.db_pool_max_size,
                timeout=CONNECT_TIMEOUT_SECONDS,
                kwargs={"row_factory": dict_row, "connect_timeout": CONNECT_TIMEOUT_SECONDS},
                open=False,
                name="handa-api",
            )
        if _pool.closed:
            _pool.open(wait=False)
        return _pool


def close_connection_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None


def get_connection() -> Generator[psycopg.Connection, None, None]:
    pool = open_connection_pool()
    context = pool.connection(timeout=CONNECT_TIMEOUT_SECONDS)
    try:
        connection = context.__enter__()
    except (PoolTimeout, psycopg.OperationalError) as error:
        logger.warning(
            "Database connection unavailable error_type=%s sqlstate=%s",
            type(error).__name__, getattr(error, "sqlstate", None),
        )
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please retry.") from error

    try:
        yield connection
    except BaseException:
        context.__exit__(*sys.exc_info())
        raise
    else:
        context.__exit__(None, None, None)
