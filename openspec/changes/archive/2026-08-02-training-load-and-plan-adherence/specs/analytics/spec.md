# Delta for analytics

## ADDED Requirements

### Requirement: Forme dans l’overview
Le système SHALL inclure dans `/api/analytics/overview` un objet `form` (ATL, CTL, TSB, status, labels FR) lorsque la série de charge est disponible, en complément de `load` (TRIMP/ACR).

#### Scenario: Overview avec forme
- GIVEN une série de charge disponible
- WHEN l’overview est demandée
- THEN `form.atl`, `form.ctl`, `form.tsb` et `form.status` sont présents
- AND `form.status_label_fr` est renseigné

#### Scenario: Forme indisponible
- GIVEN TRIMP insuffisant
- WHEN l’overview est demandée
- THEN `form.available` est faux
- AND `form.reason_fr` est explicite
- AND le reste de l’overview (catégorie, volumes) reste calculé

### Requirement: Endpoint série de charge
Le système SHALL exposer `GET /api/analytics/load-series` retournant la série journalière pour affichage graphique (fenêtre paramétrable, défaut ~84 jours).

#### Scenario: Chart Home
- GIVEN des données TRIMP sur plusieurs semaines
- WHEN l’UI demande la série
- THEN les points journaliers permettent de tracer ATL, CTL et TSB
