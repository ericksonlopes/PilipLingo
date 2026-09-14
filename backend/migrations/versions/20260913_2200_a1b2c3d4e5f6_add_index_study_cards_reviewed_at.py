"""add index study_cards reviewed_at

O historico de frases e palavras vistas filtra e ordena por reviewed_at com
frequencia. Sem o indice cada consulta faz full-scan em study_cards.

Revision ID: a1b2c3d4e5f6
Revises: cbf65869f0a5
Create Date: 2026-09-13 22:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "cbf65869f0a5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Adiciona indice em study_cards.reviewed_at."""
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_study_cards_reviewed_at"),
            ["reviewed_at"],
            unique=False,
        )


def downgrade() -> None:
    """Remove indice em study_cards.reviewed_at."""
    with op.batch_alter_table("study_cards", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_study_cards_reviewed_at"))
