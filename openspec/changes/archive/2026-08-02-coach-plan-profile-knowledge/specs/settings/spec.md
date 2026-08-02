## ADDED Requirements

### Requirement: Keep-alive configurable
Le système SHALL exposer le réglage d’environnement `OLLAMA_KEEP_ALIVE` (défaut `-1`) transmis au client Ollama.

#### Scenario: Défaut permanent
- **WHEN** aucune valeur n’est fournie
- **THEN** le keep_alive effectif est `-1`
