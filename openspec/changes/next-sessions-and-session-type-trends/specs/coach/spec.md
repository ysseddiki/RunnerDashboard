## ADDED Requirements

### Requirement: Contexte coach avec next_sessions et tendances
Le système SHALL inclure dans le contexte coach déterministe un résumé `next_sessions` et `session_type_trends` lorsque disponibles, et instruire le modèle de ne pas inventer de prescriptions ou de directions absentes du contexte.

#### Scenario: Advise avec faits
- **GIVEN** des next_sessions et tendances calculables
- **WHEN** `POST /api/coach/advise` construit le contexte
- **THEN** le payload contient `next_sessions` et `session_type_trends`
- **AND** le prompt système rappelle de ne pas inventer ces faits
