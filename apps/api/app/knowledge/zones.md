# Zones d'intensité (référence coach)

Les zones sont **déterministes** (code + profil). L'IA commente, elle n'invente pas les bornes.

## Zones FC (Karvonen)

Si `fc_repos` et `fc_max` connus :

- Réserve = fc_max − fc_repos
- Zone N = fc_repos + réserve × (borne_basse…borne_haute)

| Zone | Nom | % réserve |
|------|-----|-----------|
| Z1 | Récupération | 50–60 % |
| Z2 | EF / endurance | 60–70 % |
| Z3 | Tempo / active | 70–80 % |
| Z4 | Seuil | 80–90 % |
| Z5 | VMA / intensité | 90–100 % |

Si seule `fc_max` (ou âge → fc_max ≈ 220 − âge) : zones en % de fc_max (même découpage 50–100 %).

## Allures d'entraînement

Les allures EF / seuil / VMA affichées dans Prévisions sont calculées (Riegel + facteurs) — voir `allure-riegel.md`. L'IA doit s'y référer.
