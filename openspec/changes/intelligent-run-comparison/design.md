## Context

Les analytics actuelles comparent des **fenêtres** (28 j. vs 28 j. préc.) ou des **moyennes par type**, pas deux sorties précises. Les détails d’activité (`ActivityDetail` + `features_json`) sont déjà riches. Le front doit rester présentation ; le métier reste dans FastAPI.

## Goals / Non-Goals

**Goals:**

- Comparer exactement 2 activités du même utilisateur
- Introduire la comparaison par le **temps écoulé** entre les deux (FR)
- Fournir des deltas et un verdict contextualisé (pas un simple tableau)
- Entrée UX claire depuis Activités

**Non-Goals:**

- Overlay streams / GPS
- Texte généré par LLM
- >2 activités
- Persistance historique des comparaisons

## Decisions

### 1. Endpoint `POST /api/activities/compare`

- Body : `{ "activity_ids": [id1, id2] }` (ordre libre ; le service ordonne chronologiquement)
- Auth session ; les deux IDs MUST appartenir à l’utilisateur
- **Pourquoi** : logique métier côté API, OpenAPI clair, pas de double fetch métier côté front
- **Alt.** : front calcule après 2× `GET /activities/{id}` — rejeté (règles métier / caveats dupliquées)

### 2. Ordre A = plus ancienne, B = plus récente

- Toujours comparer « avant → après » pour parler d’amélioration
- Intro : `days_between`, `interval_label_fr` (ex. « 12 jours », « 3 semaines »)
- **Alt.** : laisser l’utilisateur choisir quel est la « référence » — reporté (complexité UX)

### 3. Intelligence déterministe (pas LLM)

Réutiliser la sémantique `mieux` / `stable` / `moins_bon` / `indetermine` de `session_type_trends` :

| Signal | Règle (indicatif) |
|---|---|
| Allure | Δ sec/km : négatif = plus rapide = mieux (si distances comparables) |
| FC moy. | À allure égale ou meilleure, FC ↓ = mieux ; sinon indéterminé |
| Découplage | ↓ = mieux si les deux ont la métrique |
| CV allure | ↓ = plus régulier = mieux |
| Distance | Contexte : si \|Δ distance\| > ~20 %, caveat « distances différentes » |
| Type séance | Si types ≠ : caveat + confiance baissée ; pas de verdict global « progrès » forcé |
| Météo | Si Δ temp. notable : caveat |

Sortie : `headline_fr`, `intro_fr` (délai), `metrics[]` (label, a, b, delta, direction, note_fr), `caveats_fr[]`, `overall_direction`, `overall_summary_fr`.

### 4. UX

- Page `/compare?a=&b=` + bouton « Comparer » quand exactement 2 cases cochées sur Activités
- Suggestion soft si types identiques (pas bloquant)
- Affichage : intro délai → verdict → métriques → caveats ; liens vers les 2 détails
- **Alt.** : modal only — rejeté (profondeur de lecture)

### 5. Front/back

- API = calcul + textes FR
- Web = sélection, route, rendu tokens design system existants

## Risks / Trade-offs

- [Comparaison injuste (EF vs VMA)] → Caveats + confiance ; pas de « tu as progressé » global si types très différents
- [Sans features_json] → Comparaison sur métriques résumé seulement ; indiquer les signaux manquants
- [Distances très différentes] → Ne pas sur-interpréter l’allure ; caveat explicite
- [Scope] → V1 sans streams overlay

## Migration Plan

1. Service + route + tests unitaires règles
2. Page web + branchement sélection Activités
3. Smoke build ; rollback = retirer route + page

## Open Questions

- Faut-il un item de nav « Comparer » permanent, ou seulement via sélection Activités ? (**défaut : sélection Activités + URL deep-link**)
