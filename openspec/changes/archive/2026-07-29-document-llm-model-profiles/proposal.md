# Proposal: document-llm-model-profiles

## Why

Le coach local doit tourner sur des VM de tailles différentes (16 Go vs 32 Go).
Il faut figer deux profils de modèle et le fait que le choix est exposé dans
les paramètres UI (persisté côté API), sans complexifier la stack.

## What Changes

- Documenter deux profils Ollama (7B / 14B) selon la RAM VM
- Documenter le réglage via UI Paramètres + stockage API/Postgres
- Clarifier la valeur par défaut `.env` (`OLLAMA_MODEL`) au premier démarrage
- Mettre à jour `openspec/config.yaml`, `.env.example`, README (léger)

## Non-goals

- Implémenter l’écran Paramètres ou les appels Ollama (P4)
- Ajouter d’autres familles de modèles
- Détecter automatiquement la RAM de la VM
