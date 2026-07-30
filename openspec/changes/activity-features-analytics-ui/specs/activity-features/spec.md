# activity-features Specification

## Purpose

Extraire, persister et exposer des métriques déterministes dérivées des streams et du profil athlète, pour alimenter l’UI détail, les analytics et le coach sans recalcul côté front.

## ADDED Requirements

### Requirement: Persistance des features par activité
Le système SHALL calculer et stocker un document `features_json` sur chaque activité éligible, incluant au minimum `schema_version`, `computed_at`, `quality_flags` et les métriques transverses disponibles.

#### Scenario: Après sync avec streams
- GIVEN une activité running synchronisée avec `streams_json` non vide
- WHEN le Sync (ou le recompute) se termine
- THEN `features_json` est présent avec `computed_at` et `quality_flags.has_streams` vrai

#### Scenario: Sans streams
- GIVEN une activité sans streams (ex. Apple promote sans GPS)
- WHEN les features sont calculées
- THEN `features_json` existe avec les agrégats résumés possibles
- AND les métriques stream-dépendantes sont `null` listées dans `unavailable`

### Requirement: Features transverses
Le système SHALL dériver, lorsque les capteurs le permettent : splits km (allure, FC, cadence), time-in-zone Z1–Z5, decoupling cardiaque, TRIMP Edwards, coefficients de variation allure/FC.

#### Scenario: Sortie avec FC et zones profil
- GIVEN une activité avec stream FC et un profil avec zones calculables
- WHEN les features sont calculées
- THEN `time_in_zone` contient Z1–Z5
- AND `trimp_edwards` est un nombre ≥ 0

#### Scenario: Pas de FC
- GIVEN une activité sans stream ni moyenne FC
- WHEN les features sont calculées
- THEN `time_in_zone` et `trimp_edwards` sont `null`
- AND la raison apparaît dans `unavailable`

### Requirement: Features selon le type de séance
Le système SHALL enrichir `features_json` avec des métriques spécifiques à la famille du `session_type` (EF/récup, longue, tempo/seuil, fractionné/VMA/côtes, compétition/test).

#### Scenario: Fractionné avec allure variable
- GIVEN `session_type` = `fractionne` et un stream allure avec variations marquées
- WHEN les features sont calculées
- THEN un bloc `intervals` décrit les segments travail/récup détectés
- OR `intervals` est `null` avec une confiance insuffisante documentée

#### Scenario: Type absent
- GIVEN `session_type` null
- WHEN les features sont calculées
- THEN seules les features transverses sont présentes
- AND aucun bloc spécifique trompeur n’est inventé

### Requirement: Recalcul et cohérence profil
Le système SHALL recalculer `features_json` au Sync, lors d’un PATCH du `session_type`, après changement des zones profil (fingerprint), et via une action Admin de recompute batch.

#### Scenario: Recompute Admin
- GIVEN des activités historiques sans features ou avec ancienne `schema_version`
- WHEN l’admin lance le recompute features
- THEN les activités concernées sont mises à jour
- AND un compteur de succès/échecs est journalisé en FR

### Requirement: Exposition API
Le système SHALL inclure `features_json` dans la réponse détail activité (`GET /api/activities/{id}`).

#### Scenario: Lecture détail
- GIVEN une activité avec features calculées
- WHEN le client demande le détail
- THEN le corps contient `features_json` exploitable par l’UI
