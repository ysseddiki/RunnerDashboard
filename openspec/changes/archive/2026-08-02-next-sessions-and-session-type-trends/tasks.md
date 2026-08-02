## 1. API — tendances par session_type

- [x] 1.1 Créer `services/session_type_trends.py` (agrégats 28j vs 29–84j, direction mieux/stable/moins_bon)
- [x] 1.2 Endpoint `GET /api/analytics/session-type-trends`
- [x] 1.3 Tests unitaires tendances (ample, sous-échantillon, direction)

## 2. API — next_sessions

- [x] 2.1 Créer `services/next_sessions.py` (règles fatigue/ACR, qualité manquée, volumes, training_paces)
- [x] 2.2 Endpoint `GET /api/analytics/next-sessions`
- [x] 2.3 Enrichir overview : `next_sessions` + `session_type_trends_summary`
- [x] 2.4 Tests next_sessions (fatigue, données insuffisantes, cibles pace)

## 3. Coach

- [x] 3.1 Enrichir `build_coach_context` avec next_sessions + session_type_trends
- [x] 3.2 Mettre à jour le prompt système (ne pas inventer)

## 4. UI

- [x] 4.1 Composant `NextSessionsCard`
- [x] 4.2 Composant `SessionTypeTrendsPanel` (résumé + détail)
- [x] 4.3 Intégrer Home + Coach
- [x] 4.4 Styles cohérents avec FormChart / chips existants

## 5. Docs & smoke

- [x] 5.1 Mention courte README / Docs Forme si pertinent
- [x] 5.2 Smoke endpoints + build web
