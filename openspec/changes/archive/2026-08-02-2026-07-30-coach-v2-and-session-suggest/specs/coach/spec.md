# Delta for coach

## ADDED Requirements

### Requirement: Réponse coach structurée
Le système SHALL faire produire par le coach un objet avec `summary`, `plan` (séances planifiées) et `markdown`, parsés côté API même si le modèle ajoute du texte autour.

#### Scenario: Plan calendrier
- GIVEN un modèle installé et des activités
- WHEN `/api/coach/advise` réussit
- THEN la réponse contient un `summary` non vide
- AND un tableau `plan` (éventuellement vide si parsing échoue)
- AND un champ `markdown` pour l’analyse détaillée

### Requirement: UI synthèse et calendrier
L’UI Coach SHALL afficher en tête la synthèse et le plan sous forme de calendrier / cartes par jour, puis le markdown rendu.

#### Scenario: Rendu markdown
- GIVEN une réponse avec markdown (titres, listes)
- WHEN la page Coach affiche le conseil
- THEN le markdown est rendu (pas uniquement en texte préformaté)
