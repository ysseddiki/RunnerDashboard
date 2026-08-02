# Delta for coach

## ADDED Requirements

### Requirement: Contexte forme et adhérence
Le système SHALL injecter dans le contexte coach (advise / refresh plan) un résumé déterministe de forme (ATL, CTL, TSB, status) et d’adhérence (pourcentage, séances manquées), sans laisser le LLM inventer ces métriques.

#### Scenario: Advise avec faits
- GIVEN forme et adhérence disponibles
- WHEN une analyse coach est lancée
- THEN le prompt utilisateur contient les valeurs ATL/CTL/TSB et le % d’adhérence issus de l’API
- AND le system prompt rappelle de ne pas inventer de chiffres absents

#### Scenario: Faits absents
- GIVEN forme ou adhérence indisponible
- WHEN le contexte est construit
- THEN le champ correspondant indique l’indisponibilité
- AND aucune valeur fictive n’est substituée
