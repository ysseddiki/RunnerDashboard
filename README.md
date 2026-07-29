# RunningDashboard

Application web pour suivre vos sorties running (Strava), corréler la météo, et obtenir des conseils via un modèle IA local. Les données restent sur votre machine.

## Installation

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env
mkdir -p logs
docker compose -f infra/docker-compose.yml --env-file .env up --build -d
```

Ouvrir [http://localhost:8080](http://localhost:8080).

Les logs API : dossier `logs/` (ou le chemin défini par `HOST_LOG_DIR` / `LOG_DIR`).

## Usage

1. Démarrer la stack (commande ci-dessus).
2. Vérifier la page d’accueil et l’état API.
3. (Paliers suivants) Connecter Strava, synchroniser, consulter tendances et coach.

Arrêt :

```bash
docker compose -f infra/docker-compose.yml --env-file .env down
```

## Fonctionnalités

| Palier | Statut | Contenu |
|--------|--------|---------|
| **P0** | Fait | Socle front/back, Postgres, logs, Ollama prêt |
| **P1** | Prévu | Sync Strava + activités (dont cadence PPM si dispo) |
| **P2** | Prévu | Météo liée aux sorties |
| **P3** | Prévu | Analytics / évolution |
| **P4** | Prévu | Coach IA local (Ollama) |

Suivi produit : dossier `openspec/`.
