## Why

Le plan calendrier est aujourd’hui un sous-produit de « Lancer l’analyse », alors qu’il doit vivre en continu à partir des données locales. Le coach manque aussi d’une base documentaire (zones, formules, projections), d’un profil athlète, d’analyses par sortie et d’une projection d’évolution — tout en gardant le 14B chargé en RAM.

## What Changes

- Bibliothèque de knowledge versionnée (zones, calculs, plans, projections) injectée dans les prompts Ollama
- Plan calendrier **persistant**, généré/rafraîchi hors Q&A, mis à jour après nouvelles activités (async, 1 job à la fois)
- Analyse IA **par activité**, stockée et affichée sur le détail ; insights / graphs adaptés au type de séance
- Page **Profil coureur** : âge, poids, etc. + zones / VO2max **déterministes** (l’IA commente seulement)
- Graph de **projection** d’évolution (déterministe + scénario optionnel)
- `OLLAMA_KEEP_ALIVE=-1` pour garder le modèle chargé tant qu’Ollama tourne
- UI Coach : plan + analyses découplés de la question libre

## Non-goals

- Cloud IA / envoi de données hors machine
- Remplacer les formules déterministes par le LLM
- Streaming token-by-token du coach
- GPU obligatoire (CPU + 14B reste le profil cible)

## Capabilities

### New Capabilities
- `athlete-profile`: profil athlète + zones / VO2max déterministes + API/UI `/profile`
- `coach-knowledge`: bibliothèque markdown/YAML injectée au raisonnement local
- `fitness-projection`: série et graph de projection d’évolution

### Modified Capabilities
- `coach`: plan calendrier indépendant, refresh post-sync, analyse par activité, keep_alive permanent
- `ui`: Coach découplé, détail enrichi, nav Profil, graph projection
- `settings`: config `OLLAMA_KEEP_ALIVE`

## Impact

API FastAPI (nouveaux endpoints + modèles Postgres), Ollama client, sync Strava trigger, pages web Coach / Détail / Profil, Docs, `.env` / Compose.
