---
name: backend-external-adapter
description: Integrates an external service (LLM, third-party HTTP API, email provider, TTS) into the PilipLingo backend behind a domain port. Use when adding integrations with Gemini/LangChain, external dictionary, audio, translator, or any paid/unstable network dependency.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# Integrate external service behind a domain port

Existing adapters in the project — read as reference before starting:

- `modules/vocabulary/infrastructure/gemini_generator.py` — sentence generation with LangChain + Gemini.
- `modules/vocabulary/infrastructure/chat_model.py` — Gemini client factory with `@lru_cache`.
- `modules/chat/infrastructure/gemini_tutor.py` — interactive tutor with LangChain + Gemini.
- `modules/vocabulary/infrastructure/gemini_phrase_translator.py` — sentence structural analysis into chunks.
- `modules/vocabulary/infrastructure/word_translator.py` — translation via `deep-translator`.
- `modules/vocabulary/infrastructure/sentence_validator.py` — local NLP validation with spaCy.

## Principle

The domain declares **what it needs**; the adapter knows **how**. No external SDK import allowed outside `<slice>/infrastructure/`. Switching providers should only require writing another adapter without touching `domain/` or `application/`.

```
domain/ports.py          ABC with contract in domain terms
infrastructure/<prov>.py  implements ABC using SDK
api/dependencies.py      selects concrete implementation
```

## Step-by-Step

1. **Port** in `<slice>/domain/ports.py`: ABC with `async` methods receiving and returning domain entities/value objects. No SDK types in signature.
2. **Errors** in `<slice>/domain/errors.py`, inheriting from `shared.errors.UnavailableError` (automatically maps to **503**):
   - unconfigured error (missing credentials)
   - failed error (provider down, invalid response, timeout)
3. **Config** in `shared/config.py`, prefix `PILIPLINGO_`:
   - credential **always** `SecretStr | None` (never leaks in repr/log)
   - model/endpoint, `temperature`, timeout, and configurable retries
   - property `is_<x>_configured` for API status checks without exposing secrets
   - usage limit per request for cost-sensitive calls
4. **Client factory** in `infrastructure/chat_model.py` (or equivalent): raises unconfigured error if credentials are missing and uses `@lru_cache` to reuse connections across requests.
5. **Adapter**: implements the port.
   - Prefer **structured output** (`with_structured_output` + Pydantic schema) over raw text parsing.
   - Wrap call in `try/except Exception` and convert to domain error with `raise ... from cause`.
   - In logs, **only log exception type**: never prompt, credentials, or user data.
   - Validate return payload (empty strings, missing fields, excess items) before constructing entities.
6. **Wiring** in `<slice>/api/dependencies.py`: one function per port, returning the **port** type (not implementation), enabling test overrides.
7. **Status route** (`GET /<slice>/status`) reporting whether integration is active, model/endpoint in use, and limits — never credentials. Frontend uses this to gracefully degrade UI.
8. **Documentation**: `.env.example` (root and `backend/`), `docker-compose.yml` (`${VAR:-}`, never literal credentials), and `backend/README.md`.

## Security and Cost (Mandatory)

- Credentials strictly via environment variables; `.env` kept out of git.
- Existing AI routes **already require Bearer authentication** (`CurrentUserDep`). Ensure any new paid route also enforces authentication.
- Explicitly note what user data leaves the system for third-party processing.
- Always set explicit timeouts and low retry counts (0 to 2).

## Testing without Network or Costs

Inject a fake via port dependency:

```python
class FakeGenerator(SentenceGenerator):
    async def generate(self, request): ...

app.dependency_overrides[get_sentence_generator] = lambda: FakeGenerator()
```

Cover three scenarios without requiring valid credentials:

1. missing credentials -> 503 with unconfigured `code`
2. with fake -> 200 and correct payload
3. invalid credentials -> 503 with failure `code` (not 500)

## Commands

```bash
cd backend
uv add "<package>>=<version>"
uv run ruff check src && uv run mypy
```

Confirm actual SDK API via Python introspection (`uv run python -c "import x; print(dir(x))"`) rather than relying on memory.
