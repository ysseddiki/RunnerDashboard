## 1. Schéma & modèle API

- [x] 1.1 Ajouter `features_json` JSONB sur `Activity` + `ALTER … IF NOT EXISTS` dans `db.py`
- [x] 1.2 Étendre `ActivityDetail` (schemas + types front) avec `features_json`
- [x] 1.3 Documenter le contrat JSON features (`schema_version`, flags, unavailable) dans un module/constantes API

## 2. Moteur activity-features

- [x] 2.1 Créer `services/activity_features.py` : parsing streams, quality_flags, running_eligible
- [x] 2.2 Implémenter features transverses : splits_km, time_in_zone, decoupling, trimp_edwards, cv_pace/cv_hr
- [x] 2.3 Implémenter enrichissements par famille `session_type` (EF, longue, tempo/seuil, intervalles, compétition)
- [x] 2.4 Heuristique détection intervalles + confiance / null si insuffisant
- [x] 2.5 Fingerprint profil (zones) + skip recalcul si inchangé
- [x] 2.6 Tests unitaires Python sur fixtures streams (EF stable, fractionné, sans FC)

## 3. Hooks Sync / Admin / PATCH

- [x] 3.1 Appeler le calcul features après upsert streams dans `sync.py`
- [x] 3.2 Recalculer features sur PATCH `session_type` (et terrain si pertinent)
- [x] 3.3 Endpoint Admin `POST /api/admin/recompute-features` + logs FR succès/échecs
- [x] 3.4 Recalcul batch quand le profil FC/zones change

## 4. Analytics

- [x] 4.1 Filtrer le pool running éligible dans `build_overview` (exclure Walk/Hiking)
- [x] 4.2 Ajouter `load` (trimp_7d, trimp_28d, acr) + indisponibilité explicite
- [x] 4.3 Ajouter volumes 28j easy / quality / untagged
- [x] 4.4 Ajuster catégorie `charge_elevee` (volume et/ou ACR) + tests analytics
- [x] 4.5 Mettre à jour schemas/réponse overview côté API

## 5. Coach (contexte)

- [x] 5.1 Inclure `features_json` (tronqué si besoin) dans `_activity_context` du coach activité

## 6. UI web

- [x] 6.1 Composant `SessionInsights` (KPIs + N/A FR) branché sur `features_json` / `session_type`
- [x] 6.2 Tableau splits km + tableau répétitions si `intervals`
- [x] 6.3 Enrichir `StreamCharts` : overlays zones / segments selon template (données API only)
- [x] 6.4 Intégrer insights + tableaux dans `ActivityDetailPage`
- [x] 6.5 Home Évolution : afficher charge TRIMP/ACR + répartition easy/quality (états vides FR)

## 7. Vérification

- [x] 7.1 Smoke Sync → features présentes sur activité Strava avec streams
- [x] 7.2 Smoke détail UI par type (EF, longue, fractionné) + overview load
- [x] 7.3 Mettre à jour README brièvement (features / charge) si besoin
