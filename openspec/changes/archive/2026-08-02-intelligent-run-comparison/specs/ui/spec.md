## ADDED Requirements

### Requirement: Lancer une comparaison depuis Activités

L’UI SHALL permettre de lancer une comparaison intelligente lorsque exactement deux activités sont sélectionnées dans la liste Activités.

#### Scenario: Bouton Comparer visible

- **WHEN** l’utilisateur coche exactement deux activités
- **THEN** une action « Comparer » est proposée
- **AND** elle mène à la vue de comparaison pour ces deux ids

#### Scenario: Moins ou plus de deux sélections

- **WHEN** le nombre d’activités sélectionnées n’est pas exactement 2
- **THEN** l’action Comparer n’est pas disponible (ou est désactivée avec indication claire)

### Requirement: Page de comparaison

L’UI SHALL exposer une page de comparaison en français affichant d’abord le délai entre les deux séances, puis le verdict et les métriques.

#### Scenario: Introduction délai

- **WHEN** la comparaison est chargée avec succès
- **THEN** l’en-tête affiche le temps écoulé entre les deux exercices (`interval_label_fr` / texte d’intro)
- **AND** les deux activités sont identifiées (nom, date, lien détail)

#### Scenario: Lecture du verdict

- **WHEN** l’API renvoie `overall_summary_fr` et des métriques
- **THEN** la page affiche le résumé, les deltas clés (allure, FC, etc.) et les caveats éventuels
- **AND** aucun appel LLM n’est requis côté front

#### Scenario: Deep-link

- **WHEN** l’utilisateur ouvre `/compare` avec deux ids valides en query
- **THEN** la page charge la comparaison sans repasser par la sélection
