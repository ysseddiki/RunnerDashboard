"""Contexte terrain (orthogonal au type de séance)."""

from __future__ import annotations

from typing import Any, TypedDict


class TerrainDef(TypedDict):
    id: str
    label_fr: str
    description_fr: str


TERRAINS: tuple[TerrainDef, ...] = (
    {
        "id": "route",
        "label_fr": "Route",
        "description_fr": "Bitume, chemin plat / urbain.",
    },
    {
        "id": "trail",
        "label_fr": "Trail",
        "description_fr": "Sentier, chemins techniques, dénivelé.",
    },
    {
        "id": "piste",
        "label_fr": "Piste",
        "description_fr": "Piste d’athlétisme / stade.",
    },
    {
        "id": "indoor",
        "label_fr": "Indoor",
        "description_fr": "Tapis, home-trainer, salle.",
    },
    {
        "id": "mixed",
        "label_fr": "Mixte",
        "description_fr": "Plusieurs surfaces dans la même sortie.",
    },
)

TERRAIN_IDS = frozenset(item["id"] for item in TERRAINS)


def label_for(terrain: str | None) -> str | None:
    if not terrain:
        return None
    for item in TERRAINS:
        if item["id"] == terrain:
            return item["label_fr"]
    return terrain


def is_roadish(terrain: str | None) -> bool:
    """True si le terrain peut servir d’ancre pour des chronos route."""
    return terrain is None or terrain in {"route", "piste"}


def infer_terrain(
    *,
    name: str | None,
    sport_type: str | None,
    trainer: bool | None,
    distance_m: float | None,
    elevation_m: float | None,
) -> str | None:
    """Heuristique légère ; ne force pas « route » (laisse null si ambigu)."""
    if trainer:
        return "indoor"

    sport = (sport_type or "").lower()
    title = (name or "").lower()
    blob = f"{sport} {title}"

    trail_kw = (
        "trail",
        "sentier",
        "chemin",
        "ultra",
        "randonnée",
        "randonnee",
        "mountain",
        "offroad",
        "off-road",
    )
    if any(k in blob for k in trail_kw) or "trailrun" in sport.replace(" ", ""):
        return "trail"

    piste_kw = ("piste", "stade", "track", "400m", "400 m")
    if any(k in blob for k in piste_kw):
        return "piste"

    indoor_kw = ("tapis", "treadmill", "indoor", "home trainer", "hometrainer")
    if any(k in blob for k in indoor_kw):
        return "indoor"

    km = (distance_m or 0) / 1000.0
    elev = elevation_m or 0.0
    if km >= 3.0 and elev / km >= 45.0:
        return "trail"

    route_kw = ("route", "bitume", "asphalte", "road")
    if any(k in blob for k in route_kw):
        return "route"

    return None


def activity_infer(activity: Any) -> str | None:
    return infer_terrain(
        name=getattr(activity, "name", None),
        sport_type=getattr(activity, "sport_type", None),
        trainer=getattr(activity, "trainer", None),
        distance_m=getattr(activity, "distance_m", None),
        elevation_m=getattr(activity, "total_elevation_gain_m", None),
    )
