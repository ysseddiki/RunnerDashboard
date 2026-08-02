## ADDED Requirements

### Requirement: Cohérence multi-pages
L’UI SHALL appliquer la même hiérarchie de titres de section, la même densité de panels et les mêmes tokens sur Accueil, Activités, Détail, Coach, Prévisions, Profil/Paramètres et Admin.

#### Scenario: Titres de section
- **GIVEN** un utilisateur sur Coach ou Prévisions
- **WHEN** une section majeure est affichée
- **THEN** elle utilise le même pattern titre + sous-titre que le détail activité

### Requirement: Page détail structurée
L’UI détail activité SHALL conserver la carte d’activité en tête, les grilles responsive (analyse/GPS, lecture/splits), les courbes annotées, et un regroupement « Détail technique ».

#### Scenario: Responsive étroit
- **GIVEN** une largeur &lt; 900px
- **WHEN** le détail est affiché
- **THEN** les paires de panels se stackent en colonne
- **AND** le contenu long scroll dans le panneau sans casser la page

### Requirement: Graphs enrichis (ECharts)
L’UI SHALL conserver ECharts et SHALL exposer les plages d’attention, une légende claire, et des interactions de zoom/survol utilisables.

#### Scenario: Plage d’attention
- **GIVEN** une activité avec points d’attention détectés
- **WHEN** l’utilisateur ouvre les courbes
- **THEN** des plages surlignées sont visibles sur les séries concernées
- **AND** une puce permet d’afficher le détail de la plage

### Requirement: Accessibilité de base
L’UI SHALL fournir des états focus visibles, un contraste suffisant pour texte et contrôles, et des libellés accessibles sur les menus portail (type de séance, thème).

#### Scenario: Focus clavier
- **GIVEN** un utilisateur navigue au clavier
- **WHEN** il atteint un bouton ou un déclencheur de menu
- **THEN** un indicateur de focus est visible
