---
name: feature-end-to-end
description: Guia a implementacao de uma feature completa do PilipLingo, do backend ao app mobile. Use quando o pedido envolve backend e frontend juntos, como uma funcionalidade nova de aprendizado (licoes, revisao espacada, audio, progresso, conquistas) ou quando nao esta claro por onde comecar.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# Feature ponta a ponta no PilipLingo

Orquestra as outras skills. Detalhe de cada etapa:

- backend: `backend-vertical-slice`
- schema: `backend-migration`
- servico externo: `backend-external-adapter`
- app: `frontend-feature`

## O que ja existe (leia antes de duplicar)

**Backend** — tres fatias verticais em `backend/src/modules/`:

- `vocabulary` — CRUD, geracao de frases (Gemini), traducao, validacao (spaCy), estudo com SRS.
- `users` — cadastro, login com JWT + bcrypt (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`).
- `chat` — conversas com tutor IA (Gemini), topicos, metas comunicativas, turnos com feedback.

**Frontend** — quatro abas em `AppShell.tsx`:
*Estudar* (`/`), *Chat* (`/chat`), *Traduzir* (`/traduzir`), *Historico* (`/historico`).

## Antes de escrever codigo

Responda tres coisas (pergunte ao usuario se nao souber):

1. **Onde o dado vive?** Nova tabela, tabela existente, ou nada persistido?
2. **Escopo de usuario.** O projeto possui **autenticacao completa** (JWT + bcrypt,
   modulo `users`). Toda entidade de negocio carrega `user_id` com FK CASCADE.
   Repositorios recebem `user_id` no construtor e filtram por ele. Rotas injetam
   `CurrentUserDep` (de `modules.users.api.dependencies`). Tabela nova deve
   seguir esse padrao. Se a feature for global (sem escopo de usuario), confirme
   explicitamente com o usuario.
3. **Depende de servico externo pago?** Se sim, a feature tem que degradar
   graciosamente quando a credencial nao existe (status + 503, UI avisando).

## Ordem que funciona neste projeto

1. **Dominio no backend** (entidades, portas, erros) — e onde as regras moram.
2. **Caso de uso** + DTOs.
3. **Infrastructure** (repositorio/adaptador). Repositorio recebe `user_id` e
   filtra por ele. Model com `user_id` FK CASCADE para `users.id`.
4. **API** (schemas, dependencies, routes) e registro em `src/api/router.py`.
   `dependencies.py` injeta `CurrentUserDep` e passa `user.id` ao repositorio.
5. **Migration**, se houve schema; aplicar e reverter.
6. **Verificar o backend de verdade**: subir e exercitar as rotas, incluindo
   401/404/409/422/503. Sem isso a integracao do app vira adivinhacao.
7. **Tipos e cliente no frontend**, espelhando o schema real (nao o imaginado).
8. **Hook + tela + rota + aba**, com os quatro estados de UI.
9. **`npm run build`** e teste em viewport estreito.
10. **Docs**: `README.md` da raiz, do backend e/ou do frontend, e `.env.example` se
    entrou config nova.

## Definition of done

```bash
cd backend  && uv run ruff check src migrations && uv run mypy && uv run alembic check
cd frontend && npm run build
```

Mais: a rota nova respondendo em `http://localhost:8000/docs` e a tela funcionando
com o backend rodando (o proxy do Vite cuida do `/api` em dev).

## Armadilhas ja conhecidas neste repo

- Import no backend e a partir de `src` (`from modules...`), sem prefixo de pacote.
- Repositorio da `flush()`; o commit e do `get_session`.
- Campo de lista em `Settings` precisa de `NoDecode` + validator, senao
  `pydantic-settings` tenta `json.loads` e quebra com valor `a,b` do compose.
- Model novo sem import em `src/orm_registry.py` = migration vazia.
- `.gitignore` da raiz e de projeto Python: um padrao como `lib/` pode engolir
  codigo do frontend. Confira com `git check-ignore -v <arquivo>` ao criar pasta nova.
- Service worker do PWA so existe no build; teste com `npm run preview`.
