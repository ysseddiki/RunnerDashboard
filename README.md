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
sudo chown -R 1000 /var/log/running-dashboards/host-logs  # l'API tourne en non-root (uid 1000)
docker compose -f infra/docker-compose.yml --env-file .env up --build -d
```

Accès :
- **HTTP** : `http://VOTRE_IP`
- **HTTPS** : `https://VOTRE_IP` (certificat auto-signé → accepter l’avertissement)

### HTTPS avec Let's Encrypt (recommandé en production)

Si `PUBLIC_HOST` est un **domaine public** (ex. `run.example.com`), Caddy obtient et
renouvelle automatiquement un certificat **Let's Encrypt** ; HTTP est alors redirigé
vers HTTPS. Prérequis :

1. Un enregistrement DNS `A`/`AAAA` pointant vers la VM.
2. Ports **80** et **443** ouverts depuis Internet (challenge ACME HTTP-01).
3. Dans `.env` :

```env
PUBLIC_HOST=run.example.com
PUBLIC_APP_URL=https://run.example.com
STRAVA_REDIRECT_URI=https://run.example.com/api/auth/strava/callback
ACME_EMAIL=vous@example.com
SESSION_COOKIE_SECURE=true
CORS_ORIGINS=https://run.example.com
```

`TLS_MODE=auto` (défaut) choisit Let's Encrypt pour un domaine, et retombe sur un
certificat auto-signé pour une IP ou `localhost` (Let's Encrypt ne signe pas d'IP).
Forçage possible : `TLS_MODE=letsencrypt` ou `TLS_MODE=selfsigned`.

Les logs API : `/var/log/running-dashboards/host-logs/`.

### Auth Strava + multi-profils

Login obligatoire via Strava. Chaque compte a ses activités / profil / plan isolés.
Rôles : `user` (défaut) et `admin`. **Le premier compte** qui se connecte devient admin ; les admins
peuvent ensuite promouvoir d’autres utilisateurs (page Admin → Utilisateurs).

Variables `.env` importantes :
- `SESSION_SECRET` — secret de signature du cookie de session (changez en production)
- `STRAVA_REDIRECT_URI` — doit pointer vers `/api/auth/strava/callback`
- `SESSION_COOKIE_SECURE=true` si l’app n’est servie qu’en HTTPS

### Reset base neuve (recommandé après passage multi-user)

L’auth multi-user part d’un schéma neuf (pas de migration du singleton `id=1`). Pour repartir à zéro :

```bash
docker compose -f infra/docker-compose.yml --env-file .env down -v
docker compose -f infra/docker-compose.yml --env-file .env up --build -d
```

`-v` supprime les volumes Postgres (données perdues). Puis reconnectez-vous via Strava (page Login).

### Strava

1. Créer une app sur [Strava API](https://www.strava.com/settings/api)
2. **Authorization Callback Domain** = hôte sans `http://` (ex. `localhost` ou votre IP)
3. Renseigner dans `.env` : `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` (`http://VOTRE_IP/api/auth/strava/callback`), `PUBLIC_APP_URL`, `SESSION_SECRET`

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
Timeout par défaut `OLLAMA_CHAT_TIMEOUT_S=600`. `OLLAMA_KEEP_ALIVE=-1` garde le modèle chargé
en permanence (recommandé sur VM 32 Go). `OLLAMA_NUM_THREAD=auto` limite à **nproc − 1** cœurs
(réglable aussi dans **Admin** ; laissez `0` pour tous les cœurs). Si timeout, passez à `qwen2.5:7b` (Admin).

Le coach reçoit un contexte déterministe : prévisions d’allure, analytics, sorties récentes (min/km, FC, type de séance, cadence si dispo, météo). Aucun cloud IA.
Sur les activités, **Suggérer** propose un type de séance (règles ; confirmation humaine).

## Usage

1. Démarrer la stack.
2. Ouvrir l’app → **Continuer avec Strava** (premier compte = admin).
3. Accueil → **Synchroniser Strava**.
4. (Optionnel, admin) **Admin** → Import Apple Santé / modèles Ollama / promotion d’admins.
5. Consulter Activités / Prévisions / Coach / Profil.

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
| **Features** | Fait | KPIs par séance (zones, TRIMP, intervalles), charge ACR, UI détail |
| **Forme** | Fait | ATL / CTL / TSB + courbe Home ; adhérence plan coach vs sorties |
| **Prochaines séances** | Fait | Prescriptions déterministes (règles) + tendances par type de séance |

Après Sync (ou **Admin → Recalculer les features**), chaque activité running dérive des métriques déterministes depuis les streams. L’accueil affiche la charge TRIMP/ACR, la **forme** (ATL/CTL/TSB), le volume facile vs qualité, les **prochaines séances** (règles) et les **tendances par type**. Le détail adapte graphes et tableaux au type de séance. La page **Coach** montre le plan avec statut fait / manqué / à venir.

Suivi produit : dossier `openspec/`.
