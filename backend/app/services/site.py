"""Website settings: read with defaults, saved with a version check and audited."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.site import DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_TITLE, SiteSettings
from app.schemas.site import SettingsFields, SettingsOut, SettingsUpdate
from app.services import audit
from app.services.auth import OwnerContext

DEFAULTS = SettingsFields(seo_title=DEFAULT_SEO_TITLE, seo_description=DEFAULT_SEO_DESCRIPTION)


def current(session: Session) -> SettingsFields:
    """The settings in force: the saved row, or the defaults when none was saved."""
    row = session.get(SiteSettings, 1)
    return SettingsFields.model_validate(row, from_attributes=True) if row else DEFAULTS


def read(session: Session) -> SettingsOut:
    row = session.get(SiteSettings, 1)
    if row is None:
        return SettingsOut(**DEFAULTS.model_dump(), version=0, updated_at=None)
    return SettingsOut.model_validate(row)


def save(session: Session, owner: OwnerContext, body: SettingsUpdate) -> SettingsOut:
    row = session.get(SiteSettings, 1, with_for_update=True)
    current_version = row.version if row else 0
    if body.version != current_version:
        raise AppError(
            409,
            "conflict",
            "The settings were changed after you opened them. Reload to see the latest.",
        )
    values = body.model_dump(exclude={"version"})
    now = datetime.now(UTC)
    if row is None:
        row = SiteSettings(id=1, **values, version=1, updated_at=now)
        session.add(row)
        changed = list(values)
    else:
        changed = [name for name, value in values.items() if getattr(row, name) != value]
        for name, value in values.items():
            setattr(row, name, value)
        if changed:
            row.version += 1
            row.updated_at = now
    session.flush()
    if changed:
        audit.record(
            session,
            owner,
            action="update",
            entity_type="settings",
            entity_id=None,
            summary="Edited the website settings",
            changed_fields=changed,
        )
    return SettingsOut.model_validate(row)
