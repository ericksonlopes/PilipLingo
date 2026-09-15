# Vertical Slice Checklist

## Structure

- [ ] Four layers created, each directory with `__init__.py` and module docstring
- [ ] No FastAPI/SQLAlchemy/Pydantic imports inside `domain/`
- [ ] No imports from other slices in `domain/` or `application/`
- [ ] Absolute imports starting from `src` (`from modules...`, `from shared...`)

## Domain

- [ ] Entity with `create()` factory validating invariants
- [ ] Normalization (trim, casefold, dedupe) done in domain, not in route
- [ ] Domain errors inheriting from `shared.errors` with distinct `code`
- [ ] Ports as ABCs, `async` methods, signatures in domain terms

## Application

- [ ] DTOs using `@dataclass(frozen=True, slots=True)`
- [ ] Use case receives ports in `__init__` and exposes `execute()`
- [ ] Zero knowledge of HTTP, ORM, or commit logic

## Infrastructure

- [ ] Model inherits from `shared.database.Base`
- [ ] Repository calls `flush()`, never `commit()`
- [ ] Mappers convert bidirectionally and normalize SQLite dates to UTC
- [ ] Case-insensitive uniqueness column stores normalized version
- [ ] User-scoped tables include `user_id` with FK CASCADE to `users.id`
- [ ] Repository receives `user_id` in constructor and filters by it in all queries

## API

- [ ] `schemas.py` with `from_entity()` for responses
- [ ] `dependencies.py` is the single place instantiating concrete implementations
- [ ] Routes accessing user data inject `CurrentUserDep` and pass `user.id` to repository
- [ ] Routes free of domain error try/except blocks (global handler manages errors)
- [ ] Correct HTTP `status_code` (201 on create, 204 on delete)
- [ ] Concise route `summary` for clear OpenAPI docs

## Registration and Schema

- [ ] Router included in `src/api/router.py`
- [ ] Models imported in `src/orm_registry.py`
- [ ] Migration generated, applied, and rollbacks verified
- [ ] `uv run alembic check` confirms no schema drift

## Quality Assurance

- [ ] `uv run ruff check src migrations` clean
- [ ] `uv run ruff format src migrations` clean
- [ ] `uv run mypy` clean (strict)
- [ ] Endpoints manually tested, including 404/409/422 error paths
- [ ] `.env.example` and `backend/README.md` updated if new configs were introduced
