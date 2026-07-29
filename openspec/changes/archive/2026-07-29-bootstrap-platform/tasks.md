# Tasks — bootstrap-platform (P0)

## 1. OpenSpec
- [x] 1.1 Renseigner `openspec/config.yaml` (contexte projet)
- [x] 1.2 Créer artifacts proposal / design / specs / tasks du change
- [x] 1.3 Valider le change avec `openspec validate`

## 2. Repo & docs
- [x] 2.1 Ajouter `.gitignore` et `.env.example`
- [x] 2.2 Rédiger `README.md` (présentation, install, usage, fonctionnalités)

## 3. API
- [x] 3.1 Scaffold FastAPI (`apps/api`) avec endpoint `/health`
- [x] 3.2 Configurer logging FR + `LOG_DIR` / `LOG_LEVEL`
- [x] 3.3 Dockerfile API + requirements

## 4. Web
- [x] 4.1 Scaffold Vite React TS (`apps/web`) page d’accueil FR
- [x] 4.2 Proxy `/api` vers le backend (dev + Docker)
- [x] 4.3 Dockerfile web (build nginx/static ou serve Vite)

## 5. Infra
- [x] 5.1 Docker Compose : postgres, api, web, ollama, caddy
- [x] 5.2 Volumes logs + data Postgres + Ollama
- [x] 5.3 Vérifier health via compose (smoke)
  - Note : smoke API locale OK (`/health`, logs FR). Docker daemon indisponible sur la machine au moment du test Compose — à rejouer quand Docker Desktop tourne.
