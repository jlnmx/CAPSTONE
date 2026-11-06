import json
import time

import jwt
from jwt.algorithms import ECAlgorithm, RSAAlgorithm

from .config import settings

SIGNING_ALGORITHMS = {"ES256": ECAlgorithm, "RS256": RSAAlgorithm}


class RealtimeNotConfigured(RuntimeError):
    pass


def _load_private_jwk() -> tuple[object, str, str]:
    algorithm = settings.realtime_jwt_algorithm
    algorithm_class = SIGNING_ALGORITHMS.get(algorithm)
    if algorithm_class is None:
        raise RealtimeNotConfigured("Unsupported Realtime signing algorithm.")
    if not settings.realtime_jwt_private_key:
        raise RealtimeNotConfigured("Realtime signing key is not configured.")
    try:
        jwk = json.loads(settings.realtime_jwt_private_key)
        kid = jwk["kid"]
        key = algorithm_class.from_jwk(jwk)
    except (ValueError, KeyError, TypeError, jwt.InvalidKeyError):
        raise RealtimeNotConfigured("Realtime signing key is invalid.") from None
    if not hasattr(key, "private_numbers"):
        raise RealtimeNotConfigured("Realtime signing key must be a private key.")
    return key, kid, algorithm


def create_realtime_token(user_id: str, app_role: str) -> tuple[str, int]:
    """Short-lived JWT accepted by Supabase Realtime. `sub` is the text user id; `app_role` is resident, responder or admin."""
    key, kid, algorithm = _load_private_jwk()
    now = int(time.time())
    lifetime = settings.realtime_token_minutes * 60
    claims = {
        "aud": "authenticated",
        "role": "authenticated",
        "sub": user_id,
        "app_role": app_role,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(claims, key, algorithm=algorithm, headers={"kid": kid}), lifetime
