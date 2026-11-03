"""Outgoing email. Only reports "sent" when the provider accepted the message."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from core.config import get_settings


@dataclass
class SendResult:
    status: str  # "sent" | "failed" | "not_configured"
    provider_message_id: str | None = None
    error: str | None = None


class EmailSender:
    def send(self, *, to: str, subject: str, text: str, reply_to: str | None) -> SendResult:
        raise NotImplementedError


class ResendSender(EmailSender):
    endpoint = "https://api.resend.com/emails"

    def __init__(self, api_key: str, sender: str):
        self.api_key = api_key
        self.sender = sender

    def send(self, *, to: str, subject: str, text: str, reply_to: str | None) -> SendResult:
        payload = {"from": self.sender, "to": [to], "subject": subject, "text": text}
        if reply_to:
            payload["reply_to"] = reply_to
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(self.endpoint, headers={"Authorization": f"Bearer {self.api_key}"}, json=payload)
        except httpx.HTTPError as exc:
            return SendResult("failed", error=f"Could not reach the email provider ({type(exc).__name__}).")
        if response.status_code in (200, 201, 202):
            return SendResult("sent", provider_message_id=str(response.json().get("id") or "") or None)
        try:
            message = response.json().get("message") or response.text
        except ValueError:
            message = response.text
        return SendResult("failed", error=f"Provider error {response.status_code}: {str(message)[:300]}")


class NotConfiguredSender(EmailSender):
    def send(self, *, to: str, subject: str, text: str, reply_to: str | None) -> SendResult:
        return SendResult(
            "not_configured", error="No email provider is configured, so this reply was saved but not sent."
        )


_sender: EmailSender | None = None


def get_sender() -> EmailSender:
    global _sender
    if _sender is None:
        settings = get_settings()
        _sender = ResendSender(settings.resend_api_key, settings.mail_from) if settings.email_configured else NotConfiguredSender()
    return _sender


def set_sender(sender: EmailSender | None) -> None:
    global _sender
    _sender = sender
