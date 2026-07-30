# RunningDashboard

Application web pour suivre vos sorties running (Strava), corréler la météo, estimer des allures, et obtenir des conseils via un modèle IA local. Les données restent sur votre machine.

## Spécifications machine

Deux profils selon la RAM de la VM (CPU Intel/AMD, Docker) :

| Profil | RAM | Disque libre | Modèle IA (`OLLAMA_MODEL`) |
|--------|-----|--------------|----------------------------|
| **Minimum** | **16 Go** | ~20 Go | `qwen2.5:7b` |
| **Recommandé** | **32 Go** | ~40 Go | `qwen2.5:14b` (défaut) |

La RAM inclut OS + Postgres + API + web + Ollama. Sur 16 Go, rester sur le profil 7B. Le choix se règle aussi dans **Admin**.

## Installation

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env
# Éditer .env : PUBLIC_HOST, PUBLIC_APP_URL, CORS_ORIGINS, STRAVA_*, OLLAMA_MODEL
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

### Intégration du modèle IA (P4)

1. Vérifier qu’Ollama tourne : `docker compose -f infra/docker-compose.yml --env-file .env ps`
2. Choisir le profil dans **Admin** (7B ou 14B) → **Enregistrer**
3. Télécharger le modèle :
   - **UI** : Admin → **Télécharger le modèle** (plusieurs minutes), ou
   - **CLI** :
     ```bash
     docker compose -f infra/docker-compose.yml --env-file .env exec ollama ollama pull qwen2.5:14b
     # ou qwen2.5:7b sur VM 16 Go
     ```
4. Contrôle : Admin affiche « Prêt coach = Oui », ou `GET /api/coach/status`
5. Ouvrir **Coach** → **Lancer l’analyse** (synthèse + plan calendrier + markdown)

**Timeouts / CPU** : le premier appel charge le modèle en RAM (souvent plusieurs minutes sur CPU).
Timeout par défaut `OLLAMA_CHAT_TIMEOUT_S=600`. Si ça timeout encore, passez à `qwen2.5:7b`
(Admin) ou augmentez le timeout dans `.env`. Les appels suivants sont plus rapides (`keep_alive`).

Le coach reçoit un contexte déterministe : prévisions d’allure, analytics, sorties récentes (min/km, FC, type de séance, cadence si dispo, météo). Aucun cloud IA.
Sur les activités, **Suggérer** propose un type de séance (règles ; confirmation humaine).

## Usage

1. Démarrer la stack.
2. **Admin** → Connecter Strava → Synchroniser.
3. (Optionnel) **Admin** → Import Apple Santé : uploader le ZIP d’export iPhone (Santé → profil → Exporter). Matching Strava + enrichissement des trous (pas d’écrasement) ; sans match → activité Apple.
4. Consulter Activités / Prévisions / Coach.

Arrêt :

```bash
docker compose -f infra/docker-compose.yml --env-file .env down
```

## Fonctionnalités

| Palier | Statut | Contenu |
|--------|--------|---------|
| **P0** | Fait | Socle front/back, Postgres, logs, Ollama |
| **P1** | Fait | Sync Strava + activités (cadence PPM si dispo) |
| **P2** | Fait | Météo liée aux sorties (Open-Meteo au Sync) |
| **P3** | Fait | Analytics / évolution + prévisions d’allure |
| **P4** | Fait | Coach IA local (Ollama) + choix / pull modèle |
| **Apple** | Fait | Import ZIP Santé, matching Strava, enrichissement sans écrasement |

Suivi produit : dossier `openspec/`.
