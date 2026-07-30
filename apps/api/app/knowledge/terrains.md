# Terrains (contexte)

Le terrain est **orthogonal** au `session_type` : une EF peut être route ou trail.

Valeurs : `route`, `trail`, `piste`, `indoor`, `mixed`.

- Prévisions d’allure route : préférer ancres `route` / `piste` ; baisser la confiance si ancre trail.
- Coach : ne pas comparer une allure trail à une cible route plate.
