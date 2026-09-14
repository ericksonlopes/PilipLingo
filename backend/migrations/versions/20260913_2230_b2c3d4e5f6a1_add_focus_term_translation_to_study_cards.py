"""add focus_term_translation to study_cards

Guarda a traducao do termo-alvo de cada card (ex.: "wake up" -> "acordar").
Nullable para compatibilidade com cards ja existentes no banco.

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-09-13 22:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a1"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("focus_term_translation", sa.String(length=240), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.drop_column("focus_term_translation")
