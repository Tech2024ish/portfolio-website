"""Lock new tables behind RLS, import legacy contact messages, seed initial content.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = [
    "activity_log", "articles", "certifications", "contact_messages", "education", "experiences",
    "media_assets", "message_replies", "owner_sessions", "owner_users", "portfolio_projects",
    "project_images", "site_profile", "skill_categories", "skill_items",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Supabase exposes the public schema through PostgREST. With RLS enabled and
        # no policies, the anon/authenticated keys cannot read or write these tables;
        # the backend connects as the table owner and is unaffected.
        for table in NEW_TABLES:
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')

        # Bring messages submitted through the legacy /api/contact into the inbox.
        exists = bind.execute(sa.text("select to_regclass('public.contacts') is not null")).scalar()
        if exists:
            op.execute(
                """
                INSERT INTO contact_messages (created_at, name, email, subject, message, is_read, source)
                SELECT created_at, left(name, 120), left(email, 320), '', message, false, 'legacy-contact-form'
                FROM contacts
                """
            )

    from services.seed import seed_initial_content

    session = Session(bind=bind)
    seed_initial_content(session)
    session.flush()


def downgrade() -> None:
    bind = op.get_bind()
    op.execute("DELETE FROM contact_messages WHERE source = 'legacy-contact-form'")
    if bind.dialect.name == "postgresql":
        for table in NEW_TABLES:
            op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
