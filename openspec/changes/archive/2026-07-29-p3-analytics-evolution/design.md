# Design: p3-analytics-evolution

## Calculs

- Fenêtre récente : 28 jours vs 28 jours précédents
- Volume : somme distance_m / semaine ISO
- Allure : moyenne average_speed_mps (plus élevé = plus rapide)
- PPM / FC : moyennes sur sorties où la métrique est présente
- Catégories (règles simples, déterministes) :
  - `donnees_insuffisantes` si < 5 sorties
  - `charge_elevee` si volume 14j > 1.35 × moyenne des 6 semaines précédentes
  - `progression` si volume ↑ et/ou allure ↑ (seuils 5 %)
  - `baisse` si volume ↓ et/ou allure ↓
  - sinon `plateau`
- Météo : température moyenne des sorties enrichies ; part de sorties avec précipitations > 0

## Sync météo

Max 15 enrichissements météo par Sync pour rester sous timeout proxy ; backfill progressif.
