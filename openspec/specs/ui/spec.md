# ui Specification

## Purpose
TBD - created by archiving change bootstrap-platform. Update Purpose after archive.

## Requirements

### Requirement: Interface en français
Le système SHALL afficher l’interface utilisateur en français.

#### Scenario: Page d’accueil P0
- GIVEN l’application web démarrée
- WHEN l’utilisateur ouvre la page d’accueil
- THEN le contenu principal est en français

### Requirement: Page socle
Le système SHALL exposer une page d’accueil minimale indiquant le nom du produit et que le socle P0 est opérationnel.

#### Scenario: Smoke UI
- GIVEN le reverse proxy actif
- WHEN l’utilisateur accède à `/`
- THEN la page RunningDashboard se charge sans erreur

### Requirement: Connexion et Sync Strava
L’UI SHALL proposer de connecter Strava et de lancer une synchronisation.

#### Scenario: Parcours P1
- GIVEN l’application ouverte
- WHEN Strava n’est pas connecté
- THEN un bouton de connexion est visible
- AND après connexion un bouton Sync est disponible

### Requirement: Liste et détail des activités
L’UI SHALL afficher la liste des activités synchronisées et un détail avec métriques dont la cadence PPM si présente, enrichi des insights et graphes issus de `features_json` lorsque disponible.

#### Scenario: Affichage cadence
- GIVEN une activité avec cadence
- WHEN l’utilisateur ouvre le détail
- THEN la cadence en PPM est affichée

#### Scenario: Features présentes
- GIVEN une activité avec `features_json`
- WHEN l’utilisateur ouvre le détail
- THEN le bloc lecture déterministe est visible en plus des métriques résumé

### Requirement: Page Prévisions
L’UI SHALL exposer une page dédiée `/predictions` listée dans la navigation principale sous le libellé « Prévisions ».

#### Scenario: Navigation
- GIVEN un utilisateur sur l’app
- WHEN il ouvre la nav
- THEN un lien « Prévisions » mène à `/predictions`

#### Scenario: Contenu
- GIVEN `/api/predictions/overview` disponible
- WHEN la page Prévisions est affichée
- THEN elle montre l’allure 10 km estimée, la grille des distances, les allures d’entraînement, la tendance et les warnings

### Requirement: Page Coach
L’UI SHALL exposer une page `/coach` permettant de lancer une analyse IA et d’afficher la réponse.

#### Scenario: Analyse
- GIVEN un modèle Ollama installé
- WHEN l’utilisateur lance l’analyse depuis `/coach`
- THEN un conseil FR s’affiche
- AND un état d’erreur clair apparaît si Ollama / modèle est indisponible

### Requirement: UI synthèse et calendrier coach
L’UI Coach SHALL afficher en tête la synthèse et le plan sous forme de calendrier / cartes par jour, puis le markdown rendu.

#### Scenario: Rendu markdown
- GIVEN une réponse avec markdown (titres, listes)
- WHEN la page Coach affiche le conseil
- THEN le markdown est rendu (pas uniquement en texte préformaté)

### Requirement: Suggestion de type de séance
L’UI SHALL permettre de demander une suggestion de type de séance pour une activité et de l’appliquer après confirmation.

#### Scenario: Suggérer puis appliquer
- GIVEN une activité sans type ou avec type à revoir
- WHEN l’utilisateur demande une suggestion
- THEN un type proposé et une confiance sont affichés
- AND l’utilisateur peut appliquer via le sélecteur existant

### Requirement: Admin intégration modèle
L’UI Admin SHALL afficher le statut Ollama (joignable, modèle installé) et permettre de lancer le pull du modèle sélectionné.

#### Scenario: Pull
- GIVEN Admin ouvert et Ollama joignable
- WHEN l’utilisateur lance « Télécharger le modèle »
- THEN l’API `pull-model` est appelée
- AND le statut est rafraîchi ensuite

### Requirement: Import Apple Santé dans Admin
L’UI Admin SHALL permettre d’uploader un export ZIP Apple Santé et d’afficher le résumé (candidats, liens, créations).

#### Scenario: Upload
- GIVEN Admin ouvert
- WHEN l’utilisateur envoie un ZIP valide
- THEN un résumé d’import s’affiche avec les candidats proposés

### Requirement: Badge source activité
L’UI SHALL indiquer la source d’une activité (Strava, Apple, ou Strava lié Apple).

#### Scenario: Liste
- GIVEN des activités de sources différentes
- WHEN la liste Activités est affichée
- THEN un badge source lisible est visible

### Requirement: Page Profil coureur
L’UI SHALL exposer `/profile` dans la navigation pour éditer le profil et afficher zones / VO2max / projection.

#### Scenario: Navigation
- **WHEN** l’utilisateur ouvre la nav
- **THEN** un lien « Profil » mène à `/profile`

### Requirement: Coach plan hors analyse
L’UI Coach SHALL charger et afficher le plan calendrier depuis l’API plan sans exiger le bouton « Lancer l’analyse ».

