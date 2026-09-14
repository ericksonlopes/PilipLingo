"""Configuracao da aplicacao, carregada de variaveis de ambiente / .env."""

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
    """Configuracao central. Todas as variaveis usam o prefixo PILIPLINGO_."""

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

    host: str = "0.0.0.0"  # noqa: S104 - dev/container precisa escutar em todas as interfaces
    port: int = 8000
    reload: bool = True

    # SQLite local por padrao; troque por outro dialeto async quando necessario.
    database_url: str = (
        f"sqlite+aiosqlite:///{(BACKEND_ROOT / 'data' / 'piliplingo.db').as_posix()}"
    )
    database_echo: bool = False

    # NoDecode desliga o json.loads automatico do pydantic-settings para este campo,
    # que acontece ANTES dos validators. Sem isso, `a,b` quebraria a inicializacao.
    # ----- Geracao de frases com Gemini (LangChain) -----
    # SecretStr evita que a chave apareca em repr/logs.
    google_api_key: SecretStr | None = None
    # Modelos Flash GA: gemini-2.0-flash (equilibrado) e gemini-2.0-flash-lite (mais barato).
    gemini_model: str = "gemini-2.0-flash"
    gemini_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    gemini_timeout_seconds: float = Field(default=25.0, gt=0)
    gemini_max_retries: int = Field(default=2, ge=0, le=5)
    # Teto de frases por requisicao: a geracao custa dinheiro por chamada.
    sentences_max_per_request: int = Field(default=5, ge=1, le=10)

    # ----- Chat com IA (Gemini) -----
    # GEMINI_API_KEY e o mesmo google_api_key acima; reutilizamos a mesma chave.
    # Modelo e timeout independentes da geracao de frases do vocabulario.
    chat_ai_model: str = "gemini-3.6-flash"
    chat_ai_timeout: float = Field(default=30.0, gt=0)
    # Maximo de turnos por conversa antes de encerrar automaticamente.
    chat_max_turn_limit: int = Field(default=40, ge=1, le=200)

    # ----- Autenticacao (JWT assinado + bcrypt) -----
    # Chave usada para assinar os tokens. TROQUE em producao (PILIPLINGO_JWT_SECRET).
    # >= 32 bytes: comprimento minimo recomendado para HS256 (RFC 7518).
    jwt_secret: SecretStr = SecretStr("dev-only-change-me-please-32bytes-minimum")
    jwt_algorithm: str = "HS256"
    # Validade do token de acesso (em minutos). Padrao: 7 dias.
    jwt_expire_minutes: int = Field(default=60 * 24 * 7, ge=5)

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_origins(cls, value: object) -> object:
        """Aceita lista JSON (`["a","b"]`) ou lista separada por virgula (`a,b`)."""
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
        """True quando ha chave para chamar o Gemini."""
        return self.google_api_key is not None and bool(self.google_api_key.get_secret_value())

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def sqlite_path(self) -> Path | None:
        """Caminho do arquivo SQLite, quando o banco for SQLite em disco."""
        if not self.is_sqlite:
            return None
        _, _, raw_path = self.database_url.partition(":///")
        if not raw_path or raw_path == ":memory:":
            return None
        return Path(raw_path)


@lru_cache
def get_settings() -> Settings:
    """Settings em cache para reuso como dependencia do FastAPI."""
    return Settings()
