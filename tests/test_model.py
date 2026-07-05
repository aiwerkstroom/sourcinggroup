"""Sanity-tests voor de rekenkern.

Zodra TSG Model.xlsx is uitgelezen komen hier golden tests bij:
dezelfde invoer als in Excel, met de Excel-uitkomsten als verwachte
waarden — zo bewijzen we dat engine en Excel identiek rekenen.
"""

import pytest

from engine import Bestedingsplan, BestedingsPost, Financiering, Pand, beoordeel
from engine.schema import BeoordelingsAanvraag


def voorbeeld_aanvraag() -> BeoordelingsAanvraag:
    return BeoordelingsAanvraag(
        pand=Pand(
            adres="Teststraat 1",
            koopsom=285_000,
            kosten_koper_pct=0.08,
            overige_aankoopkosten=3_500,
            huur_per_maand=1_650,
        ),
        bestedingsplan=Bestedingsplan(posten=[BestedingsPost(omschrijving="Verbouwing", bedrag=25_000)]),
        financiering=Financiering(hypotheekbedrag=200_000, rente_pct=0.045),
    )


def test_totale_investering():
    b = beoordeel(voorbeeld_aanvraag())
    assert b.totale_investering == pytest.approx(285_000 + 22_800 + 3_500 + 25_000)
    assert b.eigen_inbreng == pytest.approx(b.totale_investering - 200_000)


def test_bar_en_nar():
    b = beoordeel(voorbeeld_aanvraag())
    assert b.bruto_jaarhuur == 19_800
    assert b.bar == pytest.approx(19_800 / b.totale_investering)
    # defaults: onderhoud 5% + beheer 8% + leegstand 5% = 18% van bruto huur
    assert b.exploitatiekosten_jaar == pytest.approx(19_800 * 0.18)
    assert b.nar == pytest.approx((19_800 * 0.82) / b.totale_investering)


def test_cashflow_en_dscr():
    b = beoordeel(voorbeeld_aanvraag())
    rente = 200_000 * 0.045
    assert b.cashflow_jaar == pytest.approx(b.netto_jaarhuur - rente)
    assert b.dscr == pytest.approx(b.netto_jaarhuur / rente)
    assert b.cash_on_cash == pytest.approx(b.cashflow_jaar / b.eigen_inbreng)


def test_zonder_financiering_geen_dscr():
    aanvraag = voorbeeld_aanvraag()
    aanvraag.financiering = Financiering()
    b = beoordeel(aanvraag)
    assert b.dscr is None
    assert b.cashflow_jaar == pytest.approx(b.netto_jaarhuur)


def test_score_binnen_bereik_en_gelabeld():
    b = beoordeel(voorbeeld_aanvraag())
    assert 0 <= b.score.totaal <= 100
    assert b.score.label
    assert set(b.score.per_kpi) == {"bar", "nar", "cash_on_cash", "dscr"}
