"""Owner password hashing, session tokens and CSRF tokens.

Passwords
- New hashes use Argon2id with the RFC 9106 low-memory profile (t=3, m=64 MiB, p=4).
- Hashes from the V2 backend (``scrypt$N$r$p$salt$digest``) are still verified, so the owner
  keeps access after migration; ``needs_rehash`` reports them so the caller re-hashes the
  password with Argon2id after a successful sign-in. Argon2id hashes made with older
  parameters are upgraded the same way.
- Verification of an unknown account runs against a dummy hash, so response time does not
  reveal whether an email belongs to the owner.

Tokens
- A session token is 256 random bits, sent only in an HttpOnly cookie. The database stores its
  SHA-256 digest, so a database leak does not expose usable sessions.
- The CSRF token is an HMAC of the session token. JavaScript can read it from the session
  response but cannot derive it without the HttpOnly cookie, and nothing extra is stored.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.profiles import RFC_9106_LOW_MEMORY

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 256

_hasher = PasswordHasher.from_parameters(RFC_9106_LOW_MEMORY)

# ------------------------------------------------------------------ legacy scrypt (V2)

_SCRYPT_PREFIX = "scrypt$"
_SCRYPT_MAXMEM = 64 * 1024 * 1024


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _verify_scrypt(password: str, encoded: str) -> bool:
    """Verify a V2 hash: ``scrypt$N$r$p$salt$digest`` with URL-safe base64, no padding."""
    try:
        _scheme, n, r, p, salt, digest = encoded.split("$")
        expected = _unb64(digest)
        actual = hashlib.scrypt(
            password.encode(),
            salt=_unb64(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            maxmem=_SCRYPT_MAXMEM,
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# ------------------------------------------------------------------ passwords


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    if encoded.startswith(_SCRYPT_PREFIX):
        return _verify_scrypt(password, encoded)
    try:
        return _hasher.verify(encoded, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(encoded: str) -> bool:
    """True for legacy scrypt hashes and for Argon2id hashes made with older parameters."""
    if encoded.startswith(_SCRYPT_PREFIX):
        return True
    try:
        return _hasher.check_needs_rehash(encoded)
    except InvalidHashError:
        return True


@lru_cache(maxsize=1)
def _dummy_hash() -> str:
    return hash_password(secrets.token_urlsafe(16))


def burn_verification_time(password: str) -> None:
    """Spend the time of one real verification, for sign-ins to an unknown email."""
    verify_password(password, _dummy_hash())


def password_problems(password: str) -> list[str]:
    """Reasons a new password is rejected; empty when it is acceptable (V2 rules kept)."""
    problems: list[str] = []
    if len(password) < MIN_PASSWORD_LENGTH:
        problems.append(f"Use at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password) > MAX_PASSWORD_LENGTH:
        problems.append(f"Use at most {MAX_PASSWORD_LENGTH} characters.")
    if password.strip() != password:
        problems.append("Do not start or end with spaces.")
    classes = sum(
        [
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        ]
    )
    if classes < 3:
        problems.append("Mix at least three of: lowercase, uppercase, digits, symbols.")
    return problems


# ------------------------------------------------------------------ tokens


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token_for(session_token: str) -> str:
    return hmac.new(session_token.encode(), b"owner-csrf-v1", hashlib.sha256).hexdigest()


def csrf_token_matches(session_token: str, presented: str | None) -> bool:
    if not presented:
        return False
    return hmac.compare_digest(csrf_token_for(session_token), presented)
