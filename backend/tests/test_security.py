"""Password hashing, legacy (V2) verification, password policy and tokens. No database."""

from __future__ import annotations

import base64
import hashlib
import secrets

from argon2 import PasswordHasher

from app.core import security

PASSWORD = "Correct-Horse-9-battery"


def v2_scrypt_hash(password: str) -> str:
    """Exactly the V2 algorithm (backend/legacy/core/security.py), to test real legacy hashes."""

    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode().rstrip("=")

    n, r, p = 2**15, 8, 1
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=n, r=r, p=p, maxmem=64 * 1024 * 1024, dklen=32
    )
    return f"scrypt${n}${r}${p}${b64(salt)}${b64(digest)}"


def test_new_hashes_are_argon2id_and_verify() -> None:
    encoded = security.hash_password(PASSWORD)
    assert encoded.startswith("$argon2id$")
    assert security.verify_password(PASSWORD, encoded)
    assert not security.verify_password(PASSWORD + "x", encoded)
    assert not security.needs_rehash(encoded)


def test_hashes_are_salted() -> None:
    assert security.hash_password(PASSWORD) != security.hash_password(PASSWORD)


def test_legacy_scrypt_hashes_verify_and_need_rehash() -> None:
    legacy = v2_scrypt_hash(PASSWORD)
    assert security.verify_password(PASSWORD, legacy)
    assert not security.verify_password("Wrong-password-1", legacy)
    assert security.needs_rehash(legacy)


def test_weaker_argon2_parameters_need_rehash() -> None:
    weak = PasswordHasher(time_cost=1, memory_cost=8 * 1024, parallelism=1).hash(PASSWORD)
    assert security.verify_password(PASSWORD, weak)
    assert security.needs_rehash(weak)


def test_malformed_or_foreign_hashes_never_verify() -> None:
    for encoded in ("", "plain-text", "scrypt$1$2", "scrypt$x$y$z$salt$digest", "$argon2id$broken"):
        assert not security.verify_password(PASSWORD, encoded)


def test_unknown_accounts_still_spend_a_verification() -> None:
    # Must run without raising for any input; its cost is that of one Argon2id verification.
    security.burn_verification_time(PASSWORD)
    security.burn_verification_time("")


def test_password_policy() -> None:
    assert security.password_problems(PASSWORD) == []
    assert security.password_problems("Short-1a") == ["Use at least 12 characters."]
    assert "Do not start or end with spaces." in security.password_problems(f" {PASSWORD}")
    assert security.password_problems("alllowercaseletters") == [
        "Mix at least three of: lowercase, uppercase, digits, symbols."
    ]
    assert "Use at most 256 characters." in security.password_problems("Aa1-" * 70)


def test_session_tokens_are_random_and_stored_only_as_digests() -> None:
    tokens = {security.new_session_token() for _ in range(100)}
    assert len(tokens) == 100
    token = tokens.pop()
    assert len(token) >= 43  # 256 bits in URL-safe base64
    digest = security.token_digest(token)
    assert len(digest) == 64 and token not in digest


def test_csrf_tokens_are_bound_to_the_session() -> None:
    token, other = security.new_session_token(), security.new_session_token()
    csrf = security.csrf_token_for(token)
    assert security.csrf_token_matches(token, csrf)
    assert not security.csrf_token_matches(other, csrf)
    assert not security.csrf_token_matches(token, None)
    assert not security.csrf_token_matches(token, "")
    assert token not in csrf
