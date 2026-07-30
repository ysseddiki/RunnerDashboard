## Context

Le coach P4 produit déjà `summary` + `plan` + `markdown` via un seul `POST /api/coach/advise`. Le modèle est déchargé après `keep_alive: 10m`. Il n’existe ni profil athlète, ni knowledge pack, ni analyse persistée par activité, ni projection UI.

Front (React) / back (FastAPI) restent séparés : le front n’appelle jamais Ollama.

## Goals / Non-Goals

**Goals:**
- Garder le modèle Ollama chargé (`keep_alive=-1`)
- Knowledge locale injectée dans les prompts
- Plan calendrier persisté, refresh async après nouvelles activités
- Analyse IA par activité + insights UI selon type de séance
- Profil coureur + zones/VO2 déterministes
- Projection d’évolution affichable

**Non-Goals:**
- Cloud IA, streaming tokens, multi-athlètes, GPU obligatoire

## Decisions

1. **Keep-alive permanent** — `OLLAMA_KEEP_ALIVE` (défaut `-1`) passé à chaque `/api/chat`. Alternative rejetée : warmup systemd seul (fragile si TTL Ollama).

2. **Knowledge pack** — fichiers markdown dans `apps/api/app/knowledge/` lus au runtime et concaténés (tronqués) dans le system prompt. Alternative : RAG vectoriel (trop lourd pour P4+).

3. **Plan découplé** — tables `coach_plan` / items ; `GET /api/coach/plan` ; `POST /api/coach/plan/refresh` ; trigger post-sync si nouvelles activités + file single-flight. `advise` ne régénère plus le plan par défaut (ou ignore le plan pour la Q&A).

4. **Analyse par activité** — colonne JSON/markdown sur `activities` ; job après sync pour activités sans analyse ; affichage détail.

5. **Profil** — table `athlete_profile` (une ligne) ; zones FC (Karvonen si repos+max) ; VO2max estimée déterministe (ex. depuis meilleure perf / formules documentées dans knowledge) ; UI `/profile`.

6. **Projection** — endpoint déterministe (allure 10k / volume 12 sem → scénario 8–12 sem) ; UI chart ECharts ; IA commente optionnellement sans inventer les points.

7. **Front/back** — tous calculs et Ollama côté API ; web = rendu + formulaires.

## Risks / Trade-offs

- [RAM 14B permanente] → Mitigation : documenter 32 Go ; fallback 7B
- [Files Ollama longues sur CPU] → Mitigation : 1 job concurrent, debounce post-sync, skip si inchangé
- [Hallucinations] → Mitigation : chiffres déterministes + knowledge ; prompt « ne pas inventer »
- [Migration colonnes] → Mitigation : create_all / ALTER simple au démarrage comme le reste du projet

## Migration Plan

1. Déployer env `OLLAMA_KEEP_ALIVE=-1` + schéma
2. Seed knowledge
3. UI Profil / Coach / Détail / Projection
4. Rollback : retirer keep_alive long + ignorer nouvelles tables (non destructif)

## Open Questions

- Formule VO2 exacte à figer dans knowledge (Cooper vs Daniels) — défaut : estimation prudente documentée dans le pack.
