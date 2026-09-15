"""Application configuration, loaded from environment variables / .env."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/src/shared/config.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Central configuration. All variables use the prefix PILIPLINGO_."""

    model_config = SettingsConfigDict(
        env_file=(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        env_prefix="PILIPLINGO_",
        extra="ignore",
    )

    app_name: str = "PilipLingo API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = True

    api_prefix: str = "/api/v1"

    host: str = "0.0.0.0"  # noqa: S104 - dev/container needs to listen on all interfaces
    port: int = 8000
    reload: bool = True

    # Local SQLite by default; change to another async dialect when needed.
    database_url: str = (
        f"sqlite+aiosqlite:///{(BACKEND_ROOT / 'data' / 'piliplingo.db').as_posix()}"
    )
    database_echo: bool = False

    # NoDecode disables automatic json.loads of pydantic-settings for this field,
    # which happens BEFORE validators. Without this, `a,b` would break initialization.
    # ----- Sentence Generation with Gemini (LangChain) -----
    # SecretStr prevents the key from appearing in repr/logs.
    google_api_key: SecretStr | None = None
    # Flash GA models: gemini-2.0-flash (balanced) and gemini-2.0-flash-lite (cheaper).
    gemini_model: str = "gemini-2.0-flash"
    gemini_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    gemini_timeout_seconds: float = Field(default=25.0, gt=0)
    gemini_max_retries: int = Field(default=2, ge=0, le=5)
    # Maximum sentences per request: generation costs money per call.
    sentences_max_per_request: int = Field(default=5, ge=1, le=10)

    # ----- AI Chat (Gemini) -----
    # GEMINI_API_KEY is the same google_api_key above; we reuse the same key.
    # Model and timeout independent of vocabulary sentence generation.
    chat_ai_model: str = "gemini-3.6-flash"
    chat_ai_timeout: float = Field(default=30.0, gt=0)
    # Maximum turns per conversation before automatically ending.
    chat_max_turn_limit: int = Field(default=40, ge=1, le=200)

    # ----- Authentication (Signed JWT + bcrypt) -----
    # Key used to sign tokens. CHANGE in production (PILIPLINGO_JWT_SECRET).
    # >= 32 bytes: recommended minimum length for HS256 (RFC 7518).
    jwt_secret: SecretStr = SecretStr("dev-only-change-me-please-32bytes-minimum")
    jwt_algorithm: str = "HS256"
    # Access token validity (in minutes). Default: 7 days.
    jwt_expire_minutes: int = Field(default=60 * 24 * 7, ge=5)

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_origins(cls, value: object) -> object:
        """Accepts JSON list (`["a","b"]`) or comma-separated list (`a,b`)."""
        if not isinstance(value, str):
            return value

        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            return json.loads(text)
        return [origin.strip() for origin in text.split(",") if origin.strip()]

    @property
    def is_ai_configured(self) -> bool:
        """True when key to call Gemini is set."""
        return self.google_api_key is not None and bool(self.google_api_key.get_secret_value())

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def sqlite_path(self) -> Path | None:
        """Path to SQLite file, when database is SQLite on disk."""
        if not self.is_sqlite:
            return None
        _, _, raw_path = self.database_url.partition(":///")
        if not raw_path or raw_path == ":memory:":
            return None
        return Path(raw_path)


@lru_cache
def get_settings() -> Settings:
    """Cached Settings for reuse as a FastAPI dependency."""
    return Settings()
