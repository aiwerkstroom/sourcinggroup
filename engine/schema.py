"""Input-schema's voor het rentabiliteitsmodel.

Dit zijn de gestructureerde tegenhangers van de invoervelden in het
Excel-model (TSG Model.xlsx). Elke aanname die in Excel een cel is,
is hier een veld met een default — zo kunnen we de Excel-waarden
1-op-1 overnemen zodra we het bestand hebben uitgelezen met
tools/extract_excel.py.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, computed_field


class BestedingsPost(BaseModel):
    """Eén regel uit het bestedingsplan (verbouwing/renovatie)."""

    omschrijving: str
    bedrag: float = Field(ge=0)


class Bestedingsplan(BaseModel):
    posten: list[BestedingsPost] = Field(default_factory=list)

    @computed_field
    @property
    def totaal(self) -> float:
        return sum(p.bedrag for p in self.posten)


class Financiering(BaseModel):
    """Hypotheek/financieringsstructuur. Alles 0 = volledig eigen geld."""

    hypotheekbedrag: float = Field(default=0, ge=0)
    rente_pct: float = Field(default=0.045, ge=0, description="Jaarrente als fractie, bv. 0.045")
    aflossing_pct_per_jaar: float = Field(
        default=0.0, ge=0, description="Lineaire aflossing per jaar als fractie van hoofdsom; 0 = aflossingsvrij"
    )

    @computed_field
    @property
    def rentelast_jaar(self) -> float:
        return self.hypotheekbedrag * self.rente_pct

    @computed_field
    @property
    def aflossing_jaar(self) -> float:
        return self.hypotheekbedrag * self.aflossing_pct_per_jaar


class Exploitatie(BaseModel):
    """Jaarlijkse exploitatiekosten. Percentages zijn fracties van de bruto jaarhuur."""

    onderhoud_pct: float = Field(default=0.05, ge=0)
    beheer_pct: float = Field(default=0.08, ge=0)
    leegstand_pct: float = Field(default=0.05, ge=0)
    vve_per_jaar: float = Field(default=0, ge=0)
    ozb_per_jaar: float = Field(default=0, ge=0)
    verzekering_per_jaar: float = Field(default=0, ge=0)
    overig_per_jaar: float = Field(default=0, ge=0)

    def kosten_jaar(self, bruto_jaarhuur: float) -> float:
        variabel = bruto_jaarhuur * (self.onderhoud_pct + self.beheer_pct + self.leegstand_pct)
        vast = self.vve_per_jaar + self.ozb_per_jaar + self.verzekering_per_jaar + self.overig_per_jaar
        return variabel + vast


class Pand(BaseModel):
    adres: str = ""
    koopsom: float = Field(gt=0)
    # LET OP: overdrachtsbelasting voor beleggers wijzigt per jaar; neem het
    # actuele tarief over uit het Excel-model of de configuratie.
    kosten_koper_pct: float = Field(default=0.08, ge=0)
    overige_aankoopkosten: float = Field(default=0, ge=0, description="Notaris, makelaar, taxatie, advies")
    huur_per_maand: float = Field(ge=0)
    woz_waarde: float | None = None
    marktwaarde_na_verbouwing: float | None = None

    @computed_field
    @property
    def kosten_koper(self) -> float:
        return self.koopsom * self.kosten_koper_pct

    @computed_field
    @property
    def bruto_jaarhuur(self) -> float:
        return self.huur_per_maand * 12


class BeoordelingsAanvraag(BaseModel):
    """Volledige input voor één beoordeling (werkstroom 1)."""

    pand: Pand
    bestedingsplan: Bestedingsplan = Field(default_factory=Bestedingsplan)
    financiering: Financiering = Field(default_factory=Financiering)
    exploitatie: Exploitatie = Field(default_factory=Exploitatie)
