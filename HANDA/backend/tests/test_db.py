import unittest
from unittest.mock import MagicMock, call, patch

import psycopg
from fastapi import HTTPException

from app.db import CONNECT_ATTEMPTS, get_connection


class DatabaseDependencyTests(unittest.TestCase):
    @patch("app.db.time.sleep")
    @patch("app.db.psycopg.connect")
    def test_retries_transient_connection_failure(self, connect, sleep):
        connection = MagicMock()
        connect.side_effect = [psycopg.OperationalError("temporary timeout"), connection]

        dependency = get_connection()
        self.assertIs(next(dependency), connection)
        with self.assertRaises(StopIteration):
            next(dependency)

        self.assertEqual(connect.call_count, 2)
        self.assertEqual(sleep.call_args_list, [call(0.5)])
        connection.__exit__.assert_called_once_with(None, None, None)

    @patch("app.db.time.sleep")
    @patch("app.db.logger.warning")
    @patch("app.db.psycopg.connect", side_effect=psycopg.OperationalError("pooler timeout"))
    def test_returns_service_unavailable_after_retries(self, connect, log_warning, sleep):
        with self.assertRaises(HTTPException) as error:
            next(get_connection())

        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(connect.call_count, CONNECT_ATTEMPTS)
        self.assertEqual(sleep.call_count, CONNECT_ATTEMPTS - 1)
        log_warning.assert_called_once()


if __name__ == "__main__":
    unittest.main()