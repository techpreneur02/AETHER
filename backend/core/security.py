from datetime import datetime, timedelta, timezone
import os
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext


ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def signing_key() -> str:
    key = os.getenv("AETHER_SECRET_KEY")
    if key:
        return key
    if os.getenv("AETHER_ENV", "development").lower() == "development":
        return "local-development-only-change-before-deploy"
    raise RuntimeError("AETHER_SECRET_KEY must be set for non-development deployments")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_access_token(*, user_id: str, organization_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "org_id": organization_id,
        "role": role,
        "jti": str(uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, signing_key(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, signing_key(), algorithms=[ALGORITHM])
    except JWTError as error:
        raise ValueError("Invalid access token") from error