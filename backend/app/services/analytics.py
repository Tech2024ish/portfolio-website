"""Page-view analytics from views browsers actually report, without personal data.

Recording (``record_view``) skips, silently:
- visitors who send Do Not Track or Global Privacy Control;
- crawlers, link previews and scripts (by user agent), and requests without a user agent;
- the owner (a request carrying the owner session cookie);
- anything that is not a public page that exists: unknown paths and unpublished project or note
  slugs are never counted;
- more than ``MAX_VIEWS_PER_VISITOR_DAY`` views from one visitor in a day (inflation guard).

Nothing identifying is stored: the visitor hash is an HMAC of address and user agent under a key
that exists for one day and is deleted two days later, so a visitor can be counted once per day but
never recognised later. Statistics are computed only from recorded rows; days before recording
began are reported as such, not as zero traffic.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import UTC, date, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.content import Project
from app.models.site import AnalyticsKey, PageView
from app.repositories import content as content_repository
from app.schemas.site import AnalyticsSummary, CountItem, DailyCount

MAX_VIEWS_PER_VISITOR_DAY = 200
MAX_RANGE_DAYS = 366
_SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
_PAGE = re.compile(rf"^/(?:projects(?:/(?P<project>{_SLUG}))?|notes(?:/(?P<note>{_SLUG}))?)?$")
_BOT = re.compile(
    r"bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|curl|wget|python|httpx|"
    r"axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|embedly|whatsapp|telegram",
    re.IGNORECASE,
)


def today() -> date:
    return datetime.now(UTC).date()


def device_of(user_agent: str) -> str:
    if re.search(r"ipad|tablet|kindle|silk", user_agent, re.IGNORECASE):
        return "tablet"
    if re.search(r"mobi|iphone|android", user_agent, re.IGNORECASE):
        return "mobile"
    return "desktop"


def referrer_host(referrer: str | None, own_host: str) -> str | None:
    """Only the referring site's host name, and none for internal navigation."""
    if not referrer:
        return None
    try:
        host = (urlsplit(referrer).hostname or "").lower()
    except ValueError:
        return None
    if not host or host == own_host or host in ("localhost", "127.0.0.1"):
        return None
    return host[:253]


def _page_exists(session: Session, path: str) -> bool:
    match = _PAGE.match(path)
    if match is None:
        return False
    if match.group("project"):
        return content_repository.published_project(session, match.group("project")) is not None
    if match.group("note"):
        return content_repository.published_article(session, match.group("note")) is not None
    return True


def _daily_secret(session: Session, day: date) -> str:
    session.execute(
        insert(AnalyticsKey)
        .values(day=day, secret=secrets.token_hex(32))
        .on_conflict_do_nothing(index_elements=["day"])
    )
    # Yesterday's key is kept so views around midnight UTC still resolve; older keys go.
    session.execute(delete(AnalyticsKey).where(AnalyticsKey.day < day - timedelta(days=1)))
    secret = session.scalar(select(AnalyticsKey.secret).where(AnalyticsKey.day == day))
    if secret is None:  # inserted just above in this transaction
        raise RuntimeError("analytics key missing")
    return secret


def record_view(
    session: Session,
    *,
    path: str,
    referrer: str | None,
    user_agent: str | None,
    client_address: str,
    is_owner: bool,
    opted_out: bool,
    own_host: str,
) -> bool:
    """Record one page view if it should count. Returns whether it was recorded."""
    if opted_out or is_owner or not user_agent or _BOT.search(user_agent):
        return False
    if not _page_exists(session, path):
        return False
    day = today()
    secret = _daily_secret(session, day)
    visitor = hmac.new(
        secret.encode(), f"{client_address}\n{user_agent}".encode(), hashlib.sha256
    ).hexdigest()
    seen = session.scalar(
        select(func.count())
        .select_from(PageView)
        .where(PageView.day == day, PageView.visitor_hash == visitor)
    )
    if (seen or 0) >= MAX_VIEWS_PER_VISITOR_DAY:
        return False
    session.add(
        PageView(
            day=day,
            path=path,
            referrer_host=referrer_host(referrer, own_host),
            device=device_of(user_agent),
            visitor_hash=visitor,
        )
    )
    session.flush()
    return True


def _range(start: date | None, end: date | None) -> tuple[date, date]:
    end = end or today()
    start = start or end - timedelta(days=29)
    if start > end:
        raise AppError(
            422,
            "validation_error",
            "The start date is after the end date.",
            fields=[
                {"field": "start", "message": "Choose a start date on or before the end date."}
            ],
        )
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise AppError(
            422,
            "validation_error",
            "Choose at most a year.",
            fields=[{"field": "start", "message": f"At most {MAX_RANGE_DAYS} days."}],
        )
    return start, end


def summary(session: Session, start: date | None, end: date | None) -> AnalyticsSummary:
    start, end = _range(start, end)
    in_range = (PageView.day >= start, PageView.day <= end)
    # A visitor is distinct per day (hashes cannot be linked across days).
    visitor_day = func.count(func.distinct(func.concat(PageView.day, ":", PageView.visitor_hash)))

    totals = session.execute(select(func.count(), visitor_day).where(*in_range)).one()
    by_day = {
        row.day: (row.views, row.visitors)
        for row in session.execute(
            select(
                PageView.day,
                func.count().label("views"),
                func.count(func.distinct(PageView.visitor_hash)).label("visitors"),
            )
            .where(*in_range)
            .group_by(PageView.day)
        )
    }
    daily = [
        DailyCount(
            day=start + timedelta(days=n),
            views=by_day.get(start + timedelta(days=n), (0, 0))[0],
            visitors=by_day.get(start + timedelta(days=n), (0, 0))[1],
        )
        for n in range((end - start).days + 1)
    ]

    def counted(column, *where, limit: int = 10) -> list[tuple[str | None, int, int]]:  # type: ignore[no-untyped-def]
        rows = session.execute(
            select(column, func.count().label("views"), visitor_day.label("visitors"))
            .where(*in_range, *where)
            .group_by(column)
            .order_by(func.count().desc(), column)
            .limit(limit)
        )
        return [(row[0], int(row.views), int(row.visitors)) for row in rows]

    titles = {
        str(slug): str(title)
        for slug, title in session.execute(
            select(Project.slug, Project.title).where(Project.deleted_at.is_(None))
        )
    }
    projects = [
        CountItem(
            label=titles.get(path.removeprefix("/projects/"), path.removeprefix("/projects/")),
            views=views,
            visitors=visitors,
        )
        for path, views, visitors in counted(PageView.path, PageView.path.like("/projects/%"))
        if path
    ]
    referrers = [
        CountItem(label=host or "Direct or unknown", views=views, visitors=visitors)
        for host, views, visitors in counted(PageView.referrer_host)
    ]
    return AnalyticsSummary(
        start=start,
        end=end,
        recording_since=session.scalar(select(func.min(PageView.day))),
        views=int(totals[0]),
        visitors=int(totals[1]),
        daily=daily,
        pages=[
            CountItem(label=path or "", views=v, visitors=u)
            for path, v, u in counted(PageView.path)
        ],
        projects=projects,
        referrers=referrers,
        devices=[
            CountItem(label=d or "", views=v, visitors=u) for d, v, u in counted(PageView.device)
        ],
    )
