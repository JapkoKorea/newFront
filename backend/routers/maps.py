import os
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_PROJECT_ROOT / ".env.local")
load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv(_BACKEND_ROOT / ".env")

router = APIRouter(prefix="/api/maps", tags=["maps"])

GOOGLE_MAPS_SERVER_KEY = (
    os.getenv("GOOGLE_MAPS_SERVER_KEY")
    or os.getenv("GOOGLE_MAPS_API_KEY")
    or os.getenv("NEXT_PUBLIC_GOOGLE_MAPS_KEY")
    or os.getenv("VITE_GOOGLE_MAPS_KEY")
    or ""
).strip()


def _require_maps_key() -> str:
    if not GOOGLE_MAPS_SERVER_KEY:
        raise HTTPException(status_code=500, detail="Google Maps key is not configured")
    return GOOGLE_MAPS_SERVER_KEY


@router.get("/places/autocomplete")
async def autocomplete_places(
    q: str = Query(..., min_length=2),
    language: str = Query("ko"),
    region: str = Query("jp"),
):
    key = _require_maps_key()
    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    params = {
        "input": q.strip(),
        "language": language,
        "components": f"country:{region}",
        "key": key,
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url, params=params)

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Places autocomplete request failed")

    payload = resp.json()
    status = payload.get("status")
    if status not in {"OK", "ZERO_RESULTS"}:
        raise HTTPException(
            status_code=502,
            detail=f"Places autocomplete error: {status}",
        )

    predictions = payload.get("predictions", [])
    data = []
    for p in predictions[:12]:
        fmt = p.get("structured_formatting", {})
        data.append(
            {
                "place_id": p.get("place_id", ""),
                "description": p.get("description", ""),
                "primary_text": fmt.get("main_text") or p.get("description", ""),
                "secondary_text": fmt.get("secondary_text") or "",
            }
        )

    return {"predictions": data}


@router.get("/places/details")
async def place_details(
    place_id: str = Query(..., min_length=2),
    language: str = Query("ko"),
):
    key = _require_maps_key()
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "place_id,name,formatted_address,geometry",
        "language": language,
        "key": key,
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url, params=params)

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Places details request failed")

    payload = resp.json()
    status = payload.get("status")
    if status != "OK":
        raise HTTPException(status_code=502, detail=f"Places details error: {status}")

    result = payload.get("result", {})
    location = (result.get("geometry") or {}).get("location") or {}
    if "lat" not in location or "lng" not in location:
        raise HTTPException(status_code=502, detail="Invalid place location response")

    return {
        "place": {
            "place_id": result.get("place_id") or place_id,
            "name": result.get("name") or "",
            "address": result.get("formatted_address") or "",
            "location": {
                "lat": float(location["lat"]),
                "lng": float(location["lng"]),
            },
        }
    }
