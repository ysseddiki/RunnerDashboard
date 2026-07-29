# Design: document-llm-model-profiles

## Profils

| Profil | RAM VM indicative | Tag Ollama | Rôle |
|--------|-------------------|------------|------|
| léger | ~16 Go | `qwen2.5:7b` | Fallback machine courte |
| standard | ~32 Go | `qwen2.5:14b` | Défaut recommandé (qualité) |

Même famille Qwen2.5 → mêmes prompts / schéma JSON côté coach.

## Configuration

1. **Bootstrap** : `OLLAMA_MODEL` dans `.env` (défaut `qwen2.5:14b`)
2. **Runtime** : clé de settings en Postgres (`ollama_model`), lue/écrite via API
3. **UI** : Paramètres → select des deux tags, avertissement si 14B sur petite machine
4. **Priorité** : valeur settings UI si présente, sinon `OLLAMA_MODEL`

Le frontend n’appelle jamais Ollama ; seul l’API utilise le tag configuré.

## Hors scope implémentation

Pull modèle, health Ollama, écran Paramètres : change P4.
