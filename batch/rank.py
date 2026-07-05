"""Werkstroom 2: een database van panden doorlopen en ranken op rentabiliteit.

Leest een Excel/CSV met één pand per rij (zoals Yield Report Database.xlsx),
laat elk pand door dezelfde engine lopen als werkstroom 1, en levert een
gesorteerde ranglijst op.

Gebruik:
    python -m batch.rank "data/Yield Report Database.xlsx" --top 25

De kolomnamen van jouw database worden gemapt in config/kolommen.yaml;
pas dat bestand aan aan de werkelijke koppen in Yield Report Database.xlsx.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import yaml

from engine import BestedingsPost, Bestedingsplan, Financiering, Pand, beoordeel
from engine.schema import BeoordelingsAanvraag

KOLOMMEN_CONFIG = Path(__file__).resolve().parent.parent / "config" / "kolommen.yaml"


def laad_kolommap(pad: Path = KOLOMMEN_CONFIG) -> dict[str, str]:
    with open(pad, encoding="utf-8") as f:
        return yaml.safe_load(f)["kolommen"]


def rij_naar_aanvraag(rij: pd.Series, kolommap: dict[str, str]) -> BeoordelingsAanvraag:
    def veld(naam: str, default=None):
        kolom = kolommap.get(naam)
        if kolom and kolom in rij.index and pd.notna(rij[kolom]):
            return rij[kolom]
        return default

    pand_args = dict(
        adres=str(veld("adres", "")),
        koopsom=float(veld("koopsom")),
        huur_per_maand=float(veld("huur_per_maand")),
    )
    if veld("kosten_koper_pct") is not None:
        pand_args["kosten_koper_pct"] = float(veld("kosten_koper_pct"))

    plan = Bestedingsplan()
    if veld("verbouwing") is not None:
        plan = Bestedingsplan(posten=[BestedingsPost(omschrijving="Verbouwing", bedrag=float(veld("verbouwing")))])

    fin = Financiering()
    if veld("hypotheekbedrag") is not None:
        fin = Financiering(
            hypotheekbedrag=float(veld("hypotheekbedrag")),
            rente_pct=float(veld("rente_pct", 0.045)),
        )

    return BeoordelingsAanvraag(pand=Pand(**pand_args), bestedingsplan=plan, financiering=fin)


def rank(bron: Path, top: int | None = None) -> pd.DataFrame:
    if bron.suffix.lower() in (".xlsx", ".xlsm"):
        df = pd.read_excel(bron)
    else:
        df = pd.read_csv(bron)

    kolommap = laad_kolommap()
    resultaten = []
    for _, rij in df.iterrows():
        try:
            aanvraag = rij_naar_aanvraag(rij, kolommap)
        except (TypeError, ValueError) as e:
            resultaten.append({"adres": rij.get(kolommap.get("adres", ""), "?"), "fout": str(e)})
            continue
        b = beoordeel(aanvraag)
        resultaten.append(
            {
                "adres": aanvraag.pand.adres,
                "koopsom": aanvraag.pand.koopsom,
                "huur_per_maand": aanvraag.pand.huur_per_maand,
                "totale_investering": round(b.totale_investering),
                "bar": round(b.bar, 4),
                "nar": round(b.nar, 4),
                "cashflow_jaar": round(b.cashflow_jaar),
                "score": b.score.totaal,
                "label": b.score.label,
            }
        )

    ranglijst = pd.DataFrame(resultaten).sort_values("score", ascending=False, na_position="last")
    ranglijst.insert(0, "rang", range(1, len(ranglijst) + 1))
    return ranglijst.head(top) if top else ranglijst


def main() -> None:
    parser = argparse.ArgumentParser(description="Rank een database van investeringspanden")
    parser.add_argument("bron", type=Path, help="Excel- of CSV-bestand met panden")
    parser.add_argument("--top", type=int, default=None, help="Alleen de top N tonen")
    parser.add_argument("--uitvoer", type=Path, default=None, help="Schrijf resultaat naar xlsx")
    args = parser.parse_args()

    ranglijst = rank(args.bron, args.top)
    print(ranglijst.to_string(index=False))
    if args.uitvoer:
        ranglijst.to_excel(args.uitvoer, index=False)
        print(f"\nGeschreven: {args.uitvoer}")


if __name__ == "__main__":
    main()
