# Proposal: p4-coach-ollama

## Why

Les prévisions, analytics et activités sont en place. Il faut un **coach IA local** (Ollama)
qui commente ces chiffres — allures min/km, HR, types de séance, tendances — sans cloud,
avec une **procédure claire** pour installer / choisir le modèle (7B ou 14B).

## What Changes

- Spec coach enrichie (contexte prévisions + données, endpoints, intégration modèle)
- Client Ollama + `OLLAMA_BASE_URL` dans API / Compose
- `GET /api/coach/status`, `POST /api/coach/pull-model`, `POST /api/coach/advise`
- Contexte déterministe : prévisions, analytics, sorties récentes (allure, FC, tags, météo)
- Page UI **Coach** + Admin (statut modèle, pull)
- README : procédure d’intégration du modèle

## Non-goals

- Streaming token-by-token dans l’UI (réponse complète suffit en v1)
- Analyse intra-intervalle FC (récup BPM) — prévu plus tard
- Multi-utilisateurs / auth
- Envoi de données vers un cloud IA
