# FC × météo (même allure)

Analyse **déterministe** (pas d’IA pour les chiffres) :

1. Filtrer sorties route/piste, ≥3 km, FC + température, D+/km faible.
2. Prendre la bande d’allure médiane (±8 s/km, élargi à ±12 si besoin).
3. Comparer FC moyenne frais (<12 °C) vs chaud (≥20 °C) et pente bpm/°C.

L’IA peut commenter ces résultats ; elle ne doit pas inventer de Δ FC.
