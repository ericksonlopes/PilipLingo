"""Adaptadores de seguranca: hashing de senha (bcrypt) e tokens (JWT)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt
from pydantic import SecretStr

from modules.users.domain.entities import User
from modules.users.domain.errors import InvalidToken
from modules.users.domain.ports import PasswordHasher, TokenService

# bcrypt so aceita ate 72 bytes: cortar aqui evita erro e mantem o comportamento
# estavel entre gerar e verificar.
_BCRYPT_MAX_BYTES = 72


def _truncate(plain_password: str) -> bytes:
    return plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


class BcryptPasswordHasher(PasswordHasher):
    """Hash de senha com bcrypt. Sem dependencia externa alem da lib nativa."""

    def hash(self, plain_password: str) -> str:
        hashed = bcrypt.hashpw(_truncate(plain_password), bcrypt.gensalt())
        return hashed.decode("utf-8")

    def verify(self, plain_password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(_truncate(plain_password), password_hash.encode("utf-8"))
        except ValueError:
            # Hash malformado no banco: trata como senha invalida em vez de estourar.
            return False


class JwtTokenService(TokenService):
    """Emite/valida tokens JWT assinados com HS256."""

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
            raise InvalidToken("Sessao invalida ou expirada.") from exc
