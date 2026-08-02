## Context

Les activités stockent déjà `streams_json` (pace, FC, cadence, altitude, watts) et un `session_type` manuel/suggéré. L’UI détail affiche les séries brutes ; l’overview agrège volume/allure/FC avec une « charge » = spike km 14j ; le coach activité ne reçoit que le résumé (pas de streams ni KPIs dérivés). Walk/Hiking Apple peuvent entrer dans le même pool analytics.

Front (React) / back (FastAPI) : **tous les calculs métier côté API** ; le web ne fait que rendre KPIs + graphes.

## Goals / Non-Goals

**Goals:**
- Extraire et persister des features déterministes par activité
- Recalcul au Sync + batch Admin
- Analytics filtrées running + charge TRIMP/ACR
- UI détail templateée par `session_type`
- Coach activité alimenté par `features_json` (faits seulement)

**Non-Goals:**
- TSS / NP / VDOT / HRV / multi-sport / nouveaux ingest
- Refonte globale Home/Predictions hors charge et filtres
- Feature store hors Postgres

## Decisions

1. **Persistance `features_json` JSONB sur `activities`**  
   Une colonne versionnée (`schema_version`, `computed_at`, `profile_fingerprint`) plutôt qu’une table séparée en V1.  
   *Alt. rejetée* : table `activity_features` (meilleure pour SQL agrégé, plus de migration) — reportée si besoin de requêtes SQL lourdes.

2. **Moteur `services/activity_features.py`**  
   Entrée : Activity + zones profil (+ cibles prédictions optionnelles). Sortie : dict features.  
   Hooks : après upsert Sync streams ; `POST /api/admin/recompute-features` ; recalcul si profil FC change (fingerprint).  
   Front n’appelle jamais le moteur.

3. **Features transverses toujours calculées si données**  
   - `quality_flags` : has_hr, has_streams, has_gps, running_eligible  
   - `splits_km[]` : pace, FC moy, cadence  
   - `time_in_zone` Z1–Z5 (si HR + zones profil)  
   - `decoupling` (1re vs 2e moitié FC/allure)  
   - `trimp_edwards` (minutes × facteur zone)  
   - `cv_pace`, `cv_hr`  
   Absents → champ `null` + raison dans `unavailable[]`, jamais 0 silencieux.

4. **Features par famille `session_type`**  
   | Famille | Extra |
   |---------|--------|
   | ef / recup / endurance_active | % Z1–Z2, pics hors zone |
   | sortie_longue | decoupling, split +/- |
   | tempo / seuil | régularité vs bande cible si dispo |
   | fractionné / vma / côtes | segments travail/récup (heuristique velocity) |
   | competition / test | écart vs prédiction distance si ancre |
   | autre / null | transverses only |

5. **Détection d’intervalles**  
   Heuristique relative à la médiane d’allure de la séance + `moving`. Confiance faible → `intervals: null` + flag. Pas de labeling manuel V1.

6. **Pool analytics running**  
   Éligible : `sport_type` ∈ Run/TrailRun/VirtualRun **ou** source Apple promue Run. Walk/Hiking exclus des tendances allure, prédictions ancrage, et compte « ≥5 sorties » pour évolution. Volume total peut encore lister séparément si utile (hors scope UI V1).

7. **Charge overview**  
   Conserver catégorie volume existante ; **ajouter** `load` : TRIMP 7j / 28j + ratio ACR. Seuil `charge_elevee` peut combiner volume **ou** ACR élevé (documenté dans API).  
   *Alt. rejetée* : remplacer purement le volume (trop cassant pour utilisateurs habitués).

8. **API**  
   - `GET /api/activities/{id}` enrichi : `features_json`  
   - Overview analytics : champs `load`, `volume_easy_km_28d`, `volume_quality_km_28d`, `running_eligible_count`  
   Pas d’endpoint features séparé V1.

9. **UI détail**  
   Composant `SessionInsights` (KPIs + N/A) + `StreamCharts` avec overlays optionnels (zones, segments) selon template. Logique de mapping type → template côté web à partir du JSON features (pas de recalcul).

10. **Coach**  
    `_activity_context` inclut `features_json` (tronqué si besoin). Spec coach inchangée formellement ; comportement amélioré via données.

## Risks / Trade-offs

- [Heuristique intervalles fausse] → Mitigation : confiance + N/A ; pas d’ancrage prédictions sur intervalles auto  
- [Zones absentes sans profil HR] → Mitigation : time_in_zone/TRIMP null ; UI invite profil  
- [Sync plus lent] → Mitigation : features après streams, skip si fingerprint inchangé  
- [JSONB non indexable finement] → Mitigation : OK pour volume local ; table dédiée plus tard  
- [Walk exclus = moins d’activités « ≥5 »] → Mitigation : message `donnees_insuffisantes` clair  

## Migration Plan

1. `ALTER TABLE … ADD COLUMN IF NOT EXISTS features_json` (pattern `db.py` existant)
2. Déployer moteur + hooks Sync
3. Admin recompute batch sur historique
4. UI détail + overview load
5. Rollback : ignorer `features_json` / champs load (non destructif)

## Open Questions

- Formule TRIMP exacte : Edwards (zones) figée V1 ; Banister si demande ultérieure.
- Seuil ACR « élevé » : défaut 1.3 (ajustable plus tard via settings).
- Recalcul auto à chaque changement `session_type` : **oui** (PATCH activité).
