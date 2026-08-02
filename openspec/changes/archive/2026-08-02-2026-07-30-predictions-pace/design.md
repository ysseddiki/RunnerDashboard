# Design: predictions-pace

## Principes

- Moteur **100 % déterministe** côté API ; le front n’applique aucune formule métier.
- Le LLM (P4) pourra **lire** ces résultats plus tard, jamais les remplacer.
- Transparence : chaque estimation expose méthode, confiance, fourchette et sources.

## Distances cibles

| id | km | label |
|----|-----|-------|
| `5k` | 5 | 5 km |
| `10k` | 10 | 10 km |
| `semi` | 21.0975 | Semi-marathon |
| `marathon` | 42.195 | Marathon |

## Ancre (priorité)

1. Meilleure compétition / test récent (≤ 180 j) avec distance ≥ 3 km
2. Sinon meilleure sortie « qualité » taguée (`seuil`, `tempo`, `fractionne`, `vma`, `competition`) ≤ 90 j
3. Sinon meilleure allure moyenne sur sorties ≥ 5 km (28–90 j), hors récupération pure si tags dispo
4. Sinon moyenne des sorties récentes ≥ 3 km → confiance basse

Ancre exprimée en `pace_sec_per_km` + distance réelle.

## Extrapolation (Riegel)

Pour une allure ancre à distance \(D_1\), allure à \(D_2\) :

\[
p_2 = p_1 \times (D_2 / D_1)^{0.06}
\]

Bornes : allure cible clampée entre 2:30 /km et 8:00 /km.
Fourchette : ±3 % (confiance haute), ±5 % (moyenne), ±8 % (basse).

## Correction charge (légère)

- Si catégorie analytics ≈ `charge_elevee` ou volume 14 j très haut → +2 % sur les allures (plus lent = plus prudent)
- Si `baisse` nette d’allure 28 j → +2 %
- Si `progression` nette → −1 % (plus ambitieux, plafonné)

## Allures d’entraînement

Si assez de sorties taguées (moyenne des 6 dernières du type) : utiliser la moyenne observée.
Sinon dériver depuis l’allure 10 km estimée :

| type | facteur × pace_10k |
|------|---------------------|
| ef / recuperation | 1.20 |
| endurance_active / sortie_longue | 1.12 |
| tempo | 1.04 |
| seuil | 1.02 |
| fractionne / vma | 0.92 |
| cotes / fartlek | 1.00 |

## Tendance

Pour chaque semaine ISO sur 12 semaines : recalculer l’allure 10 km estimée avec les activités **jusqu’à la fin de cette semaine** (même moteur, ancre bornée à cette date). Série `week` + `pace_10k_sec_per_km`.

## Confiance

- `haute` : ancre compétition/test ≤ 120 j + ≥ 8 sorties
- `moyenne` : ancre qualité taguée ou compétition ancienne + ≥ 5 sorties
- `basse` : sinon ou données insuffisantes (< 5 sorties) → warnings explicites

## API

`GET /api/predictions/overview` → JSON unique consommé par la page Prévisions.

## Front

Route `/predictions`, entrée nav « Prévisions ». Affiche hero 10 km, grille distances, allures exo, tendance, warnings / sources.
