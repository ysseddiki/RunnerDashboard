## Context

`features_json.trimp_edwards` et un snapshot ACR (7j/28j) existent déjà. Le plan coach est dans `coach_plans.plan_json` (items : date, session_type, title, details, target_pace, duration_or_distance) sans lien vers les activités. Front/back : **tous calculs côté API**.

## Goals / Non-Goals

**Goals:**
- Série journalière TRIMP → ATL / CTL / TSB déterministes
- Lecture de forme (fraîcheur / fatigue / surcharge) sur Home
- Matching plan ↔ activités + score d’adhérence
- Contexte coach enrichi (faits load + adhérence)

**Non-Goals:**
- next_sessions, HRV, TSS, édition manuelle des matchs, multi-athlète

## Decisions

1. **Formules Banister simplifiées (EMA)**  
   - Jour j : `daily_trimp[j]` = somme TRIMP des activités running ce jour (0 si aucune).  
   - `ATL[j] = ATL[j-1] + (daily_trimp[j] − ATL[j-1]) / 7`  
   - `CTL[j] = CTL[j-1] + (daily_trimp[j] − CTL[j-1]) / 42`  
   - `TSB[j] = CTL[j] − ATL[j]`  
   Init : ATL=CTL=0 au premier jour avec historique (warmup ~42j avant affichage utile).  
   *Alt. rejetée* : EWMA lambda TrainingPeaks exacte (équivalent proche ; on documente τ=7/42).

2. **Calcul on-read V1**  
   Service `training_load.build_series(db, days=84)` à chaque overview / endpoint dédié. Volume local OK.  
   *Alt.* : table `daily_load` matérialisée — reportée si perf.

3. **API**  
   - Enrichir `/api/analytics/overview` : `form: { atl, ctl, tsb, status, series_tail }`  
   - Optionnel `GET /api/analytics/load-series?days=84` pour le chart (évite payload Home trop gros)  
   - `GET /api/coach/adherence` ou champ dans `GET /api/coach/plan` : `adherence`  
   Front n’appelle jamais Ollama.

4. **Lecture forme (seuils documentés)**  
   | status | condition (TSB du jour) |  
   |--------|-------------------------|  
   | `fatigue` | TSB ≤ −20 |  
   | `productif` | −20 < TSB ≤ −5 |  
   | `neutre` | −5 < TSB < 10 |  
   | `frais` | TSB ≥ 10 |  
   Surcharge : conserver ACR≥1.3 **ou** ATL>>CTL prolongé ; message FR distinct.

5. **Matching plan ↔ activité**  
   Pour chaque item plan avec `date` :  
   - candidats = activités running le jour J ± 1 jour, non déjà matchées  
   - score : même `session_type` (+2), distance proche si parsable (+1), même jour (+1)  
   - meilleur score ≥ 2 → `matched` ; sinon `missed` si date passée ; `upcoming` si future  
   Confiance `haute|moyenne|basse`. Un activity_id au plus une fois.

6. **Score adhérence**  
   Sur items dont date ∈ [aujourd’hui−7j, fin du plan] passés :  
   `adherence_pct = 100 * matched / planned_past`  
   Breakdown : matched / missed / type_mismatch (match date mais type différent, compté matched_weak).

7. **UI**  
   - Home : `FormChart` (CTL/ATL/TSB) + badge statut  
   - Coach : liste plan avec statut (fait / manqué / à venir) + % semaine  
   - Pas de recalcul métier front.

8. **Coach context**  
   `build_coach_context` ajoute `form` (atl/ctl/tsb/status) et `adherence` (pct, missed_titles). Prompt : ne pas inventer.

## Risks / Trade-offs

- [Peu de TRIMP → forme trompeuse] → Mitigation : `available=false` si &lt; 14 jours avec TRIMP  
- [Plan LLM vague (pas de date/type)] → Mitigation : items incomplets exclus du score + warning FR  
- [Double match] → Mitigation : greedy score décroissant, activity unique  
- [Warmup CTL 42j] → Mitigation : afficher “stabilisation” si historique &lt; 42j  

## Migration Plan

1. Déployer services + endpoints (pas de migration DB obligatoire)  
2. UI Home + Coach  
3. Rollback : ignorer nouveaux champs JSON (non destructif)

## Open Questions

- Exposer série complète sur overview vs endpoint dédié : **dédié** pour le chart (décision figée ci-dessus).  
- Seuil TSB −20 / +10 : ajustables plus tard via settings si besoin.
