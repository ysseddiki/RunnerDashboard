## ADDED Requirements

### Requirement: Allures d’entraînement comme cibles de prescription
Le système SHALL réutiliser les `training_paces` existantes (prévisions) comme `target_pace_sec_per_km` des items `next_sessions` lorsque le `session_type` correspond ; sans modifier la formule Riegel.

#### Scenario: Cible tempo
- **GIVEN** une allure d’entraînement `tempo` disponible
- **WHEN** une séance `tempo` est prescrite dans `next_sessions`
- **THEN** `target_pace_sec_per_km` égale l’allure d’entraînement tempo (à l’arrondi près)
