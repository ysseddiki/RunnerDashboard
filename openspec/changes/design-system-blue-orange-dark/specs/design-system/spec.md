## ADDED Requirements

### Requirement: Tokens et thèmes light/dark
Le système SHALL exposer un design system CSS basé sur des variables (bleu primary, orange accent, succès/danger distincts) et SHALL appliquer un thème `clair`, `sombre` ou `système` via un attribut sur le document racine.

#### Scenario: Thème sombre
- **GIVEN** l’utilisateur choisit le thème sombre
- **WHEN** l’application se charge
- **THEN** les surfaces, textes et accents suivent la palette dark
- **AND** le contraste des textes principaux reste lisible

#### Scenario: Thème système
- **GIVEN** le thème est réglé sur « système »
- **WHEN** le OS est en mode sombre
- **THEN** l’UI utilise la palette dark

### Requirement: Branding visible
Le système SHALL afficher le nom du produit comme signal fort dans le shell (et sur la page de login), pas uniquement comme texte de navigation discret.

#### Scenario: Shell
- **GIVEN** un utilisateur authentifié
- **WHEN** il consulte n’importe quelle page principale
- **THEN** le branding produit est clairement identifiable dans l’en-tête

### Requirement: Panel collapsible
Le système SHALL fournir des panneaux de contenu collapsibles dont l’état ouvert/fermé peut être mémorisé localement par identifiant.

#### Scenario: Mémorisation
- **GIVEN** un panneau collapsible identifié
- **WHEN** l’utilisateur le referme puis recharge la page
- **THEN** le panneau reste refermé

### Requirement: États de chargement et vide
Le système SHALL afficher des skeletons (ou équivalent structurel) pendant le chargement des listes/détails, et des empty states explicites en français avec une action possible quand pertinent.

#### Scenario: Liste activités en chargement
- **GIVEN** la liste des activités se charge
- **WHEN** les données ne sont pas encore disponibles
- **THEN** l’UI montre un placeholder structurel
- **AND** pas uniquement une ligne de texte muted

### Requirement: Densité visuelle
Le système SHALL limiter les cards décoratives et les pills aux éléments interactifs ou de statut nécessaires ; les surfaces principales MUST être opaques (pas de glass généralisé).

#### Scenario: Tuile activité
- **GIVEN** la liste des activités
- **WHEN** une tuile est affichée
- **THEN** le type de séance reste le contrôle pill principal
- **AND** les autres métadonnées sont visuellement secondaires
