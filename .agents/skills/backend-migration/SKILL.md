---
name: backend-migration
description: Cria e aplica migrations Alembic no backend do PilipLingo (SQLAlchemy async + SQLite). Use ao adicionar ou alterar tabela, coluna, indice ou constraint, ou quando o alembic acusar drift de schema.
metadata:
  author: PilipLingo
  version: 1.1.0
---

# Migrations com Alembic

Rode tudo de dentro de `backend/`.

## Como esta montado

- `migrations/env.py` le a URL de `shared.config.Settings` e o metadata de
  `orm_registry`, entao **runtime e migration nunca divergem**. Nao coloque URL
  em `alembic.ini`.
- `render_as_batch` fica ligado quando o banco e SQLite, porque `ALTER TABLE` no
  SQLite e limitado: alterar/remover coluna ou constraint exige recriar a tabela.
- `shared/database.py` define `NAMING_CONVENTION`. Constraint sem nome
  determinista nao pode ser alterada depois; nunca remova essa convencao.
- `post_write_hooks` no `alembic.ini` roda `ruff check --fix` e `ruff format` na
  migration gerada, entao o arquivo ja nasce no padrao do projeto.

## Fluxo

```bash
# 1. o model precisa estar importado em src/orm_registry.py, senao o autogenerate ignora
uv run alembic revision --autogenerate -m "descricao curta"

# 2. LEIA o arquivo gerado antes de aplicar
uv run alembic upgrade head

# 3. valide que da o caminho de volta
uv run alembic downgrade -1
uv run alembic upgrade head

# 4. confirme que nao sobrou diferenca entre models e schema
uv run alembic check
```

## Revisar o autogenerate (ele erra)

- [ ] Model importado em `src/orm_registry.py`
- [ ] `downgrade()` realmente desfaz o `upgrade()`
- [ ] Alteracao de coluna existente dentro de `batch_alter_table`
- [ ] Coluna nova `nullable=False` em tabela com dados: adicione com
      `server_default`, faca o backfill e so depois remova o default
- [ ] Indice unico de campo case-insensitive aponta para a coluna normalizada
- [ ] Nenhum `DROP TABLE`/`DROP COLUMN` que voce nao pediu (autogenerate remove o
      que nao esta no metadata)
- [ ] Renomear coluna nao vira drop+create (o autogenerate nao detecta rename;
      escreva `batch_op.alter_column(..., new_column_name=...)` na mao)

## Tipos usados no projeto

- PK: `Uuid()` gerado no dominio (`uuid4()`), nao autoincrement.
- Data/hora: `DateTime(timezone=True)`. **SQLite nao guarda timezone**, entao os
  mappers reanexam UTC na leitura (`_as_utc`). Mantenha esse cuidado.
- Lista/estrutura simples: `JSON`.
- Escopo de usuario: tabelas de negocio devem incluir
  `user_id = mapped_column(Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)`.
  Padrao estabelecido desde a migration 3 (`add_users_and_scope_data_per_user`).

## Quando o banco local ficar inconsistente

O arquivo e descartavel e esta no `.gitignore`:

```bash
rm backend/data/piliplingo.db   # PowerShell: Remove-Item backend/data/piliplingo.db
uv run alembic upgrade head
```

No Docker o banco vive no volume `backend-data` e o entrypoint roda
`alembic upgrade head` a cada start. Para zerar: `docker compose down -v`.
