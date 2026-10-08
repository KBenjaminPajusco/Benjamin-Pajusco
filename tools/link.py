"""Génère un lien personnalisé discret vers le portfolio.

    python tools/link.py "LinkedIn"   ->  https://benjamin.pajusco.fr/?f=...

Le nom est brouillé (XOR + base64url), pas chiffré : il ne se lit pas dans l'adresse, c'est tout.
Le site le décode (decodeFor dans src/main.js) et l'affiche sur la voile, l'accueil, le titre et l'arrivée.
"""
import base64
import sys

KEY = [98, 112, 52, 50]


def encode(name: str) -> str:
    data = name.encode('utf-8')
    mixed = bytes(b ^ KEY[i % len(KEY)] ^ ((i * 7) & 0xFF) for i, b in enumerate(data))
    return base64.urlsafe_b64encode(mixed).decode().rstrip('=')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('usage : python tools/link.py "Nom de l\'entreprise"')
    print(f'https://benjamin.pajusco.fr/?f={encode(" ".join(sys.argv[1:]))}')
