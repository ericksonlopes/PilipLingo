"""add vocabulary to study_cards

Guarda os itens de vocabulario de cada frase (varias palavras/expressoes com
traducao), usados para alimentar o historico "Palavras". JSON, como
sentence_chunks. Server default '[]' para cards ja existentes no banco.

Revision ID: d4e5f6a1b2c3
Revises: af36a602c24d
Create Date: 2026-09-14 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a1b2c3"
down_revision: str | Sequence[str] | None = "af36a602c24d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default so preenche as linhas ja existentes. Depois removemos o
    # default para o schema bater com o ORM (que usa default no app, como
    # sentence_chunks) e o `alembic check` ficar limpo.
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("vocabulary", sa.JSON(), nullable=False, server_default="[]")
        )
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.alter_column("vocabulary", server_default=None, existing_type=sa.JSON())


def downgrade() -> None:
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.drop_column("vocabulary")
