# Checklist de fatia vertical

## Estrutura

- [ ] Quatro camadas criadas, cada pasta com `__init__.py` e docstring de modulo
- [ ] Nenhum import de FastAPI/SQLAlchemy/Pydantic dentro de `domain/`
- [ ] Nenhum import de outra fatia em `domain/` ou `application/`
- [ ] Import absoluto a partir de `src` (`from modules...`, `from shared...`)

## Domain

- [ ] Entidade com factory `create()` validando invariantes
- [ ] Normalizacao (trim, casefold, dedupe) feita no dominio, nao na rota
- [ ] Erros herdando de `shared.errors` com `code` proprio
- [ ] Portas como ABC, metodos `async`, assinatura em termos do dominio

## Application

- [ ] DTOs `@dataclass(frozen=True, slots=True)`
- [ ] Caso de uso recebe portas no `__init__` e expoe `execute()`
- [ ] Zero conhecimento de HTTP, ORM ou commit

## Infrastructure

- [ ] Model herda de `shared.database.Base`
- [ ] Repositorio usa `flush()`, nunca `commit()`
- [ ] Mappers convertem nos dois sentidos e reanexam UTC em datas do SQLite
- [ ] Coluna de unicidade case-insensitive guarda a versao normalizada

## API

- [ ] `schemas.py` com `from_entity()` para respostas
- [ ] `dependencies.py` e o unico ponto que instancia implementacao concreta
- [ ] Rotas sem try/except de erro de dominio (o handler global cuida)
- [ ] `status_code` correto (201 no create, 204 no delete)
- [ ] `summary` em cada rota para a doc do OpenAPI ficar legivel

## Registro e schema

- [ ] Router incluido em `src/api/router.py`
- [ ] Models importados em `src/orm_registry.py`
- [ ] Migration gerada, aplicada e revertida com sucesso
- [ ] `uv run alembic check` nao detecta drift

## Qualidade

- [ ] `uv run ruff check src migrations` limpo
- [ ] `uv run ruff format src migrations` sem diff
- [ ] `uv run mypy` limpo (strict)
- [ ] Rotas exercitadas de verdade, incluindo 404/409/422
- [ ] `.env.example` e `backend/README.md` atualizados se entrou config nova
