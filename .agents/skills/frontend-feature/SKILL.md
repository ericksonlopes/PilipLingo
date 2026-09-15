---
name: frontend-feature
description: Adds a feature to the PilipLingo frontend (Vite + React 19 + TypeScript) adhering to mobile-first and PWA standards. Use when creating screens, tabs, components, hooks, API calls, or consuming a backend endpoint.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# New frontend feature

## Project Context

- `frontend/`, Vite 8 + React 19 + TypeScript + React Router + vite-plugin-pwa.
- Pure CSS with design tokens in `src/styles/global.css`. **No** Tailwind or external component libraries.
- No external data fetching library. Standard pattern: `lib/api.ts` + a custom hook using `useState`/`useEffect`.
- In dev, `/api` is proxied to the backend via Vite proxy (`vite.config.ts`), eliminating local CORS issues.

## Authentication

The app requires login before rendering any route. Without an active session, `App.tsx` renders `AuthPage`. With an active session, it renders `AppShell` containing authenticated routes.

- `useAuth()` manages session state (login, register, logout, current user).
- `lib/api.ts` attaches `Authorization: Bearer <token>` automatically to all requests via `authToken`.
- `AppShell` header displays user avatar and username.

## Directory Layout

```
frontend/src/
├── lib/types.ts        # mirrors backend Pydantic schemas
├── lib/api.ts          # typed request() + ApiError + domain API helpers
├── lib/levels.ts       # CEFR level labels
├── lib/speech.ts       # speech synthesis
├── lib/answers.ts      # answer validation
├── hooks/              # state hooks (useAuth, useVocabulary, useLevel, useStudySession...)
├── features/           # feature slices for complex domains
│   ├── chat/           # useChatPage + chat components
│   └── translation/    # useTranslateChat + translation components
├── components/         # reusable UI (AppShell, sheets, cards)
│   ├── study/          # exercise components
│   └── translation/    # translation display components
├── pages/              # page view per route
└── styles/global.css   # tokens + utility classes; no CSS-in-JS
```

## Active AppShell Tabs

Four active tabs in `components/AppShell.tsx`:

| Tab | Route | Description |
|---|---|---|
| Study | `/` | Spaced repetition study session |
| Chat | `/chat` | AI tutor conversation |
| Translate | `/traduzir` | Interactive structural translation |
| History | `/historico` | Study history and vocabulary |

## Execution Order

1. **Types first.** In `lib/types.ts`, mirror backend schemas accurately, preserving API `snake_case` field naming.
2. **API Client.** In `lib/api.ts`, add methods under corresponding API objects (`authApi`, `vocabularyApi`, `chatApi`, `translationApi`) using `request<T>()`. Pass `signal` when requests can be aborted.
3. **Hook** (if server state exists): search debouncing, `AbortController` cancellation for superseded requests, `active` tracking flag to prevent post-unmount updates. Complex domains go into `features/<domain>/`.
4. **Page/Component.** Handle all four UI states: loading, empty, error (with retry action), and success. Errors always rendered with `role="alert"`.
5. **Route and Navigation.** Register `<Route>` in `App.tsx` and add tab item to `TABS` in `components/AppShell.tsx` if creating a primary section.
6. **Styles.** Add new CSS classes to `global.css` reusing tokens (`--primary`, `--bg-elevated`, `--radius`, `--tap`). Avoid inline hardcoded color values.
7. **Graceful Degradation.** Query status endpoints for AI/external dependencies and gracefully degrade UI (warning message + disabled controls) instead of raising unhandled exceptions.
8. **Verification:** `npm run build` (`tsc -b` + Vite build) must complete cleanly.

## Mobile Rules

- Touch targets minimum height of 44px: use `min-height: var(--tap)` on buttons and inputs.
- Form inputs set `font-size: 16px` (inherited from `body`) to prevent iOS focus auto-zoom.
- Respect viewport safe areas via `env(safe-area-inset-*)` / CSS variables `--safe-top` and `--safe-bottom`.
- Prevent horizontal scroll overflow (`overflow-wrap: anywhere` for user text).
- Complex forms placed inside bottom sheets (`AddEntrySheet`), dismissable via Escape or backdrop click, focusing initial field on open.
- Set proper `enterKeyHint`, `autoCapitalize`, `autoCorrect`, and `spellCheck` input attributes.
- Mobile-first responsive layouts; desktop adaptations isolated inside `@media (min-width: 640px)`.
- Accessibility: `aria-label` on icon buttons, `aria-pressed` on toggle chips, visible `:focus-visible` outlines, `prefers-reduced-motion` compliance.

## Commands

```bash
cd frontend
npm run dev        # listens on 0.0.0.0
npm run build      # tsc -b + vite build + service worker
npm run preview    # test PWA build locally
```

Before finishing, check `references/checklist.md`.
