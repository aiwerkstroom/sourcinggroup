"""De rekenkern: van invoer naar rentabiliteits-KPI's.

Dit is de module waar de logica uit TSG Model.xlsx landt. De KPI's
hieronder zijn de gangbare Nederlandse vastgoed-rendementsmaatstaven;
zodra het Excel-model is uitgelezen (tools/extract_excel.py) worden
afwijkende definities hier exact gelijkgetrokken en vastgelegd met
golden tests (tests/ vergelijkt engine-uitkomsten met Excel-uitkomsten).
"""

from __future__ import annotations

from pydantic import BaseModel

from .schema import BeoordelingsAanvraag
from .scoring import Score, bereken_score


class Beoordeling(BaseModel):
    """Alle uitkomsten van het model voor één pand."""

    # Investering
    totale_investering: float
    eigen_inbreng: float

    # Huur & exploitatie
    bruto_jaarhuur: float
    exploitatiekosten_jaar: float
    netto_jaarhuur: float

    # Rendement
    bar: float  # Bruto AanvangsRendement
    nar: float  # Netto AanvangsRendement
    cashflow_jaar: float  # na rente én aflossing
    cash_on_cash: float | None  # cashflow / eigen inbreng; None bij 0 eigen geld
    dscr: float | None  # netto huur / schuldendienst; None zonder financiering

    score: Score


def beoordeel(aanvraag: BeoordelingsAanvraag) -> Beoordeling:
    pand = aanvraag.pand
    fin = aanvraag.financiering

    totale_investering = (
        pand.koopsom
        + pand.kosten_koper
        + pand.overige_aankoopkosten
        + aanvraag.bestedingsplan.totaal
    )
    eigen_inbreng = totale_investering - fin.hypotheekbedrag

    bruto_jaarhuur = pand.bruto_jaarhuur
    exploitatiekosten = aanvraag.exploitatie.kosten_jaar(bruto_jaarhuur)
    netto_jaarhuur = bruto_jaarhuur - exploitatiekosten

    bar = bruto_jaarhuur / totale_investering
    nar = netto_jaarhuur / totale_investering

    schuldendienst = fin.rentelast_jaar + fin.aflossing_jaar
    cashflow_jaar = netto_jaarhuur - schuldendienst
    cash_on_cash = cashflow_jaar / eigen_inbreng if eigen_inbreng > 0 else None
    dscr = netto_jaarhuur / schuldendienst if schuldendienst > 0 else None

    kpis = {
        "bar": bar,
        "nar": nar,
        "cash_on_cash": cash_on_cash,
        "dscr": dscr,
    }
    score = bereken_score(kpis)

    return Beoordeling(
        totale_investering=totale_investering,
        eigen_inbreng=eigen_inbreng,
        bruto_jaarhuur=bruto_jaarhuur,
        exploitatiekosten_jaar=exploitatiekosten,
        netto_jaarhuur=netto_jaarhuur,
        bar=bar,
        nar=nar,
        cashflow_jaar=cashflow_jaar,
        cash_on_cash=cash_on_cash,
        dscr=dscr,
        score=score,
    )
