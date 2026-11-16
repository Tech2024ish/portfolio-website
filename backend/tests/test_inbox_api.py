"""The owner inbox and the email outbox, against real PostgreSQL with a fake email provider."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import MailProvider, Settings
from app.database.session import Database
from app.integrations import email as email_module
from app.integrations.email import Email, PermanentMailError, ResendMailer, TransientMailError
from app.services import mail
from tests.conftest import ORIGIN, csrf_headers, libpq_url, signed_in

pytestmark = pytest.mark.postgres

Query = Callable[..., list[tuple[Any, ...]]]

MESSAGE = {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "subject": "Backend role",
    "message": "Hello, I would like to talk about a backend role.",
}
MAIL = {
    "mail_provider": MailProvider.RESEND,
    "resend_api_key": "re_test",
    "mail_from": "Portfolio <hello@example.com>",
    "mail_reply_to": "owner@example.com",
    "contact_notify_email": "owner-inbox@example.com",
}


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[Email] = []
        self.failures: list[Exception] = []

    def send(self, email: Email) -> str:
        if self.failures:
            raise self.failures.pop(0)
        self.sent.append(email)
        return f"provider-{len(self.sent)}"


@pytest.fixture
def execute(clean_database: str) -> Callable[[str], None]:
    """Run a statement that returns no rows (the ``query`` fixture expects rows)."""

    def run(sql: str) -> None:
        with psycopg.connect(libpq_url(clean_database)) as conn:
            conn.execute(sql)

    return run


@pytest.fixture
def mailer(monkeypatch: pytest.MonkeyPatch) -> FakeMailer:
    fake = FakeMailer()
    monkeypatch.setattr(
        mail, "mailer_for", lambda settings: fake if settings.email_configured else None
    )
    return fake


@pytest.fixture
def api(make_api: Callable[..., TestClient], owner: int) -> TestClient:
    return make_api(**MAIL, contact_rate_limit=100)


def contact(client: TestClient, **overrides: str) -> Any:
    return client.post("/api/v1/contact", json={**MESSAGE, **overrides})


def deliveries(query: Query) -> list[tuple[Any, ...]]:
    return query(
        "select kind, status, attempts, recipient, last_error from email_deliveries order by id"
    )


# ------------------------------------------------------------------ notifications


def test_a_new_message_is_stored_and_the_owner_is_notified(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    response = contact(api)
    assert response.status_code == 201
    assert response.json() == {"status": "received"}  # never claims anything about email
    assert query("select status from contact_messages") == [("new",)]
    [sent] = mailer.sent
    assert sent.to == "owner-inbox@example.com"
    assert sent.reply_to == "ada@example.com"  # the owner can answer straight from the inbox
    assert "Backend role" in sent.subject and "/owner/messages/" in sent.text
    assert deliveries(query) == [("notification", "sent", 1, "owner-inbox@example.com", None)]


def test_a_provider_outage_keeps_the_message_and_retries_later(
    api: TestClient,
    mailer: FakeMailer,
    query: Query,
    make_auth_settings: Callable[..., Settings],
    execute: Callable[[str], None],
) -> None:
    mailer.failures.append(TransientMailError("Resend answered 503"))
    assert contact(api).status_code == 201
    assert query("select count(*) from contact_messages") == [(1,)]
    [(status, attempts, error, due)] = query(
        "select status, attempts, last_error, next_attempt_at > now() from email_deliveries"
    )
    assert (status, attempts, error, due) == ("pending", 1, "Resend answered 503", True)

    # Not due yet: nothing is sent.
    settings = make_auth_settings(**MAIL)
    database = Database(settings)
    assert mail.process_due(database, settings) == 0
    execute("update email_deliveries set next_attempt_at = now() - interval '1 second'")
    assert mail.process_due(database, settings) == 1
    database.dispose()
    assert deliveries(query)[0][:3] == ("notification", "sent", 2)
    assert len(mailer.sent) == 1


def test_attempts_stop_after_the_limit(
    make_api: Callable[..., TestClient], owner: int, mailer: FakeMailer, query: Query
) -> None:
    client = make_api(**MAIL, mail_max_attempts=1)
    mailer.failures.append(TransientMailError("Resend unreachable (ConnectError)"))
    contact(client)
    assert deliveries(query)[0][:3] == ("notification", "failed", 1)


def test_a_failed_notification_can_be_sent_again(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    mailer.failures.append(PermanentMailError("Resend answered 403"))
    contact(api)
    assert deliveries(query)[0][1] == "failed"
    headers = csrf_headers(signed_in(api))
    [(delivery_id,)] = query("select id from email_deliveries")
    response = api.post(f"/api/v1/owner/deliveries/{delivery_id}/retry", headers=headers)
    assert response.status_code == 202
    assert deliveries(query)[0][:3] == ("notification", "sent", 1)
    assert (
        api.post(f"/api/v1/owner/deliveries/{delivery_id}/retry", headers=headers).status_code
        == 409
    )


def test_without_an_email_provider_nothing_is_sent_and_it_says_so(
    make_api: Callable[..., TestClient], owner: int, mailer: FakeMailer, query: Query
) -> None:
    client = make_api()  # MAIL_PROVIDER=disabled
    assert contact(client).status_code == 201
    [(kind, status, attempts, _, error)] = deliveries(query)
    assert (kind, status, attempts) == ("notification", "skipped", 0)
    assert "not configured" in error
    assert mailer.sent == []
    headers = csrf_headers(signed_in(client))
    [(message_id,)] = query("select id from contact_messages")
    refused = client.post(
        f"/api/v1/owner/messages/{message_id}/reply", json={"body": "Thanks!"}, headers=headers
    )
    assert refused.status_code == 503


def test_resubmitting_the_same_message_is_stored_and_notified_once(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    first = contact(api)
    again = contact(api, message="  Hello, I would like to talk about a   backend role. ")
    assert first.json() == again.json() == {"status": "received"}
    assert query("select count(*) from contact_messages") == [(1,)]
    assert len(mailer.sent) == 1
    contact(api, subject="Another topic")
    assert query("select count(*) from contact_messages") == [(2,)]


def test_link_spam_is_kept_for_review_but_never_notified(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    links = " ".join(f"https://spam.example/{n}" for n in range(5))
    contact(api, message=f"Cheap offers here {links}")
    contact(api, subject="Markup", message='Visit <a href="https://x.example">now</a> please')
    assert query("select status, spam_reason from contact_messages order by id") == [
        ("spam", "many links"),
        ("spam", "link markup"),
    ]
    assert mailer.sent == [] and deliveries(query) == []


def test_honeypot_submissions_are_neither_stored_nor_notified(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    assert contact(api, website="https://bot.example").status_code == 201
    assert query("select count(*) from contact_messages") == [(0,)]
    assert mailer.sent == []


def test_a_delivery_being_sent_is_not_sent_twice(
    api: TestClient,
    mailer: FakeMailer,
    query: Query,
    make_auth_settings: Callable[..., Settings],
    execute: Callable[[str], None],
) -> None:
    mailer.failures.append(TransientMailError("Resend answered 503"))
    contact(api)
    execute(
        "update email_deliveries set status = 'sending', updated_at = now(), next_attempt_at = null"
    )
    settings = make_auth_settings(**MAIL)
    database = Database(settings)
    assert mail.process_due(database, settings) == 0  # another worker is on it
    execute("update email_deliveries set updated_at = now() - interval '11 minutes'")
    assert mail.process_due(database, settings) == 1  # that worker died: picked up again
    database.dispose()
    assert deliveries(query)[0][1] == "sent"


# ------------------------------------------------------------------ the owner inbox


def test_the_inbox_lists_searches_filters_and_pages(api: TestClient, mailer: FakeMailer) -> None:
    for n in range(25):
        contact(api, subject=f"Topic {n:02d}", email=f"v{n}@example.com")
    contact(api, subject="100% match_here", email="special@example.com")
    signed_in(api)
    page = api.get("/api/v1/owner/messages", params={"page": 2, "page_size": 10}).json()
    assert page["total"] == 26 and len(page["items"]) == 10 and page["page"] == 2
    first = api.get("/api/v1/owner/messages").json()["items"][0]
    assert first["subject"] == "100% match_here" and first["notification"] == "sent"
    found = api.get("/api/v1/owner/messages", params={"q": "100%"}).json()
    assert [item["email"] for item in found["items"]] == ["special@example.com"]
    assert api.get("/api/v1/owner/messages", params={"q": "_"}).json()["total"] == 1  # literal _
    assert api.get("/api/v1/owner/messages", params={"status": "archived"}).json()["total"] == 0
    assert api.get("/api/v1/owner/messages", params={"status": "junk"}).status_code == 422


def test_the_inbox_is_for_the_owner_only(api: TestClient, mailer: FakeMailer, query: Query) -> None:
    contact(api)
    [(message_id,)] = query("select id from contact_messages")
    assert api.get("/api/v1/owner/messages").status_code == 401
    assert api.get(f"/api/v1/owner/messages/{message_id}").status_code == 401
    signed_in(api)
    without_csrf = api.patch(
        f"/api/v1/owner/messages/{message_id}", json={"status": "read"}, headers={"Origin": ORIGIN}
    )
    assert without_csrf.status_code == 403
    assert (
        api.delete(f"/api/v1/owner/messages/{message_id}", headers={"Origin": ORIGIN}).status_code
        == 403
    )


def test_status_changes_are_audited_without_the_message(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    contact(api)
    headers = csrf_headers(signed_in(api))
    [(message_id,)] = query("select id from contact_messages")
    read = api.patch(
        f"/api/v1/owner/messages/{message_id}", json={"status": "read"}, headers=headers
    )
    assert read.json()["status"] == "read" and read.json()["read_at"]
    api.patch(f"/api/v1/owner/messages/{message_id}", json={"status": "archived"}, headers=headers)
    events = json.dumps(api.get("/api/v1/owner/activity").json())
    assert "from read to archived" in events
    assert "Ada" not in events and "backend role" not in events
    counts = api.get("/api/v1/owner/dashboard").json()["messages"]
    assert counts == {"new": 0, "read": 0, "archived": 1, "spam": 0}


def test_deleting_a_message_removes_it_and_its_emails(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    contact(api)
    headers = csrf_headers(signed_in(api))
    [(message_id,)] = query("select id from contact_messages")
    assert api.delete(f"/api/v1/owner/messages/{message_id}", headers=headers).status_code == 204
    assert query("select count(*) from contact_messages") == [(0,)]
    assert query("select count(*) from email_deliveries") == [(0,)]
    assert api.get(f"/api/v1/owner/messages/{message_id}").status_code == 404


def test_replies_are_sent_to_the_visitor_and_tracked(
    api: TestClient, mailer: FakeMailer, query: Query
) -> None:
    contact(api)
    headers = csrf_headers(signed_in(api))
    [(message_id,)] = query("select id from contact_messages")
    response = api.post(
        f"/api/v1/owner/messages/{message_id}/reply",
        json={"body": "Thank you, Ada. Let us talk on Monday."},
        headers=headers,
    )
    assert response.status_code == 202
    reply = mailer.sent[-1]
    assert (reply.to, reply.subject) == ("ada@example.com", "Re: Backend role")
    detail = api.get(f"/api/v1/owner/messages/{message_id}").json()
    assert [(d["kind"], d["status"]) for d in detail["deliveries"]] == [
        ("notification", "sent"),
        ("reply", "sent"),
    ]
    assert detail["email_configured"] is True


# ------------------------------------------------------------------ providers and settings


def test_resend_classifies_provider_answers() -> None:
    answers = iter(
        [
            httpx.Response(200, json={"id": "abc"}),
            httpx.Response(429),
            httpx.Response(422),
            httpx.Response(500),
        ]
    )
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return next(answers)

    mailer = ResendMailer(
        "re_key",
        "Portfolio <hello@example.com>",
        httpx.Client(transport=httpx.MockTransport(handler)),
    )
    email = Email(to="a@example.com", subject="Hi", text="Hello", reply_to="b@example.com")
    assert mailer.send(email) == "abc"
    assert json.loads(seen[0].content)["reply_to"] == "b@example.com"
    assert seen[0].headers["authorization"] == "Bearer re_key"
    with pytest.raises(TransientMailError):
        mailer.send(email)
    with pytest.raises(PermanentMailError):
        mailer.send(email)
    with pytest.raises(TransientMailError):
        mailer.send(email)


def test_resend_network_errors_are_transient() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    mailer = ResendMailer(
        "re_key", "x@example.com", httpx.Client(transport=httpx.MockTransport(handler))
    )
    with pytest.raises(TransientMailError, match="ConnectError"):
        mailer.send(Email(to="a@example.com", subject="s", text="t"))


def test_production_refuses_smtp_and_incomplete_resend(
    make_settings: Callable[..., Settings],
) -> None:
    base = {
        "environment": "production",
        "database_url": "postgresql://u:p@db.example/x",
        "cookie_secure": True,
        "cors_origins": ["https://site.example"],
        "public_site_url": "https://site.example",
    }
    with pytest.raises(ValueError, match="MAIL_PROVIDER=smtp is for controlled testing only"):
        make_settings(**base, mail_provider="smtp")
    with pytest.raises(ValueError, match="CONTACT_NOTIFY_EMAIL are required"):
        make_settings(**base, mail_provider="resend", resend_api_key="k", mail_from="a@example.com")


def test_unconfigured_providers_have_no_mailer(make_settings: Callable[..., Settings]) -> None:
    assert email_module.mailer_for(make_settings()) is None
    smtp = make_settings(
        mail_provider="smtp",
        mail_from="a@example.com",
        smtp_host="smtp.gmail.com",
        smtp_username="u",
        smtp_password="p",
    )
    assert isinstance(email_module.mailer_for(smtp), email_module.SmtpMailer)
