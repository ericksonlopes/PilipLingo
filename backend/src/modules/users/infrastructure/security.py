"""Security adapters: password hashing (bcrypt) and tokens (JWT)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt
from pydantic import SecretStr

from modules.users.domain.entities import User
from modules.users.domain.errors import InvalidToken
from modules.users.domain.ports import PasswordHasher, TokenService

# bcrypt only accepts up to 72 bytes: truncating here avoids error and keeps
# behavior consistent between generating and verifying.
_BCRYPT_MAX_BYTES = 72


def _truncate(plain_password: str) -> bytes:
    return plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


class BcryptPasswordHasher(PasswordHasher):
    """Password hashing with bcrypt. No external dependency besides native lib."""

    def hash(self, plain_password: str) -> str:
        hashed = bcrypt.hashpw(_truncate(plain_password), bcrypt.gensalt())
        return hashed.decode("utf-8")

    def verify(self, plain_password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(_truncate(plain_password), password_hash.encode("utf-8"))
        except ValueError:
            # Malformed hash in DB: treat as invalid password instead of crashing.
            return False


class JwtTokenService(TokenService):
    """Issues/validates JWT tokens signed with HS256."""

    def __init__(
        self,
        *,
        secret: SecretStr,
        algorithm: str,
        expire_minutes: int,
    ) -> None:
        self._secret = secret.get_secret_value()
        self._algorithm = algorithm
        self._expire_minutes = expire_minutes

    def issue(self, user: User) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=self._expire_minutes)).timestamp()),
        }
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    def subject(self, token: str) -> UUID:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._algorithm])
            return UUID(str(payload["sub"]))
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise InvalidToken("Invalid or expired session.") from exc
