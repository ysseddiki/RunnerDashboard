## Why

L’UI actuelle (vert + surfaces glass + pills/cards denses) est cohérente mais encore « outil » et peu alignée avec les goûts de marque (bleu / orange) ni avec un produit 2026 (dark mode, skeletons, hiérarchie typo, moins de clutter). Un design system unifié est nécessaire avant de retoucher chaque page, sinon le travail se refait deux fois.

## What Changes

- Pivot de palette : **bleu** (primary) + **orange** (accent / CTA), avec succès / danger distincts
- **Dark mode** utilisateur (préférence persistée + respect système)
- Tokens CSS unifiés (couleur, typo, surface, motion) ; branding renforcé (shell + login)
- Typographie : hiérarchie plus marquée (display / titres de page)
- Fond / atmosphère : moins de glass, surfaces opaques, ambiance bleu-orange
- Moins de cards/pills ; panels collapsibles (afficher/masquer, pas drag-and-drop)
- Skeletons / empty states clairs au chargement
- Alignement Activités / détail / Home / Coach / Prévisions / Admin
- Graphs ECharts enrichis (rester sur ECharts) : plages, légende, UX
- Motion intentionnelle + responsive + a11y (focus, contraste)

## Non-goals

- Pas de migration de lib de charts (Plotly / Recharts / etc.)
- Pas de dashboard drag-and-drop libre (react-grid-layout) dans cette change
- Pas de refonte métier API / sync / coach LLM
- Pas de i18n hors français

## Capabilities

### New Capabilities

- `design-system`: Tokens, thèmes light/dark, composants Panel/Skeleton/Empty, règles de densité visuelle et branding

### Modified Capabilities

- `ui`: Apparence globale, listes/détail, loading/empty, cohérence multi-pages, graphs
- `settings`: Préférence de thème (clair / sombre / système)

## Impact

- Principalement `apps/web` (`App.css`, Login, Layout, pages, StreamCharts)
- Possible endpoint / champ settings pour le thème (API + Postgres) ou `localStorage` en V1
- Docs UI FR si nécessaire ; pas d’impact Strava / Ollama
