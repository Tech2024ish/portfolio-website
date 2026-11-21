"""Reading content in a visitor's language.

``Localized(record, "fr")`` answers every attribute like the record itself, except that a
translatable field with a French translation answers in French. Fields without a translation (and
everything in English) fall back to the record's own value, field by field, so a partly translated
record is shown partly in English rather than not at all.
"""

from __future__ import annotations

from typing import Any, Literal

PublicLanguage = Literal["en", "fr", "rw"]


class Localized:
    __slots__ = ("_record", "_values")

    def __init__(self, record: Any, lang: PublicLanguage) -> None:
        self._record = record
        translations = getattr(record, "translations", None) or {}
        self._values: dict[str, Any] = {} if lang == "en" else translations.get(lang, {})

    def __getattr__(self, name: str) -> Any:
        values = object.__getattribute__(self, "_values")
        if name in values:
            return values[name]
        return getattr(object.__getattribute__(self, "_record"), name)


def text(record: Any, lang: PublicLanguage, name: str) -> Any:
    """One field of a record in a language (English when there is no translation)."""
    return getattr(Localized(record, lang), name)
