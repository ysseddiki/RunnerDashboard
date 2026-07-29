# Design: bootstrap-platform (P0)

## Architecture

```
apps/web  →  reverse-proxy  →  apps/api  →  PostgreSQL
                                  ↓
                               Ollama (prêt, inutilisé en P0)
```

- Le frontend ne parle qu’à l’API (même origine via proxy `/api`).
- L’API seule connaît Postgres, Ollama, et plus tard Strava/météo.
- Volumes Docker : données Postgres, modèles Ollama, `LOG_DIR` monté.

## Décisions

| Décision | Choix | Raison |
|----------|--------|--------|
| Layout | Monorepo `apps/*` + `infra/` | Évolution claire, un seul repo |
| DB | PostgreSQL 16 | JSONB, PostGIS plus tard, backups standards |
| API | FastAPI | OpenAPI natif, écosystème data/LLM |
| Web | Vite + React + TS | SPA légère, typage, évolutif |
| LLM runtime | Ollama container | Swap de modèle sans changer l’API |
| Logs | Fichier + stdout, `LOG_DIR` | Observabilité VM, path fourni à l’ops |
| Proxy | Caddy ou nginx | Exposition unique, firewall hors VM |

## Logging

- Env : `LOG_DIR` (défaut `/var/log/running-dashboard`), `LOG_LEVEL`
- Format : `timestamp | LEVEL | module | message clair FR | key=value`
- Interdit : tokens OAuth, mots de passe, secrets
- Rotation : taille / quotidienne (config basique P0)

## Sécurité P0

- Secrets via `.env` (non versionné)
- Services bind selon Compose ; exposition réelle filtrée hors VM (E)
- Healthcheck API sans données perso

## Risques

- Ollama 14B sur CPU Intel/AMD : lent — acceptable P0 (image prête)
- Proxy : choisir Caddy (TLS auto plus tard) ou nginx (simple) → **Caddy** pour évolutivité TLS
