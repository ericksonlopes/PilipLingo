---
name: backend-migration
description: Creates and applies Alembic migrations in PilipLingo backend (SQLAlchemy async + SQLite). Use when adding or modifying tables, columns, indexes, or constraints, or when Alembic detects schema drift.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# Migrations with Alembic

Execute all commands from inside the `backend/` directory.

## Setup Architecture

- `migrations/env.py` reads database URL from `shared.config.Settings` and metadata from `orm_registry`, ensuring **runtime and migration schemas never diverge**. Do not place database URLs in `alembic.ini`.
- `render_as_batch` is enabled when target database is SQLite due to limited `ALTER TABLE` support. Modifying/dropping columns or constraints requires table recreation.
- `shared/database.py` defines `NAMING_CONVENTION`. Unnamed constraints cannot be altered later; never remove this convention.
- `post_write_hooks` in `alembic.ini` automatically runs `ruff check --fix` and `ruff format` on newly generated migrations.

## Workflow

```bash
# 1. Model must be imported in src/orm_registry.py; otherwise autogenerate misses it
uv run alembic revision --autogenerate -m "short description"

# 2. READ generated file before applying
uv run alembic upgrade head

# 3. Validate rollback migration path
uv run alembic downgrade -1
uv run alembic upgrade head

# 4. Confirm no schema drift remains
uv run alembic check
```

## Reviewing Autogenerate Output

- [ ] Model imported in `src/orm_registry.py`
- [ ] `downgrade()` properly reverts `upgrade()`
- [ ] Existing column modifications wrapped inside `batch_alter_table`
- [ ] New `nullable=False` columns on populated tables: add with `server_default`, perform backfill, then drop default
- [ ] Unique index on case-insensitive fields targets normalized column
- [ ] No unintended `DROP TABLE` / `DROP COLUMN` operations
- [ ] Column renames not converted into drop + create (manually write `batch_op.alter_column(..., new_column_name=...)`)

## Data Types Used

- PK: `Uuid()` generated in domain layer (`uuid4()`), not autoincrement.
- Date/Time: `DateTime(timezone=True)`. **SQLite does not store timezone**, mappers normalize to UTC on read (`_as_utc`).
- Simple lists/structures: `JSON`.
- User scoping: Business tables include `user_id = mapped_column(Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)`.

## Resetting Local Database

Local database file is disposable and ignored in git:

```bash
rm backend/data/piliplingo.db   # PowerShell: Remove-Item backend/data/piliplingo.db
uv run alembic upgrade head
```

In Docker, data lives in the `backend-data` volume and the entrypoint executes `alembic upgrade head` on startup. To reset: `docker compose down -v`.
