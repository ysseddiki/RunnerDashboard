# Design: p4-coach-ollama

## Architecture

```
UI Coach → POST /api/coach/advise
                ↓
         build_coach_context (predictions + analytics + activités)
                ↓
         Ollama /api/chat (modèle settings ou OLLAMA_MODEL)
                ↓
         texte FR structuré (pas de chiffres inventés)
```

Le front **n’appelle jamais** Ollama. L’API seule joint `http://ollama:11434`.

## Intégration modèle

1. Stack up avec service `ollama`
2. Choisir profil dans Admin (7B / 14B) → persisté Postgres
3. `POST /api/coach/pull-model` **ou** `docker compose exec ollama ollama pull <tag>`
4. `GET /api/coach/status` : reachable + model_installed
5. Coach utilisable

## Prompt

- System : coach running FR, s’appuyer uniquement sur le JSON contexte, corréler prévisions d’allure avec HR / types / min/km observés, proposer 3–5 actions concrètes, avouer les trous (cadence absente, peu de tags).
- User : question libre optionnelle + contexte JSON compact.

## Timeouts

- Chat : 180 s
- Pull : 900 s (téléchargement modèle)

## Privacy

Aucune donnée d’activité hors réseau Docker local (api ↔ ollama).
