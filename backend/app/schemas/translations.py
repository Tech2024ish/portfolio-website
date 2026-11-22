"""French and Kinyarwanda versions of content fields.

A translatable record carries ``translations``: ``{"fr": {field: value}, "rw": {field: value}}``.
Only the fields a schema lists in ``TRANSLATABLE`` may appear, and each value is validated with
that field's own type and limits (a French summary has the same rules as the English one). A
blank value is dropped: the field is then shown in English. English stays in the regular fields.
"""

from __future__ import annotations

from functools import cache
from typing import Annotated, Any, ClassVar, Literal

from pydantic import BaseModel, Field, TypeAdapter, ValidationError, field_validator
from pydantic_core import PydanticCustomError

LANGUAGES: tuple[str, ...] = ("fr", "rw")
Language = Literal["fr", "rw"]
LANGUAGE_NAMES = {"fr": "French", "rw": "Kinyarwanda"}
Translations = dict[Language, dict[str, Any]]


def _blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip()) or value == []


@cache
def _adapter(schema: type[BaseModel], name: str) -> TypeAdapter[Any]:
    info = schema.model_fields[name]
    return TypeAdapter(Annotated[info.annotation, *info.metadata])  # type: ignore[arg-type]


class Translatable(BaseModel):
    """Mixin: adds a validated ``translations`` field for the names in ``TRANSLATABLE``."""

    TRANSLATABLE: ClassVar[tuple[str, ...]] = ()

    translations: Translations = Field(default_factory=dict)

    @field_validator("translations")
    @classmethod
    def _check_translations(cls, value: Translations) -> Translations:
        cleaned: Translations = {}
        for lang, fields in value.items():
            kept: dict[str, Any] = {}
            for name, text in fields.items():
                if name not in cls.TRANSLATABLE:
                    raise PydanticCustomError(
                        "not_translatable", "“{name}” cannot be translated.", {"name": name}
                    )
                if _blank(text):
                    continue
                adapter = _adapter(cls, name)
                try:
                    kept[name] = adapter.dump_python(adapter.validate_python(text), mode="json")
                except ValidationError as error:
                    detail = error.errors()[0]["msg"]
                    raise PydanticCustomError(
                        "invalid_translation",
                        "{language} “{name}”: {detail}",
                        {"language": LANGUAGE_NAMES[lang], "name": name, "detail": detail},
                    ) from None
            if kept:
                cleaned[lang] = kept
        return cleaned
