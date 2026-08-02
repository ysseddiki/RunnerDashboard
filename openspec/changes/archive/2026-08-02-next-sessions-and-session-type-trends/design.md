## Context

Forme (ATL/CTL/TSB), adhérence plan, `features_json`, allures d’entraînement (Riegel) et volumes easy/qualité existent. Le plan coach LLM reste narratif. Front = rendu ; **tous calculs côté API**.

## Goals / Non-Goals

**Goals:**
- Prescriptions déterministes `next_sessions` (3–7 séances, 7–10 j)
- Tendances par `session_type` (allure, FC, decoupling, CV) 28j vs 84j
- API + UI + contexte coach (faits uniquement)

**Non-Goals:**
- Remplacer le plan LLM ; HRV ; VDOT ; édition manuelle matchs ; ICS

## Decisions

1. **On-read, pas de table**  
   Services `session_type_trends.build(...)` et `next_sessions.build(...)` à chaque GET. Volume local OK.  
   *Alt.* : table matérialisée — reportée.

2. **Tendances par type**  
   Pool = activités running éligibles avec `session_type` non null.  
   Par type (min. 3 séances sur 84j pour `available`) :  
   - métriques : `pace_sec_per_km` (moyenne), `avg_hr` si dispo, `decoupling` (features), `cv_pace`  
   - fenêtres : dernières 28j vs 29–84j (ou médiane des N dernières vs N précédentes si densités inégales)  
   - `delta_pct` + `direction` : `mieux` / `stable` / `moins_bon` / `indetermine`  
   Règles « mieux » (running) : allure plus rapide (pace ↓), decoupling ↓, cv_pace ↓ ; FC à allure comparable : plus basse = mieux (si ≥2 points comparables, sinon null).  
   Endpoint : `GET /api/analytics/session-type-trends?days=84`.  
   Overview : `session_type_trends_summary` (top 3 types qualité + ef/sortie_longue si dispo).

3. **next_sessions — règles prioritaires**  
   Entrées : form snapshot, adherence (missed types), volumes easy/qualité 7/28j, training_paces, dernières activités (types récents), plan LLM upcoming (si dates).  
   Sortie : liste ordonnée `{date, session_type, title_fr, duration_or_distance, target_pace_sec_per_km, rationale_fr, source: "rules"}`.  
   Heuristique V1 (ordre de priorité) :  
   a. Si TSB `fatigue` ou ACR≥1.3 → prioriser `recuperation` / `ef`, pas de qualité forte  
   b. Si missed qualité récente → reprogrammer 1 qualité manquée (type) dans 2–4 j  
   c. Si 0 qualité sur 7j et forme `neutre|productif|frais` → 1 tempo/seuil  
   d. Si 0 sortie_longue sur 10j → 1 longue  
   e. Compléter avec ef / endurance_active pour atteindre 4–6 séances / 7j (cap volume)  
   f. Si plan LLM a des `upcoming` datés : aligner dates/types quand cohérent avec a–e, sinon garder rules + `note_fr`  
   Allures cibles = `training_paces` du même `session_type` si dispo.  
   Endpoint : `GET /api/analytics/next-sessions` ; aperçu aussi dans overview (`next_sessions`).

4. **Séparation front/back**  
   Web n’implémente aucune règle. Composants : `NextSessionsCard`, `SessionTypeTrendsPanel` (liste + sparkline/delta).

5. **Coach**  
   `build_coach_context` ajoute `next_sessions` (compact) et `session_type_trends` (deltas). Prompt : utiliser si available ; ne pas inventer prescriptions/tendances.

6. **UI placement**  
   - Home : NextSessions + résumé tendances (liens)  
   - Coach : bloc « Prochaines séances (règles) » à côté du plan LLM  
   - Predictions ou Home détail : panel tendances complet  
   Docs Forme : courte mention des prescriptions déterministes.

## Risks / Trade-offs

- [Peu de tags session_type] → `available=false` + message FR « taguez vos séances »  
- [Règles trop rigides] → rationale_fr explicite ; plan LLM reste la couche narrative  
- [Double calendrier rules vs LLM] → UI distingue `source: rules` vs plan coach ; pas de merge auto destructif  
- [FC « mieux » ambigu] → ne juger FC que si allure comparable ; sinon null  

## Migration Plan

1. Services + endpoints + tests  
2. UI Home/Coach (+ Predictions si léger)  
3. Coach context  
4. Rollback : ignorer nouveaux JSON (non destructif)

## Open Questions

- Persister next_sessions en DB : **non** V1 (on-read).  
- Nombre exact de séances : **4–6** cibles sur 7 jours (clamp 3–7).
