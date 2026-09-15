---
name: feature-end-to-end
description: Guides the implementation of a full end-to-end feature in PilipLingo, from backend to mobile frontend. Use when request involves both backend and frontend, such as a new learning capability (lessons, spaced repetition, audio, progress, achievements) or when workflow entry point is ambiguous.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# End-to-End Feature in PilipLingo

Orchestrates specialized skills:

- backend: `backend-vertical-slice`
- schema: `backend-migration`
- external service: `backend-external-adapter`
- frontend: `frontend-feature`

## Existing Context

**Backend** — Three vertical slices in `backend/src/modules/`:

- `vocabulary` — CRUD, Gemini sentence generation, structural translation, spaCy validation, SRS study.
- `users` — Registration and JWT + bcrypt authentication (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`).
- `chat` — AI tutor conversations (Gemini), topics, goals, turns with feedback.

**Frontend** — Four tabs in `AppShell.tsx`:
*Study* (`/`), *Chat* (`/chat`), *Translate* (`/traduzir`), *History* (`/historico`).

## Before Writing Code

Clarify three questions:

1. **Where does data live?** New table, existing table, or non-persisted?
2. **User Scoping.** Project includes **JWT + bcrypt authentication** (`users` module). Every business entity carries `user_id` with FK CASCADE. Repositories receive `user_id` in constructor and filter by it. Routes inject `CurrentUserDep` (from `modules.users.api.dependencies`).
3. **Third-party Service Dependencies.** Features must degrade gracefully if credentials are missing (status endpoint + 503, frontend warning banner).

## Recommended Execution Order

1. **Backend Domain** (entities, ports, errors).
2. **Use Cases** + DTOs.
3. **Infrastructure** (repository/adapter). Repositories receive `user_id` and filter by it. Models include `user_id` FK CASCADE to `users.id`.
4. **API** (schemas, dependencies, routes) and route registration in `src/api/router.py`. `dependencies.py` injects `CurrentUserDep` and passes `user.id` to repository.
5. **Migration**, if schema changed; verify upgrade and rollback paths.
6. **Verify Backend Directly**: launch and test endpoints, including 401/404/409/422/503 error paths.
7. **Frontend Types and Client API**, matching backend schema exactly.
8. **Hook + Page + Route + Tab**, handling all 4 UI states.
9. **`npm run build`** and mobile viewport layout validation.
10. **Documentation**: root `README.md`, backend/frontend docs, and `.env.example` if new environment variables were introduced.

## Definition of Done

```bash
cd backend  && uv run ruff check src migrations && uv run mypy && uv run alembic check
cd frontend && npm run build
```

Endpoints functioning on `http://localhost:8000/docs` and UI interacting smoothly with backend.

## Known Project Pitfalls

- Backend imports start from `src` (`from modules...`), no package prefix.
- Repositories call `flush()`; session commit is handled by `get_session` dependency.
- List fields in `Settings` require `NoDecode` + validator to avoid `pydantic-settings` comma-delimited parsing issues.
- Unimported models in `src/orm_registry.py` result in empty Alembic migrations.
- Verify `.gitignore` rules when adding new directories to avoid ignoring source files.
- PWA service worker active only in production build; test using `npm run preview`.
