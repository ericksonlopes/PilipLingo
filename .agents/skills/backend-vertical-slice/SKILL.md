---
name: backend-vertical-slice
description: Cria uma nova fatia vertical no backend FastAPI do PilipLingo seguindo arquitetura hexagonal (domain, application, infrastructure, api). Use ao adicionar um modulo/feature de negocio novo no backend, como lessons, users, progress ou decks, ou ao adicionar caso de uso, rota ou tabela dentro de uma fatia existente.
metadata:
  author: PilipLingo
  version: 1.0.0
---

# Nova fatia vertical no backend

## Contexto do projeto que voce precisa lembrar

- `backend/src` **e a raiz de imports**. Nao existe pacote `piliplingo`. Import e
  `from modules.x.domain...`, nunca `from src...` nem `from piliplingo...`.
- O projeto nao e empacotado (`[tool.uv] package = false`). Por isso:
  uvicorn usa `--app-dir src`, pytest usa `pythonpath = ["src"]`,
  Alembic usa `prepend_sys_path = %(here)s/src`.
- Tudo roda por `uv` a partir de `backend/`.

## Regra de dependencia (nao viole)

```
api  ->  application  ->  domain  <-  infrastructure
```

- `domain/` nao importa FastAPI, SQLAlchemy, Pydantic nem nenhuma lib externa.
- `application/` importa apenas o proprio `domain` (entidades, portas, DTOs).
- `infrastructure/` e `api/` sao os adaptadores; so eles conhecem framework e I/O.
- Uma fatia **nao** importa `domain`/`application` de outra fatia. Se precisar de
  dados de outra, declare uma porta na sua propria fatia (em termos do **seu**
  dominio) e escreva o adaptador em `infrastructure/`, que traduz para o
  repositorio da fatia fornecedora.
- Antes de criar uma fatia nova, pergunte se a capacidade gira em volta de um
  agregado que ja existe. Se sim, ela pertence a fatia existente. Foi o caso da
  antiga fatia `sentences`: ela existia so para alcancar o vocabulario por uma
  porta intermediaria, e foi absorvida por `modules/vocabulary`. Fatia demais
  custa mais indirecao do que isolamento.

## Estrutura a criar

```
backend/src/modules/<slice>/
├── __init__.py
├── domain/
│   ├── __init__.py
│   ├── entities.py       # dataclasses + invariantes; factory `create()`
│   ├── errors.py         # herda de shared.errors
│   └── ports.py          # ABCs: o que a fatia precisa do mundo externo
├── application/
│   ├── __init__.py
│   ├── dto.py            # dataclasses frozen (Command/Query/Result)
│   └── use_cases.py      # uma classe por caso de uso, recebe portas no __init__
├── infrastructure/
│   ├── __init__.py
│   ├── models.py         # SQLAlchemy, herda de shared.database.Base
│   ├── mappers.py        # model <-> entidade
│   └── repository.py     # implementa a porta
└── api/
    ├── __init__.py
    ├── schemas.py        # Pydantic; `from_entity()` para saida
    ├── dependencies.py   # unico lugar que escolhe a implementacao concreta
    └── routes.py         # APIRouter(prefix="/<slice>", tags=["<slice>"])
```

Use `modules/vocabulary` como referencia: e a fatia que junta persistencia
(CRUD completo com repositorio e mappers) e servico externo (adaptador
LangChain/Gemini atras da porta `SentenceGenerator`).

## Ordem de trabalho

1. **Domain primeiro.** Entidades com `@dataclass(slots=True)` e factory
   `create()` que valida e levanta `ValidationError`. Erros especificos em
   `errors.py` herdando de `shared.errors` (`ValidationError`, `NotFoundError`,
   `ConflictError`, `UnavailableError`) — o mapeamento para HTTP ja existe em
   `shared/api/error_handlers.py`, nao repita status code nas rotas.
2. **Portas.** ABC com `@abstractmethod` async. Assinaturas em termos do dominio
   (entidades e value objects), nunca models ORM nem schemas Pydantic.
3. **Casos de uso.** Uma classe por operacao, portas injetadas no `__init__`,
   metodo `execute()`. Sem `await session.commit()` aqui.
4. **Infrastructure.** Model ORM + mappers + repositorio.
   O repositorio faz `flush()`, **nunca `commit()`**: a unidade de trabalho e a
   dependencia `get_session`, que da commit no fim do request e rollback em erro.
5. **API.** `schemas.py` (Pydantic) -> `dependencies.py` (wiring) -> `routes.py`.
   As rotas convertem schema em DTO, chamam o caso de uso e devolvem
   `Response.from_entity(...)`.
6. **Registrar.** Sempre os dois:
   - router em `backend/src/api/router.py`
   - models em `backend/src/orm_registry.py` (senao o Alembic nao ve a tabela)
7. **Migration** (se criou/alterou tabela): siga a skill `backend-migration`.
8. **Definition of done:** rode os comandos da secao abaixo.

## Comandos

```bash
cd backend
uv run ruff check src migrations
uv run ruff format src migrations
uv run mypy                     # strict; precisa passar
uv run alembic revision --autogenerate -m "<descricao>"   # se mudou schema
uv run alembic upgrade head
uv run uvicorn main:app --app-dir src --reload
```

Verifique de verdade antes de dizer que acabou: suba a API e exercite as rotas
novas (`/docs` ou httpx com `ASGITransport`), incluindo os caminhos de erro.

## Convencoes que o mypy strict cobra

- Todas as funcoes anotadas, inclusive retorno `-> None`.
- `from __future__ import annotations` no topo de cada modulo.
- Tipos genericos parametrizados (`Select[Any]`, nao `Select`).
- Docstring curta em portugues sem acento explicando o porque, nao o obvio.

Antes de finalizar, confira `references/checklist.md`.
