import json
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from jwt.algorithms import ECAlgorithm

from app.auth import CurrentUser
from app.main import issue_realtime_token
from app.realtime import RealtimeNotConfigured, create_realtime_token

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "migrations" / "20261106_realtime_broadcast.sql"


def make_jwk() -> tuple[str, object]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    jwk = ECAlgorithm.to_jwk(private_key, as_dict=True)
    jwk["kid"] = "test-kid"
    return json.dumps(jwk), private_key.public_key()


class RealtimeTokenTests(unittest.TestCase):
    def test_token_has_supabase_and_app_claims_and_signed_header(self):
        raw_jwk, public_key = make_jwk()
        with patch("app.realtime.settings.realtime_jwt_private_key", raw_jwk):
            token, expires_in = create_realtime_token("user-1", "responder")

        self.assertEqual(jwt.get_unverified_header(token)["kid"], "test-kid")
        claims = jwt.decode(token, public_key, algorithms=["ES256"], audience="authenticated")
        self.assertEqual(claims["sub"], "user-1")
        self.assertEqual(claims["role"], "authenticated")
        self.assertEqual(claims["app_role"], "responder")
        self.assertEqual(claims["exp"] - claims["iat"], expires_in)
        self.assertLessEqual(claims["exp"], int(time.time()) + expires_in)
        self.assertEqual(set(claims), {"aud", "role", "sub", "app_role", "iat", "exp"})

    def test_missing_invalid_or_public_key_is_rejected(self):
        raw_jwk, _ = make_jwk()
        public_only = {key: value for key, value in json.loads(raw_jwk).items() if key != "d"}
        for value in ("", "not json", json.dumps(public_only)):
            with self.subTest(value=value[:10]), patch("app.realtime.settings.realtime_jwt_private_key", value):
                with self.assertRaises(RealtimeNotConfigured):
                    create_realtime_token("user-1", "resident")

    def test_endpoint_issues_token_for_current_user_only(self):
        raw_jwk, public_key = make_jwk()
        user = CurrentUser("resident-1", "r@example.com", "Resident", "resident", 1)
        with patch("app.realtime.settings.realtime_jwt_private_key", raw_jwk):
            body = issue_realtime_token(user)
        claims = jwt.decode(body["token"], public_key, algorithms=["ES256"], audience="authenticated")
        self.assertEqual((claims["sub"], claims["app_role"]), ("resident-1", "resident"))

    def test_endpoint_returns_503_when_not_configured(self):
        user = CurrentUser("resident-1", "r@example.com", "Resident", "resident", 1)
        with patch("app.realtime.settings.realtime_jwt_private_key", ""):
            with self.assertRaises(HTTPException) as raised:
                issue_realtime_token(user)
        self.assertEqual(raised.exception.status_code, 503)


class RealtimeMigrationTests(unittest.TestCase):
    sql = MIGRATION.read_text(encoding="utf-8")

    def test_policies_are_scoped_and_never_open(self):
        lowered = self.sql.lower()
        self.assertNotIn("using (true)", lowered)
        self.assertNotIn("with check (true)", lowered)
        self.assertNotIn("to public", lowered)
        self.assertIn("'user:' || (select auth.jwt() ->> 'sub') || ':notifications'", lowered.replace("select", "select"))

    def test_responder_location_is_not_readable_by_residents_or_writable_by_admins(self):
        receive = self.sql.split('CREATE POLICY "handa_responders_live_receive"')[1].split("CREATE POLICY")[0]
        send = self.sql.split('CREATE POLICY "handa_responders_live_send"')[1]
        self.assertIn("IN ('responder', 'admin')", receive)
        self.assertNotIn("resident", receive)
        self.assertIn("= 'responder'", send)
        self.assertNotIn("admin", send)

    def test_payloads_exclude_sensitive_columns(self):
        for column in ("description", "photo_uris", "reporter_user_id", "password", "coordinator_name", "contact_number", "action_notes", "user_id,"):
            self.assertNotIn(f"source.{column}", self.sql)
        self.assertIn("'user:' || NEW.user_id", self.sql)
        self.assertNotIn("'user_id', NEW.user_id", self.sql)

    def test_migration_is_idempotent(self):
        self.assertEqual(self.sql.count("DROP POLICY IF EXISTS"), self.sql.count("CREATE POLICY"))
        self.assertEqual(self.sql.count("DROP TRIGGER IF EXISTS"), self.sql.count("CREATE TRIGGER"))
        self.assertNotIn("CREATE FUNCTION", self.sql)


if __name__ == "__main__":
    unittest.main()
