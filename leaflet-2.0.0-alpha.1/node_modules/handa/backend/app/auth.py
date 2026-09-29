import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import psycopg

from .config import settings
from .db import get_connection

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    name: str
    role: str
    token_version: int


def normalize_role(role: str) -> str:
    return "admin" if role.lower() == "administrator" else role.lower()


def _encode_segment(value: object) -> str:
    raw = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _decode_segment(value: str) -> dict:
    padding = "=" * (-len(value) % 4)
    return json.loads(base64.urlsafe_b64decode(f"{value}{padding}"))


def create_access_token(user_id: str, role: str, token_version: int) -> tuple[str, int]:
    now = int(time.time())
    expires_at = now + settings.access_token_minutes * 60
    header = _encode_segment({"alg": "HS256", "typ": "JWT"})
    payload = _encode_segment({"sub": user_id, "role": role, "ver": token_version, "iat": now, "exp": expires_at})
    unsigned = f"{header}.{payload}"
    signature = hmac.new(settings.auth_secret.encode(), unsigned.encode(), hashlib.sha256).digest()
    token = f"{unsigned}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"
    return token, expires_at - now


def decode_access_token(token: str) -> dict:
    try:
        header, payload, encoded_signature = token.split(".")
        if header != _encode_segment({"alg": "HS256", "typ": "JWT"}):
            raise ValueError
        unsigned = f"{header}.{payload}"
        expected_signature = hmac.new(settings.auth_secret.encode(), unsigned.encode(), hashlib.sha256).digest()
        padding = "=" * (-len(encoded_signature) % 4)
        actual_signature = base64.urlsafe_b64decode(f"{encoded_signature}{padding}")
        if not hmac.compare_digest(expected_signature, actual_signature):
            raise ValueError
        claims = _decode_segment(payload)
        if int(claims["exp"]) <= int(time.time()):
            raise ValueError
        if not isinstance(claims["sub"], str) or not isinstance(claims["ver"], int):
            raise ValueError
        return claims
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.", headers={"WWW-Authenticate": "Bearer"}) from None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    connection: psycopg.Connection = Depends(get_connection),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})

    claims = decode_access_token(credentials.credentials)
    row = connection.execute(
        "SELECT id, name, email, role, status, token_version FROM users WHERE id = %s",
        (claims["sub"],),
    ).fetchone()
    if not row or row["status"] != "Active" or row["token_version"] != claims["ver"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid.", headers={"WWW-Authenticate": "Bearer"})

    return CurrentUser(row["id"], row["email"], row["name"], normalize_role(row["role"]), row["token_version"])


def require_roles(*roles: str) -> Callable:
    allowed_roles = set(roles)

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized for this action.")
        return user

    return dependency
