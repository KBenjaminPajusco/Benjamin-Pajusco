# Portfolio — Benjamin Pajusco

Portfolio en 3D : on barre un foiler stylisé dans un petit monde en cel shading.
Les bouées du chenal sont les expériences du CV, les îles la formation et l'international,
le port les centres d'intérêt (Café des Agents, course à pied, muscu).

- Tout est procédural (Three.js, aucun asset externe). Le bateau ne reprend que des cotes
  globales publiques d'un AC40 ; aucune géométrie ne vient de fichiers tiers.
- Le contenu du CV vit dans `src/cv.js` (seule source, utilisée par le monde et la version rapide).

## Lancer

    python serve.py        # http://127.0.0.1:8765 (serveur sans cache)

## Structure

- `src/main.js` — rendu, caméra, commandes, fiches, mini-carte, version rapide
- `src/boat.js` — foiler procédural + physique arcade (polaire, vol, virements)
- `src/world.js` — plan du monde : nom flottant, chenal CV, îles, zone perf, port
- `src/effects.js` — eau stylisée, sillage, traits de vent
- `src/toon.js` — matériaux toon, contours, palette

Debug console : `__pf.teleport(x, z, cap)`, `__pf.step(secondes)`.
