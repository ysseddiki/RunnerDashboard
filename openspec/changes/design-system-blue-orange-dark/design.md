## Context

L’UI web (`apps/web`) s’appuie sur des tokens CSS verts, des surfaces semi-transparentes (`backdrop-filter`), beaucoup de `panel-block` / pills, et un login dark isolé. Les graphs utilisent déjà **ECharts**. Le front reste présentation seule ; le métier reste dans FastAPI.

Cette change pose un design system bleu/orange + dark mode, puis aligne les pages et l’UX (panels, skeletons, graphs, a11y) sans toucher sync/coach.

## Goals / Non-Goals

**Goals:**

- Palette et thèmes light/dark cohérents (bleu primary, orange accent)
- Branding visible (shell + login + titres)
- Densité visuelle réduite (moins glass/cards/pills)
- Panels collapsibles (préférence locale)
- Loading/empty clairs ; graphs ECharts enrichis ; responsive + a11y
- Préférence thème exposée dans Paramètres

**Non-Goals:**

- Changer de lib de charts
- Drag-and-drop de widgets
- Refonte API métier Strava / Apple / Ollama
- Multi-langue

## Decisions

### 1. Tokens CSS + `data-theme` plutôt qu’un CSS-in-JS

- **Choix** : variables `:root` / `[data-theme="dark"]` (et optionnellement `prefers-color-scheme` si thème = système)
- **Pourquoi** : déjà le pattern du repo ; zéro dépendance ; dark mode simple
- **Alt.** : Tailwind / styled-components — trop lourd pour le gain

### 2. Rôles couleur

| Token | Rôle | Exemple light |
|---|---|---|
| `--brand` | Primary / liens / titres | bleu profond |
| `--accent` | CTA / highlights | orange |
| `--ok` | Succès / forme OK | teal (pas l’orange) |
| `--warn` / `--danger` | Attention / erreur | ambre / rouge |

Évite collision orange = CTA + warning + Strava.

### 3. Thème : localStorage V1, settings API si déjà simple

- **Choix V1** : `localStorage` + toggle Paramètres / shell (`clair` \| `sombre` \| `système`)
- **Pourquoi** : pas bloquant API ; front-only
- **Évolution** : persister via settings existants si un endpoint clé/valeur est déjà là
- **Alt.** : forcer dark-only — rejeté (user veut les deux)

### 4. Panels modulables = collapse, pas grid libre

- Composant `Panel` : titre, sous-titre optionnel, `collapsible`, id de préférence
- Préférences `localStorage` `panel:<id>=open|closed`
- **Alt.** : `react-grid-layout` — reporté (mobile + coût)

### 5. Graphs : rester sur ECharts

- Enrichir markArea / légende / brush / sync éventuelle map↔courbes
- **Alt.** Plotly/uPlot — pas justifié

### 6. Front/back

- 100 % présentation dans `apps/web`
- API uniquement si on choisit de persister le thème côté serveur (optionnel)

### 7. Livraison PR

Plusieurs PR thématiques sur la même change OpenSpec (fondations → shell → composants → pages → graphs), mergeables indépendamment quand possible.

## Risks / Trade-offs

- [Rebrand casse la « mémoire » vert] → Preview light/dark sur Activités + Login avant généralisation
- [Orange trop présent] → Accent réservé CTA/attention ; primary bleu pour structure
- [localStorage ≠ multi-device] → Documenté ; upgrade settings plus tard
- [Scope large] → PR par phase ; tasks ordonnées ; ne pas tout merger d’un coup si CI fragile
- [Contraste dark mode] → Vérifier pills/badges/weather sur fond sombre

## Migration Plan

1. Introduire tokens + `data-theme` sans retirer le vert d’un coup (alias temporaires si besoin)
2. Brancher Layout/Login
3. Migrer composants partagés (btn, panel, activity tile)
4. Pages une par une
5. Retirer aliases verts obsolètes
6. Rollback = revert PR de tokens + theme attribute

## Open Questions

- Nom produit affiché en hero : garder « RunningDashboard » ou libellé plus court ?
- Persistance thème serveur dans cette change ou V1 localStorage seulement ? (**défaut : localStorage**)
