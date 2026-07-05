"""Sourcing Group API — de webkant van het rentabiliteitsmodel.

Endpoints:
  GET  /                  -> dashboard (werkstroom 1: pand invoeren, score zien)
  POST /api/beoordeling   -> JSON-invoer (pand + bestedingsplan + financiering) -> beoordeling
  POST /api/ranking       -> upload xlsx/csv-database van panden -> ranglijst (werkstroom 2)

Starten:
  uvicorn api.main:app --reload
"""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse

from batch.rank import rank
from engine import beoordeel
from engine.model import Beoordeling
from engine.schema import BeoordelingsAanvraag

app = FastAPI(title="Sourcing Group — Rentabiliteitsmodel")

WEB_DIR = Path(__file__).resolve().parent.parent / "web"


@app.get("/")
def dashboard() -> FileResponse:
    return FileResponse(WEB_DIR / "dashboard.html")


@app.post("/api/beoordeling")
def api_beoordeling(aanvraag: BeoordelingsAanvraag) -> Beoordeling:
    return beoordeel(aanvraag)


@app.post("/api/ranking")
async def api_ranking(bestand: UploadFile, top: int | None = None) -> list[dict]:
    suffix = Path(bestand.filename or "upload.xlsx").suffix.lower()
    if suffix not in (".xlsx", ".xlsm", ".csv"):
        raise HTTPException(400, "Upload een .xlsx- of .csv-bestand")
    inhoud = await bestand.read()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(inhoud)
        tmp.flush()
        ranglijst = rank(Path(tmp.name), top)
    # NaN (bv. bij rijen met fouten) is geen geldige JSON
    return ranglijst.where(pd.notna(ranglijst), None).to_dict(orient="records")
