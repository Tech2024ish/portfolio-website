"""French and Kinyarwanda translations of the portfolio content.

Adds a ``translations`` JSONB column (``{"fr": {field: value}, "rw": {...}}``, empty by default) to
every table whose text the public site shows. Existing rows keep their English text and get an
empty object, so the site is unchanged until translations are added. No other change.

Revision ID: v3_0008
Revises: v3_0007
Create Date: 2026-11-21 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v3_0008"
down_revision: str | Sequence[str] | None = "v3_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "profile",
    "skill_categories",
    "experiences",
    "education",
    "certifications",
    "projects",
    "articles",
    "site_settings",
)


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "translations",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    # Removes every translation; the English content is untouched.
    for table in TABLES:
        op.drop_column(table, "translations")
