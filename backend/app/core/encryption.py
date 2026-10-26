"""Biometric vector encryption and privacy preservation module.

Implements genuine AES-256-GCM authenticated encryption at rest for
512-dimensional facial biometric embedding vectors.
"""

import base64
import os
import secrets
from typing import List, Union
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import numpy as np

from backend.app.core.config import settings

# AES-256 requires a 256-bit (32 bytes) key.
KEY_SIZE_BYTES = 32
# Recommended standard GCM nonce size is 96 bits (12 bytes).
NONCE_SIZE_BYTES = 12
# Expected biometric vector dimension for FaceNet / ArcFace models.
EMBEDDING_DIM = 512


def generate_encryption_key() -> str:
    """Generate a cryptographically secure 256-bit URL-safe base64 key."""
    raw_key = secrets.token_bytes(KEY_SIZE_BYTES)
    return base64.urlsafe_b64encode(raw_key).decode("ascii")


def _normalize_key(key: Union[bytes, str, None] = None) -> bytes:
    """Normalize and validate the 32-byte cryptographic key."""
    if key is None:
        key = settings.BIOMETRIC_ENCRYPTION_KEY

    if isinstance(key, str):
        # Check if URL-safe or standard Base64 encoded
        try:
            decoded = base64.urlsafe_b64decode(key.encode("ascii"))
            if len(decoded) == KEY_SIZE_BYTES:
                return decoded
        except Exception:
            pass

        try:
            decoded = base64.b64decode(key.encode("ascii"))
            if len(decoded) == KEY_SIZE_BYTES:
                return decoded
        except Exception:
            pass

        # Check if 64-character hex string
        try:
            if len(key) == 64:
                decoded = bytes.fromhex(key)
                if len(decoded) == KEY_SIZE_BYTES:
                    return decoded
        except Exception:
            pass

        # Raw string bytes
        raw_bytes = key.encode("utf-8")
    else:
        raw_bytes = key

    if len(raw_bytes) == KEY_SIZE_BYTES:
        return raw_bytes

    # If key length is not exactly 32 bytes, derive 32-byte key using SHA-256
    import hashlib
    return hashlib.sha256(raw_bytes).digest()


def encrypt_embedding(
    vector: Union[List[float], np.ndarray],
    key: Union[bytes, str, None] = None,
) -> str:
    """Encrypt a 512-dimensional float32 vector using AES-256-GCM.

    A unique random 12-byte IV/nonce is generated per encryption call.
    Returns URL-safe Base64 encoded ciphertext string containing:
    [12-byte nonce] + [ciphertext] + [16-byte authentication tag].
    """
    arr = np.asarray(vector, dtype=np.float32)
    if arr.ndim != 1:
        arr = arr.flatten()

    data_bytes = arr.tobytes()
    aes_key = _normalize_key(key)
    aesgcm = AESGCM(aes_key)

    # 12-byte cryptographically secure random nonce per operation
    nonce = os.urandom(NONCE_SIZE_BYTES)
    # aesgcm.encrypt returns ciphertext + 16-byte GCM authentication tag
    encrypted_payload = aesgcm.encrypt(nonce, data_bytes, associated_data=None)

    # Combined payload: nonce + encrypted_payload
    token_bytes = nonce + encrypted_payload
    return base64.urlsafe_b64encode(token_bytes).decode("ascii")


def decrypt_embedding(
    ciphertext: str,
    key: Union[bytes, str, None] = None,
) -> np.ndarray:
    """Decrypt a base64 ciphertext string back to a 512-d float32 numpy array.

    Validates cryptographic authenticity and integrity tag.
    Raises ValueError if key is incorrect, token is tampered, or format is invalid.
    """
    if not isinstance(ciphertext, str) or not ciphertext:
        raise ValueError("Ciphertext must be a non-empty string.")

    try:
        token_bytes = base64.urlsafe_b64decode(ciphertext.encode("ascii"))
    except Exception as e:
        raise ValueError(f"Invalid base64 ciphertext encoding: {e}") from e

    min_payload_len = NONCE_SIZE_BYTES + 16  # 12-byte nonce + 16-byte tag
    if len(token_bytes) < min_payload_len:
        raise ValueError("Ciphertext payload is too short to contain valid nonce and tag.")

    nonce = token_bytes[:NONCE_SIZE_BYTES]
    encrypted_data = token_bytes[NONCE_SIZE_BYTES:]

    aes_key = _normalize_key(key)
    aesgcm = AESGCM(aes_key)

    try:
        decrypted_bytes = aesgcm.decrypt(nonce, encrypted_data, associated_data=None)
    except InvalidTag as e:
        raise ValueError("Decryption failed: invalid authentication tag, tampered data, or wrong key.") from e
    except Exception as e:
        raise ValueError(f"Decryption failed: {e}") from e

    # Reconstruct float32 array
    return np.frombuffer(decrypted_bytes, dtype=np.float32)


def is_ciphertext(value: str) -> bool:
    """Validate whether a given string is an encrypted ciphertext token.

    Verifies format, length, non-plaintext structure, and valid base64 payload.
    """
    if not isinstance(value, str):
        return False

    value = value.strip()
    # Plaintext JSON array or comma-separated lists start with '[' or '{' or numbers
    if value.startswith("[") or value.startswith("{") or value.startswith("("):
        return False

    # Check minimum length (512 float32 is 2048 bytes + 12 nonce + 16 tag = 2076 bytes, base64 ~2768 chars)
    if len(value) < 100:
        return False

    try:
        decoded = base64.urlsafe_b64decode(value.encode("ascii"))
        return len(decoded) >= (NONCE_SIZE_BYTES + 16)
    except Exception:
        return False
