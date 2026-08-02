## 1. Fondations tokens & thèmes (PR A)

- [x] 1.1 Définir la palette bleu/orange + ok/warn/danger dans `App.css` (`:root` + `[data-theme="dark"]`)
- [x] 1.2 Ajouter helper thème (`clair` | `sombre` | `système`) avec `localStorage` + écoute `prefers-color-scheme`
- [x] 1.3 Brancher `data-theme` sur le document racine au boot
- [x] 1.4 Remplacer glass généralisé par surfaces opaques (`--surface`, `--surface-raised`)
- [x] 1.5 Ajuster typo (échelle titres page / section / body) avec Syne/Manrope

## 2. Shell, login & settings thème (PR A/B)

- [x] 2.1 Renforcer le branding dans `Layout` (nom produit hero-level dans le shell)
- [x] 2.2 Réaligner `LoginPage` sur la nouvelle palette (même famille light/dark)
- [x] 2.3 Ajouter le sélecteur de thème dans Paramètres (Profil) et/ou shell
- [x] 2.4 Vérifier focus visibles et contraste des contrôles de nav

## 3. Composants système (PR B)

- [x] 3.1 Créer composant `Panel` collapsible + persistance `localStorage` par id
- [x] 3.2 Créer skeletons liste/détail et pattern empty state FR
- [x] 3.3 Alléger pills/boutons (type séance dominant ; terrain/source secondaires)
- [x] 3.4 Mettre à jour `.btn` / badges source pour accent orange + primary bleu

## 4. Activités & détail (PR C)

- [x] 4.1 Appliquer tokens/skeletons à la liste Activités et aux tuiles
- [x] 4.2 Affiner hiérarchie pills + loading clair sur `ActivitiesPage`
- [x] 4.3 Aligner page détail (carte, grilles, GPS, détail technique) sur nouveaux panels
- [x] 4.4 Intégrer / alléger le bloc Apple Santé dans le flow détail
- [x] 4.5 Passes responsive &lt;900px et tablette 900–1100px

## 5. Graphs ECharts (PR C/D)

- [x] 5.1 Légende unifiée plages (intervalles verts / attention ambre-rouge)
- [x] 5.2 Améliorer zoom/brush et feedback au clic sur puce d’attention
- [x] 5.3 Harmoniser couleurs séries avec tokens (pace/FC/cadence)

## 6. Cohérence multi-pages & motion (PR D)

- [x] 6.1 Aligner Home, Coach, Prévisions, Admin, Docs sur titres de section + Panel
- [x] 6.2 Remplacer loadings texte muted par skeletons/empty où manquant
- [x] 6.3 Ajouter 2–3 motions intentionnelles (liste, menu type, focus plage)
- [x] 6.4 Revue a11y focus/contraste sur menus portal et formulaires
- [x] 6.5 Smoke build web (`npm run build`) + passe visuelle light/dark

## 7. Docs / openspec

- [x] 7.1 Noter dans README (si besoin) le toggle thème
- [x] 7.2 Marquer les tâches done au fil des PR ; préparer archive OpenSpec en fin de change
