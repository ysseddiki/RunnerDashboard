## ADDED Requirements

### Requirement: Pack de connaissance coach
Le système SHALL exposer une bibliothèque locale de documents (zones, formules d’allure, construction de plan, projections) sous `apps/api/app/knowledge/` et l’injecter dans les prompts Ollama du coach.

#### Scenario: Injection
- **WHEN** le coach génère un plan, une analyse d’activité ou un conseil
- **THEN** le system prompt inclut un extrait du pack de connaissance
- **AND** aucune requête réseau hors Ollama local n’est faite pour ce pack

### Requirement: Lecture seule du pack
Le système MUST NOT modifier le pack de connaissance via l’API runtime ; les mises à jour passent par le dépôt git.

#### Scenario: Pas d’écriture API
- **WHEN** un client appelle l’API
- **THEN** aucun endpoint n’écrit dans `app/knowledge/`
