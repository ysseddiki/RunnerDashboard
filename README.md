# RunningDashboard

Application web pour suivre vos sorties running (Strava), corréler la météo, et obtenir des conseils via un modèle IA local. Les données restent sur votre machine.

## Spécifications machine

Deux profils selon la RAM de la VM (CPU Intel/AMD, Docker) :

| Profil | RAM | Disque libre | Modèle IA (`OLLAMA_MODEL`) |
|--------|-----|--------------|----------------------------|
| **Minimum** | **16 Go** | ~20 Go | `qwen2.5:7b` |
| **Recommandé** | **32 Go** | ~40 Go | `qwen2.5:14b` (défaut) |

La RAM inclut OS + Postgres + API + web + Ollama. Sur 16 Go, rester sur le profil 7B. Le choix se règle aussi plus tard dans l’UI Paramètres (P4).

## Installation

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env
sudo mkdir -p /var/log/running-dashboards/host-logs
docker compose -f infra/docker-compose.yml --env-file .env up --build -d
```

Ouvrir [https://localhost](https://localhost) (HTTPS sur le port `APP_PORT=443`).

Caddy utilise un certificat local (`tls internal`). Le navigateur affichera un avertissement à accepter (normal sans nom de domaine). En accès par IP, ajoute `https://VOTRE_IP` dans `CORS_ORIGINS`.

Les logs API : `/var/log/running-dashboards/host-logs/` (`HOST_LOG_DIR` et `LOG_DIR` pointent au même endroit).

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
| **P4** | Prévu | Coach IA local (Ollama) + choix modèle en Paramètres |

Suivi produit : dossier `openspec/`.
