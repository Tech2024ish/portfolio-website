"""Text normalisation shared by every request contract.

Surrounding whitespace is trimmed, runs of whitespace in single-line fields collapse to one
space, line endings become ``\\n``, and control characters are rejected (PostgreSQL text cannot
hold NUL, and none belong in user-supplied text).
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE_RUN = re.compile(r"\s+")


def no_control_characters(value: str) -> str:
    if _CONTROL.search(value):
        raise ValueError("Contains characters that are not allowed.")
    return value


def single_line(value: str) -> str:
    return _WHITESPACE_RUN.sub(" ", no_control_characters(value)).strip()


def multi_line(value: str) -> str:
    return no_control_characters(value.replace("\r\n", "\n").replace("\r", "\n")).strip()


SingleLine = Annotated[str, AfterValidator(single_line)]
MultiLine = Annotated[str, AfterValidator(multi_line)]
