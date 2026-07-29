"""Client HTTP Strava."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import Settings

logger = logging.getLogger("sync.strava")

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"


class StravaError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class StravaClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def build_authorize_url(self, state: str = "runningdashboard") -> str:
        if not self.settings.strava_client_id:
            raise StravaError("STRAVA_CLIENT_ID manquant | action=configurer_.env")
        params = {
            "client_id": self.settings.strava_client_id,
            "redirect_uri": self.settings.strava_redirect_uri,
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": self.settings.strava_scopes,
            "state": state,
        }
        return f"{STRAVA_AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> dict[str, Any]:
        return self._token_request(
            {
                "client_id": self.settings.strava_client_id,
                "client_secret": self.settings.strava_client_secret,
                "code": code,
                "grant_type": "authorization_code",
            }
        )

    def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        return self._token_request(
            {
                "client_id": self.settings.strava_client_id,
                "client_secret": self.settings.strava_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            }
        )

    def list_activities(
        self,
        access_token: str,
        *,
        after: int | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"page": page, "per_page": per_page}
        if after is not None:
            params["after"] = after
        return self._api_get("/athlete/activities", access_token, params=params)

    def get_activity(self, access_token: str, activity_id: int) -> dict[str, Any]:
        return self._api_get(f"/activities/{activity_id}", access_token)

    def get_streams(self, access_token: str, activity_id: int) -> dict[str, Any]:
        keys = (
            "time,distance,latlng,altitude,velocity_smooth,heartrate,"
            "cadence,watts,temp,moving,grade_smooth"
        )
        data = self._api_get(
            f"/activities/{activity_id}/streams",
            access_token,
            params={"keys": keys, "key_by_type": "true"},
        )
        # key_by_type=true returns object; without it returns list
        if isinstance(data, list):
            return {item["type"]: item for item in data if "type" in item}
        return data

    def _token_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(STRAVA_TOKEN_URL, data=payload)
        if response.status_code >= 400:
            logger.error(
                "Échec token Strava | status=%s | detail=%s | action=vérifier_client_id_secret",
                response.status_code,
                response.text[:300],
            )
            raise StravaError(
                f"Échec OAuth Strava (HTTP {response.status_code})",
                status_code=response.status_code,
            )
        return response.json()

    def _api_get(
        self,
        path: str,
        access_token: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> Any:
        headers = {"Authorization": f"Bearer {access_token}"}
        with httpx.Client(timeout=60.0) as client:
            response = client.get(
                f"{STRAVA_API_BASE}{path}",
                headers=headers,
                params=params,
            )
        if response.status_code >= 400:
            logger.error(
                "Échec API Strava | path=%s | status=%s | detail=%s",
                path,
                response.status_code,
                response.text[:300],
            )
            raise StravaError(
                f"Échec API Strava {path} (HTTP {response.status_code})",
                status_code=response.status_code,
            )
        return response.json()
