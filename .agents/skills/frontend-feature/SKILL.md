---
name: frontend-feature
description: Adiciona uma feature no frontend do PilipLingo (Vite + React 19 + TypeScript) mantendo o padrao mobile-first e PWA. Use ao criar tela, aba, componente, hook ou chamada de API nova no app, ou ao consumir um endpoint novo do backend.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# Nova feature no frontend

## Contexto do projeto

- `frontend/`, Vite 8 + React 19 + TypeScript + React Router + vite-plugin-pwa.
- CSS puro com design tokens em `src/styles/global.css`. **Nao ha** Tailwind nem
  biblioteca de componentes; nao introduza uma sem combinar antes.
- Sem lib de data fetching. O padrao e `lib/api.ts` + um hook com `useState`/`useEffect`.
- Em dev, `/api` e encaminhado ao backend pelo proxy do Vite (`vite.config.ts`),
  entao nao existe CORS local.

## Autenticacao

O app exige login antes de renderizar qualquer rota. Sem sessao ativa, `App.tsx`
exibe `AuthPage`. Com sessao, renderiza `AppShell` com as rotas autenticadas.

- `useAuth()` gerencia sessao (login, register, logout, usuario corrente).
- `lib/api.ts` anexa `Authorization: Bearer <token>` automaticamente em todas as
  chamadas via `authToken`. Nao e necessario tratar auth manualmente nos hooks.
- O header do `AppShell` exibe avatar e username do usuario autenticado.

## Onde cada coisa mora

```
frontend/src/
├── lib/types.ts        # espelha os schemas Pydantic do backend
├── lib/api.ts          # request() tipado + ApiError + objetos por fatia
├── lib/levels.ts       # rotulos de nivel CEFR
├── lib/speech.ts       # sintese de voz
├── lib/answers.ts      # validacao de respostas
├── hooks/              # estado da feature (useAuth, useVocabulary, useLevel, useStudySession...)
├── features/           # feature slices para dominios complexos
│   ├── chat/           # useChatPage + componentes de chat
│   └── translation/    # useTranslateChat + componentes de traducao
├── components/         # UI reutilizavel (AppShell, sheets, cards)
│   ├── study/          # 11 componentes modulares de exercicios
│   └── translation/    # componentes de traducao
├── pages/              # uma tela por rota
└── styles/global.css   # tokens + classes; sem CSS-in-JS
```

## Abas atuais do AppShell

Quatro abas ativas em `components/AppShell.tsx`:

| Aba | Rota | Descricao |
|---|---|---|
| Estudar | `/` | Sessao de estudo com SRS |
| Chat | `/chat` | Conversa com tutor IA |
| Traduzir | `/traduzir` | Traducao interativa |
| Historico | `/historico` | Historico de estudo |

## Ordem de trabalho

1. **Tipos primeiro.** Em `lib/types.ts`, espelhe exatamente o schema do backend,
   inclusive `snake_case` nos campos vindos da API. Nao renomeie para camelCase.
2. **Cliente.** Em `lib/api.ts`, adicione um metodo no objeto da fatia
   (`authApi`, `vocabularyApi`, `chatApi`, `translationApi`) usando o
   `request<T>()` existente. Ele ja trata 204, JSON, e converte erro em
   `ApiError` com `status` e `code`. Passe `signal` quando a chamada puder ser
   cancelada.
3. **Hook** (se houver estado de servidor): debounce em busca, `AbortController`
   para cancelar request anterior, flag `active` para nao setar state apos unmount.
   Veja `hooks/useVocabulary.ts`. Para dominios complexos, considere criar em
   `features/<dominio>/` em vez de `hooks/`.
4. **Pagina/componente.** Trate os quatro estados: carregando, vazio, erro (com
   acao de retry) e sucesso. Erro sempre com `role="alert"`.
5. **Rota e navegacao.** Adicione `<Route>` em `App.tsx` e, se for uma secao
   principal, uma entrada em `TABS` no `components/AppShell.tsx` (com icone SVG
   inline e `aria-hidden="true"`).
6. **Estilos.** Classes novas em `global.css`, reaproveitando os tokens
   (`--primary`, `--bg-elevated`, `--radius`, `--tap`). Sem valores hex soltos.
7. **Feature dependente de config do backend** (ex.: IA): consulte o endpoint de
   status e degrade a UI (aviso + botao desabilitado) em vez de deixar estourar erro.
8. **Verificar:** `npm run build` (roda `tsc -b` antes do build) tem que passar.

## Regras de mobile (a razao de existir deste app)

- Area de toque minima de 44px: use `min-height: var(--tap)` em botoes e inputs.
- Input com `font-size: 16px` (herdado do `body`), senao o iOS da zoom no foco.
- Respeite as safe areas: `env(safe-area-inset-*)`; ja existem as vars
  `--safe-top` e `--safe-bottom`.
- Nada de scroll horizontal. Use `overflow-wrap: anywhere` em texto do usuario.
- Formulario longo vai em bottom sheet (`AddEntrySheet`), fechavel por Esc e por
  toque no backdrop, com foco no primeiro campo ao abrir.
- Inputs com `enterKeyHint`, `autoCapitalize`, `autoCorrect` e `spellCheck`
  coerentes (termo em ingles: `autoCapitalize="none"`, `spellCheck={false}`).
- Layout mobile-first; ajustes de tela grande so dentro de `@media (min-width: 640px)`.
- Acessibilidade: `aria-label` em botao de icone, `aria-pressed` em chip de
  selecao, `:focus-visible` visivel, `prefers-reduced-motion` respeitado.

## Comandos

```bash
cd frontend
npm run dev        # escuta em 0.0.0.0; teste no celular via IP da maquina
npm run build      # tsc -b + vite build + service worker
npm run preview    # unica forma de testar o PWA (o SW nao roda em dev)
```

Antes de finalizar, confira `references/checklist.md`.

