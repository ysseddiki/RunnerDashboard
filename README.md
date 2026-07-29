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
# Éditer .env : PUBLIC_HOST, PUBLIC_APP_URL, CORS_ORIGINS, STRAVA_*
sudo mkdir -p /var/log/running-dashboards/host-logs
docker compose -f infra/docker-compose.yml --env-file .env up --build -d
```

Accès :
- **HTTP** : `http://VOTRE_IP`
- **HTTPS** : `https://VOTRE_IP` (certificat auto-signé → accepter l’avertissement)

Les logs API : `/var/log/running-dashboards/host-logs/`.

### Strava

1. Créer une app sur [Strava API](https://www.strava.com/settings/api)
2. **Authorization Callback Domain** = hôte sans `http://` (ex. `localhost` ou votre IP)
3. Renseigner dans `.env` : `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` (`http://VOTRE_IP/api/strava/callback`), `PUBLIC_APP_URL`

## Usage

1. Démarrer la stack.
2. Ouvrir l’UI → **Connecter Strava** → autoriser.
3. **Synchroniser** → consulter la liste / le détail (cadence PPM + météo si GPS).

Arrêt :

```bash
docker compose -f infra/docker-compose.yml --env-file .env down
```

## Fonctionnalités

| Palier | Statut | Contenu |
|--------|--------|---------|
| **P0** | Fait | Socle front/back, Postgres, logs, Ollama prêt |
| **P1** | Fait | Sync Strava + activités (cadence PPM si dispo) |
| **P2** | Fait | Météo liée aux sorties (Open-Meteo au Sync) |
| **P3** | Fait | Analytics / évolution (volumes, tendances, catégories) |
| **P4** | Prévu | Coach IA local (Ollama) + choix modèle en Paramètres |

Suivi produit : dossier `openspec/`.
