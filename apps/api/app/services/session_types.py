"""Types de séance running (attribution manuelle, pour le coach IA)."""

from __future__ import annotations

from typing import TypedDict


class SessionTypeDef(TypedDict):
    id: str
    label_fr: str
    description_fr: str


SESSION_TYPES: tuple[SessionTypeDef, ...] = (
    {
        "id": "ef",
        "label_fr": "EF — Endurance fondamentale",
        "description_fr": "Allure facile, conversationnelle (zone basse).",
    },
    {
        "id": "recuperation",
        "label_fr": "Récupération",
        "description_fr": "Footing très léger après effort ou jour de récup.",
    },
    {
        "id": "endurance_active",
        "label_fr": "Endurance active",
        "description_fr": "Allure un peu plus soutenue que l’EF, encore contrôlée.",
    },
    {
        "id": "sortie_longue",
        "label_fr": "Sortie longue",
        "description_fr": "Volume long, souvent en EF ou progressif.",
    },
    {
        "id": "tempo",
        "label_fr": "Tempo / allure spécifique",
        "description_fr": "Effort continu à allure course ou semi.",
    },
    {
        "id": "seuil",
        "label_fr": "Seuil",
        "description_fr": "Travail au seuil lactique (blocs ou continu).",
    },
    {
        "id": "fractionne",
        "label_fr": "Fractionné",
        "description_fr": "Intervalles (ex. 400 m, 1000 m) avec récupérations.",
    },
    {
        "id": "vma",
        "label_fr": "VMA",
        "description_fr": "Intervalles courts / moyens autour de la VMA.",
    },
    {
        "id": "cotes",
        "label_fr": "Côtes",
        "description_fr": "Répétitions en montée.",
    },
    {
        "id": "fartlek",
        "label_fr": "Fartlek",
        "description_fr": "Variations d’allure libres / ludiques.",
    },
    {
        "id": "competition",
        "label_fr": "Compétition",
        "description_fr": "Course officielle ou simulation compétition.",
    },
    {
        "id": "test",
        "label_fr": "Test",
        "description_fr": "Évaluation (VMA, Cooper, chrono, etc.).",
    },
    {
        "id": "autre",
        "label_fr": "Autre",
        "description_fr": "Séance hors catégories ci-dessus.",
    },
)

SESSION_TYPE_IDS = frozenset(item["id"] for item in SESSION_TYPES)


def label_for(session_type: str | None) -> str | None:
    if not session_type:
        return None
    for item in SESSION_TYPES:
        if item["id"] == session_type:
            return item["label_fr"]
    return session_type
