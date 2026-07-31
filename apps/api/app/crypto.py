"""Chiffrement au repos des tokens OAuth (Fernet — AES-128-CBC + HMAC).

La clé est dérivée de TOKEN_ENCRYPTION_KEY (recommandé en production),
à défaut de SESSION_SECRET. Les valeurs héritées stockées en clair
restent lisibles (fallback) et sont re-chiffrées à la prochaine écriture.
"""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

_PREFIX = "enc:v1:"


@lru_cache
def _fernet() -> Fernet:
    settings = get_settings()
    secret = settings.token_encryption_key or settings.session_secret
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_token(value: str) -> str:
    return _PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_token(value: str) -> str:
    if not value.startswith(_PREFIX):
        # Valeur héritée en clair (avant chiffrement au repos)
        return value
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError(
            "Token chiffré illisible (TOKEN_ENCRYPTION_KEY/SESSION_SECRET modifié ?) "
            "— reconnectez le compte Strava"
        ) from exc
