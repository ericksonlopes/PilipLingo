---
name: backend-vertical-slice
description: Creates a new vertical slice in PilipLingo FastAPI backend following hexagonal architecture (domain, application, infrastructure, api). Use when adding a new backend module/feature like lessons, progress, achievements, or decks, or when adding use cases, routes, or tables inside an existing slice.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# New vertical slice in the backend

## Project Context to Remember

- `backend/src` **is the root of all imports**. There is no `piliplingo` package. Import as `from modules.x.domain...`, never `from src...` or `from piliplingo...`.
- Project is not packaged (`[tool.uv] package = false`). Therefore: uvicorn uses `--app-dir src`, pytest uses `pythonpath = ["src"]`, Alembic uses `prepend_sys_path = %(here)s/src`.
- Everything is executed via `uv` from the `backend/` directory.
- The project implements **JWT + bcrypt authentication** (`users` module). Every persisted business entity is scoped by `user_id` (`ForeignKey("users.id", ondelete="CASCADE")`). Repositories accept `user_id` in their constructor and filter by it across all queries. Routes inject `CurrentUserDep` (from `modules.users.api.dependencies`) and pass `user.id` to the repository via `dependencies.py`. Reference: `modules/vocabulary/api/dependencies.py`.

## Existing Slices

- `modules/vocabulary` — Vocabulary CRUD, Gemini sentence generation, structural translation, spaCy validation, SRS study.
- `modules/users` — Registration and authentication (JWT + bcrypt, `CurrentUserDep`).
- `modules/chat` — AI tutor conversations, topics, goals, turns with feedback.

Before creating a new slice, check if the functionality revolves around an existing aggregate. If so, place it inside the existing slice. Over-slicing adds indirection rather than isolation.

## Dependency Rule (Strict)

```
api  ->  application  ->  domain  <-  infrastructure
```

- `domain/` never imports FastAPI, SQLAlchemy, Pydantic, or any external library.
- `application/` imports only its own `domain` (entities, ports, DTOs).
- `infrastructure/` and `api/` act as adapters; only they interact with frameworks and I/O.
- A slice **never** imports `domain`/`application` from another slice. If cross-slice data is needed, declare a port in your own slice (in terms of **your** domain) and implement the adapter in `infrastructure/`.

## Directory Structure

```
backend/src/modules/<slice>/
├── __init__.py
├── domain/
│   ├── __init__.py
│   ├── entities.py       # dataclasses + invariants; factory `create()`
│   ├── errors.py         # inherits from shared.errors
│   └── ports.py          # ABCs: what the slice requires from external world
├── application/
│   ├── __init__.py
│   ├── dto.py            # frozen dataclasses (Command/Query/Result)
│   └── use_cases.py      # one class per use case, receives ports in __init__
├── infrastructure/
│   ├── __init__.py
│   ├── models.py         # SQLAlchemy, inherits from shared.database.Base
│   ├── mappers.py        # model <-> entity
│   └── repository.py     # implements the port
└── api/
    ├── __init__.py
    ├── schemas.py        # Pydantic; `from_entity()` for output
    ├── dependencies.py   # sole location choosing concrete implementation
    └── routes.py         # APIRouter(prefix="/<slice>", tags=["<slice>"])
```

Reference `modules/vocabulary` for complete persistence and external service integration.

## Execution Order

1. **Domain first.** Entities using `@dataclass(slots=True)` with factory `create()` validating invariants and raising domain errors. Specific errors in `errors.py` inheriting from `shared.errors` (`ValidationError`, `NotFoundError`, `ConflictError`, `UnavailableError`, `UnauthorizedError`) — HTTP status mapping already handled in `shared/api/error_handlers.py` (400, 404, 409, 503, 401).
2. **Ports.** ABC with `@abstractmethod` async. Signatures strictly in domain terms (entities and value objects).
3. **Use cases.** One class per operation, ports injected in `__init__`, `execute()` method. No `await session.commit()` in use cases.
4. **Infrastructure.** ORM model + mappers + repository.
   Repository calls `flush()`, **never `commit()`**: unit of work managed by `get_session` dependency.
   Model must include `user_id = mapped_column(Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)`. Repository accepts `user_id: UUID` in `__init__` and applies filtering on all queries.
5. **API.** `schemas.py` (Pydantic) -> `dependencies.py` (wiring) -> `routes.py`.
   Routes map schemas to DTOs, execute use cases, and return `Response.from_entity(...)`. `dependencies.py` injects `CurrentUserDep` and passes `user.id` to repository.
6. **Registration.** Always register both:
   - router in `backend/src/api/router.py`
   - models in `backend/src/orm_registry.py` (enables Alembic detection)
7. **Migration** (if schema changed): follow `backend-migration` skill.
8. **Definition of Done:** execute commands in the section below.

## Commands

```bash
cd backend
uv run ruff check src migrations
uv run ruff format src migrations
uv run mypy                     # strict; must pass
uv run alembic revision --autogenerate -m "<description>"   # if schema changed
uv run alembic upgrade head
uv run uvicorn main:app --app-dir src --reload
```

Verify by starting the API and testing new endpoints (`/docs` or httpx ASGI test driver), including error paths.

## Strict Mypy Conventions

- All functions annotated, including `-> None` returns.
- `from __future__ import annotations` at the top of every module.
- Parameterized generic types (`Select[Any]`, not `Select`).
- Concise docstrings in clear English explaining intent.

Before finishing, check `references/checklist.md`.
