"""Sending email through the configured provider.

``send`` returns the provider's message id when the provider accepted the email, and raises
``TransientMailError`` (worth retrying: network errors, timeouts, rate limits, 5xx) or
``PermanentMailError`` (retrying cannot help: rejected address, bad credentials, 4xx). Error
messages describe the failure without credentials or response bodies.

- Resend: HTTPS API, for production.
- SMTP with STARTTLS: for controlled testing only, for example Gmail with an app password.
  Refused in production by the settings.
"""

from __future__ import annotations

import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import make_msgid
from typing import Protocol

import httpx

from app.core.config import MailProvider, Settings

TIMEOUT_SECONDS = 15.0


class MailError(Exception):
    pass


class TransientMailError(MailError):
    pass


class PermanentMailError(MailError):
    pass


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str
    reply_to: str | None = None


class Mailer(Protocol):
    def send(self, email: Email) -> str: ...


class ResendMailer:
    URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str, sender: str, client: httpx.Client | None = None) -> None:
        self.api_key = api_key
        self.sender = sender
        self.client = client or httpx.Client(timeout=TIMEOUT_SECONDS)

    def send(self, email: Email) -> str:
        payload: dict[str, object] = {
            "from": self.sender,
            "to": [email.to],
            "subject": email.subject,
            "text": email.text,
        }
        if email.reply_to:
            payload["reply_to"] = email.reply_to
        try:
            response = self.client.post(
                self.URL, json=payload, headers={"Authorization": f"Bearer {self.api_key}"}
            )
        except httpx.HTTPError as error:
            raise TransientMailError(f"Resend unreachable ({type(error).__name__})") from error
        if response.status_code in (200, 201):
            try:
                return str(response.json()["id"])
            except (ValueError, KeyError, TypeError):
                return ""
        detail = f"Resend answered {response.status_code}"
        if response.status_code == 429 or response.status_code >= 500:
            raise TransientMailError(detail)
        raise PermanentMailError(detail)


class SmtpMailer:
    def __init__(self, host: str, port: int, username: str, password: str, sender: str) -> None:
        self.host, self.port = host, port
        self.username, self.password = username, password
        self.sender = sender

    def send(self, email: Email) -> str:
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = email.to
        message["Subject"] = email.subject
        message_id = make_msgid()
        message["Message-ID"] = message_id
        if email.reply_to:
            message["Reply-To"] = email.reply_to
        message.set_content(email.text)
        try:
            with smtplib.SMTP(self.host, self.port, timeout=TIMEOUT_SECONDS) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(self.username, self.password)
                smtp.send_message(message)
        except smtplib.SMTPAuthenticationError as error:
            raise PermanentMailError("SMTP sign-in refused") from error
        except smtplib.SMTPRecipientsRefused as error:
            raise PermanentMailError("SMTP refused the recipient") from error
        except smtplib.SMTPResponseException as error:
            detail = f"SMTP answered {error.smtp_code}"
            if 400 <= error.smtp_code < 500:
                raise TransientMailError(detail) from error
            raise PermanentMailError(detail) from error
        except (TimeoutError, OSError, smtplib.SMTPException) as error:
            raise TransientMailError(f"SMTP unreachable ({type(error).__name__})") from error
        return message_id


def mailer_for(settings: Settings) -> Mailer | None:
    """The configured mailer, or None when email is not configured (nothing is sent)."""
    if not settings.email_configured or not settings.mail_from:
        return None
    if settings.mail_provider is MailProvider.RESEND and settings.resend_api_key:
        return ResendMailer(settings.resend_api_key.get_secret_value(), settings.mail_from)
    if (
        settings.mail_provider is MailProvider.SMTP
        and settings.smtp_host
        and settings.smtp_username
        and settings.smtp_password
    ):
        return SmtpMailer(
            settings.smtp_host,
            settings.smtp_port,
            settings.smtp_username,
            settings.smtp_password.get_secret_value(),
            settings.mail_from,
        )
    return None
