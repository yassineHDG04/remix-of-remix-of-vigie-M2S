"""Utilitaires de dates : toutes les dates métier internes sont UTC sans fuseau."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def utcnow() -> datetime:
    """Retourne l'instant courant en UTC sous forme de datetime naïf."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_utc_datetime(value: Any) -> datetime | None:
    """Normalise un datetime ou une date ISO en UTC sans fuseau.

    Les valeurs avec un décalage explicite sont réellement converties en UTC ;
    les valeurs naïves sont considérées comme étant déjà en UTC.
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)

    return parsed
