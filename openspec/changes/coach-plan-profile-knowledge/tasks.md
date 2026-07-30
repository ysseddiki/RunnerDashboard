## 1. Infra & keep-alive

- [x] 1.1 Ajouter `OLLAMA_KEEP_ALIVE` (défaut `-1`) dans config API, `.env.example`, Compose
- [x] 1.2 Passer `keep_alive` depuis `OllamaClient.chat` (plus hardcodé `10m`)

## 2. Knowledge pack

- [x] 2.1 Créer `apps/api/app/knowledge/` (zones, allure/riegel, plan calendrier, projections)
- [x] 2.2 Service `knowledge.load_pack()` + injection dans prompts coach/plan/analyse

## 3. Profil athlète

- [x] 3.1 Modèle `AthleteProfile` + calcul zones / VO2 déterministes
- [x] 3.2 Router `GET/PUT /api/profile`
- [x] 3.3 Page web `/profile` + nav

## 4. Plan calendrier découplé

- [x] 4.1 Tables stockage plan + `GET /api/coach/plan` + `POST /api/coach/plan/refresh`
- [x] 4.2 Génération plan via Ollama (knowledge + contexte + profil), single-flight
- [x] 4.3 Trigger refresh après sync si nouvelles activités
- [x] 4.4 UI Coach : charger plan hors « Lancer l’analyse » ; advise = Q&A

## 5. Analyse par activité

- [x] 5.1 Colonnes analyse sur `activities` + endpoint/job génération
- [x] 5.2 Post-sync : enfiler analyses manquantes (1 concurrent)
- [x] 5.3 UI détail : afficher analyse + insights selon `session_type`

## 6. Projection

- [x] 6.1 `GET /api/projections/overview` déterministe
- [x] 6.2 Graph ECharts sur Profil (et lien Docs)

## 7. Docs & polish

- [x] 7.1 Onglet Docs mis à jour (profil, plan, knowledge, keep-alive)
- [x] 7.2 README : keep_alive + nouvelles pages