#### Scenario: Ouverture Coach
- **WHEN** la page `/coach` est affichée
- **THEN** le plan calendrier est demandé via `GET /api/coach/plan`
- **AND** « Lancer l’analyse » ne sert qu’à la question libre / synthèse Q&A

### Requirement: Insights détail selon type de séance
L’UI détail d’activité SHALL afficher l’analyse coach stockée et des blocs d’aide à la lecture (métriques / textes) adaptés au type de séance quand disponible.

#### Scenario: Fractionné vs EF
- **WHEN** une activité taguée `fractionne` est ouverte
- **THEN** les insights mis en avant diffèrent d’une activité taguée `ef`

### Requirement: Lecture déterministe par type de séance
L’UI du détail activité SHALL afficher un bloc de lecture déterministe (KPIs issus de `features_json`) adapté au `session_type`, avec états N/A explicites lorsque les capteurs manquent.

#### Scenario: Sortie longue avec decoupling
- GIVEN une activité `sortie_longue` dont `features_json` contient decoupling et splits
- WHEN l’utilisateur ouvre le détail
- THEN les KPIs longue (dérive cardiaque, splits) sont visibles en français
- AND aucune valeur inventée n’apparaît pour les champs `null`

#### Scenario: Fractionné sans détection
- GIVEN `session_type` = `fractionne` et `intervals` null
- WHEN le détail est affiché
- THEN un message indique que les intervalles n’ont pas pu être détectés
- AND les graphes de streams restent disponibles

### Requirement: Graphes adaptés au template de séance
L’UI SHALL adapter les graphes de streams au template du type de séance (overlays zones FC, bandes d’allure, segments travail/récup) lorsque les données features le permettent, sans recalcul métier côté front.

#### Scenario: Overlay zones sur EF
- GIVEN une activité `ef` avec `time_in_zone` et stream FC
- WHEN le détail affiche les graphes
- THEN un overlay ou résumé de zones est proposé
- AND le front consomme uniquement l’API (pas de recalcul des zones)

#### Scenario: Série absente
- GIVEN une activité sans watts
- WHEN les graphes sont rendus
- THEN la série watts n’est pas affichée

### Requirement: Tableau splits ou répétitions
L’UI du détail SHALL afficher un tableau des splits km et, si `intervals` est présent, un tableau des répétitions (allure, durée, FC).

#### Scenario: Splits disponibles
- GIVEN `features_json.splits_km` non vide
- WHEN l’utilisateur consulte le détail
- THEN un tableau des splits est affiché

#### Scenario: Intervalles détectés
- GIVEN `features_json.intervals` avec des segments travail
- WHEN l’utilisateur consulte le détail
- THEN un tableau des répétitions est affiché

### Requirement: Courbe de forme sur l’accueil
L’UI Home SHALL afficher une courbe de forme (CTL, ATL, et/ou TSB) à partir de l’API load-series, avec le statut de forme courant et un état vide FR si indisponible.

#### Scenario: Série disponible
- GIVEN `/api/analytics/load-series` avec `available` vrai
- WHEN l’utilisateur ouvre l’accueil
- THEN la courbe de forme est visible
- AND le badge/statut (ex. Frais, Fatigue) est affiché

#### Scenario: Pas assez de TRIMP
- GIVEN la série indisponible
- WHEN l’accueil charge l’évolution
- THEN un message FR explique qu’il faut plus de sorties avec FC/zones
- AND aucun graphique trompeur n’est inventé

### Requirement: Plan vs réalisé sur Coach
L’UI Coach SHALL afficher pour chaque item du plan un statut (fait, manqué, à venir) et le score d’adhérence lorsque l’API l’expose.

#### Scenario: Plan avec adhérence
- GIVEN un plan et une adhérence calculée
- WHEN la page Coach affiche le calendrier
- THEN les items matched/missed/upcoming sont distincts visuellement
- AND le pourcentage d’adhérence est visible

#### Scenario: Sans plan
- GIVEN un plan vide
- WHEN Coach est ouvert
- THEN aucun score d’adhérence trompeur n’apparaît

### Requirement: Affichage prochaines séances
L’UI SHALL afficher un bloc « Prochaines séances » (source règles) sur Home et Coach, à partir de l’API, sans recalcul métier côté front.

#### Scenario: Home
- **GIVEN** `next_sessions.available=true`
- **WHEN** l’utilisateur ouvre Home
- **THEN** la liste des séances prescrites (date, type, titre, rationale courte) est visible

#### Scenario: Indisponible
- **GIVEN** `available=false`
- **WHEN** l’utilisateur ouvre Home
- **THEN** un message FR explique le manque de données (ex. taguer les séances)

### Requirement: Affichage tendances par type
L’UI SHALL afficher un panel de tendances par `session_type` (direction, delta allure, label FR) sur Home (résumé) et une vue détaillée (Home section ou Predictions).

#### Scenario: Résumé Home
- **GIVEN** au moins une tendance `available`
- **WHEN** Home est affichée
- **THEN** un résumé des directions (mieux / stable / moins bon) par type est visible

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
