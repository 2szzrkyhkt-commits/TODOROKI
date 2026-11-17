"""Offline private-snapshot recovery verification; never writes plaintext files.

Requires Python 3.12+ and cryptography. The private key is read from a local
file and must never be committed, printed, or passed as a command argument.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

from d1_restore import verify


def decrypt_verify(envelope_raw, private_key_raw, expected_sha256):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if len(envelope_raw) > 16 * 1024 * 1024:
        raise ValueError('encrypted snapshot too large')
    envelope = json.loads(envelope_raw)
    if (envelope.get('format') != 'todoroki-private-d1-snapshot-v1'
            or envelope.get('algorithm') != 'RSA-OAEP-SHA256+AES-256-GCM'
            or envelope.get('snapshot_sha256') != expected_sha256):
        raise ValueError('snapshot format or expected digest mismatch')
    iv = base64.b64decode(envelope['iv'], validate=True)
    if len(iv) != 12:
        raise ValueError('invalid encryption nonce')
    private_key = serialization.load_pem_private_key(private_key_raw, password=None)
    key = private_key.decrypt(base64.b64decode(envelope['wrapped_key'], validate=True),
                              padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                                           algorithm=hashes.SHA256(), label=None))
    raw = AESGCM(key).decrypt(iv, base64.b64decode(envelope['ciphertext'], validate=True),
                             b'todoroki-private-d1-snapshot-v1')
    result = verify(raw, expected_sha256)
    # Domain checks also verify the binary PDF's stored length and SHA256.
    document = json.loads(raw)
    verified_files = 0
    for table in document['tables']:
        if table['name'] == 'digital_files':
            for row in table['rows']:
                pdf = bytes.fromhex(row['pdf']['$blob_hex'])
                if len(pdf) != row['byte_count'] or hashlib.sha256(pdf).hexdigest() != row['sha256']:
                    raise ValueError('stored binary length or digest mismatch')
                verified_files += 1
    result.update({'encrypted_capture': True, 'plaintext_file_written': False,
                   'binary_files_verified': verified_files})
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('encrypted_snapshot', type=Path)
    parser.add_argument('--private-key', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    try:
        result = decrypt_verify(args.encrypted_snapshot.read_bytes(),
                                args.private_key.read_bytes(), args.sha256)
    except Exception:
        # Includes authentication failure, invalid key, corrupt PDF and SQLite
        # constraints. Never echo raw provider/database/crypto exceptions.
        raise SystemExit('Private snapshot verification failed; no production changes performed.')
    print(json.dumps(result, ensure_ascii=False, indent=2))
