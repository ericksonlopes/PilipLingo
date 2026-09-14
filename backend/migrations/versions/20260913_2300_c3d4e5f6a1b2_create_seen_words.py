"""create seen_words

Tabela de palavras individuais vistas pelo usuario em sessoes de estudo.
Traduzidas pelo deep-translator (EN->PT-BR) e armazenadas com contagem de
exposicao e timestamps de primeira/ultima visualizacao.

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-09-13 23:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a1b2"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "seen_words",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("word", sa.String(length=120), nullable=False),
        sa.Column("word_normalized", sa.String(length=120), nullable=False),
        sa.Column("translation", sa.String(length=240), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("seen_count", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_seen_words")),
        sa.UniqueConstraint("user_id", "word_normalized", name="uq_seen_words_user_word"),
    )
    with op.batch_alter_table("seen_words", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_seen_words_user_id"), ["user_id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_seen_words_first_seen_at"), ["first_seen_at"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_seen_words_last_seen_at"), ["last_seen_at"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("seen_words", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_seen_words_last_seen_at"))
        batch_op.drop_index(batch_op.f("ix_seen_words_first_seen_at"))
        batch_op.drop_index(batch_op.f("ix_seen_words_user_id"))
    op.drop_table("seen_words")
