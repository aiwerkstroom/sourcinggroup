"""Scoring: KPI's -> totaalscore 0-100 + label.

De drempels en wegingen staan in config/scoring.yaml zodat ze zonder
code-aanpassing gelijkgetrokken kunnen worden met het Excel-model.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel

CONFIG_PAD = Path(__file__).resolve().parent.parent / "config" / "scoring.yaml"


class Score(BaseModel):
    totaal: float  # 0-100
    label: str
    per_kpi: dict[str, float]  # deelscores 0-100


@lru_cache(maxsize=1)
def laad_scoring_config(pad: str | None = None) -> dict:
    with open(pad or CONFIG_PAD, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _schaal(waarde: float, ondergrens: float, bovengrens: float) -> float:
    if bovengrens == ondergrens:
        return 100.0 if waarde >= bovengrens else 0.0
    frac = (waarde - ondergrens) / (bovengrens - ondergrens)
    return max(0.0, min(1.0, frac)) * 100.0


def bereken_score(kpis: dict[str, float | None]) -> Score:
    config = laad_scoring_config()
    wegingen: dict[str, float] = config["wegingen"]
    schalen: dict[str, dict] = config["schalen"]

    per_kpi: dict[str, float] = {}
    gewogen_som = 0.0
    weging_totaal = 0.0
    for kpi, weging in wegingen.items():
        waarde = kpis.get(kpi)
        if waarde is None:
            continue
        deelscore = _schaal(waarde, schalen[kpi]["min"], schalen[kpi]["max"])
        per_kpi[kpi] = round(deelscore, 1)
        gewogen_som += deelscore * weging
        weging_totaal += weging

    totaal = gewogen_som / weging_totaal if weging_totaal > 0 else 0.0

    label = "Onvoldoende"
    for regel in sorted(config["labels"], key=lambda r: r["vanaf"], reverse=True):
        if totaal >= regel["vanaf"]:
            label = regel["label"]
            break

    return Score(totaal=round(totaal, 1), label=label, per_kpi=per_kpi)
