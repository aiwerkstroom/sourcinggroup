# MODEL_SPEC — rekenlogica TSG Yield Engine

Herleid uit `TSG_Model_v3.xlsx` (de **gecorrigeerde** Excel, incl. Changelog-tabblad).
Dit is de specificatie die de TypeScript-rekenlaag in `lib/rules/es/` repliceert.
Elke formule heeft een unit test die de Excel-uitkomst exact naspeelt
(`npm test`, zie §11).

Alles wat hieronder als **[BESLISSING]** staat, moet eerst door Samuel worden
vastgesteld en mag niet door de bouwer worden ingevuld. Beslissingen die in de
Changelog van v2 al zijn genomen, staan als **[BESLIST]** met de gekozen optie.

## 1. Invoer

**Pand** (`Property Input`): naam, regio, wijk, adres, type, marktsegment,
huurtype, woonoppervlak (m²), aantal kamers/slaapkamers/badkamers, huidige
huurstatus, bouwjaar, energielabel, aankoopprijs, eigen inbreng, hypotheek,
renovatiebudget.

**Uitgangspunten belegger** (`Costs & Income` B4–D26): totaal
investeringsbudget, max renovatiebudget, gewenste LTV, min LTV, max LTV,
risicotolerantie, gewenst dealtype, verhuurstrategie (LT/ST/hybride), min ROI,
min maandelijkse netto cashflow, max maandelijkse schuldlast.

Deze uitgangspunten zijn geen rekeninput maar **toetsingscriteria**: het model
rekent door en zegt daarna of de uitkomst binnen de grenzen valt.

**Selecties** (in de Excel losse keuzecellen, in de engine expliciete invoer):
huurprijs €/m²/maand LT en ST (uit de matrix/wijktabel), renovatiestrategie
(volgt uit gewenst dealtype), financieringsstrategie, ingezetenschap
(NL-koper = niet-ingezetene) en EU/EER-status voor de belastinglaag.

## 2. Huurinkomsten

```
basishuur/maand   = huurprijs €/m²/maand × woonoppervlak
bruto jaarhuur    = basishuur × 12
inkomen           = bruto jaarhuur × bezettingsgraad
aangepast inkomen = inkomen × huurmultiplier renovatiestrategie
```

Bezettingsgraad basis: langetermijn 0,90 · kortetermijn 0,60. Hybride: 60% LT /
40% ST, gewogen over de aangepaste inkomens.

Wijktabel Valencia (€/m²/maand), langetermijn: stad 13,5 · Alboraya 17,2 ·
Godella 12,7 · Canet d'En Berenguer 14,7 · Cullera 12,2 · Mislata 12,8 ·
Moncada 11,0 · Oliva 9,2 · Catarroja 10,4 · Bétera 11,3 · El Carmen 23,0 ·
Ruzafa 17,0 · overig premium centrum 21,0. Kortetermijn ligt gemiddeld een
factor 1,7 hoger; de Excel hanteert een eigen ST-tabel (15–45 €/m²).

**Let op:** de Excel koppelt de wijk niet met een formule aan de huurprijs; de
matrixkolom (referentiecasus: 17 LT / 36 ST) is een handmatige keuze. In de
engine is dit een expliciete invoer; de wijktabel staat als referentiedata in
`parameters.ts`.

## 3. Renovatiestrategieën

|                  | A — Minimaal | B — Licht | C — Zwaar |
|------------------|--------------|-----------|-----------|
| CapEx            | € 49.500     | € 55.000  | € 66.000  |
| Huurmultiplier   | 0,95         | 1,00      | 1,10      |
| Onderhoudsfactor | 1,20         | 1,00      | 0,85      |
| Nutsefficiëntie  | 1,05         | 1,00      | 0,90      |
| Tijd tot verhuur | 1 mnd        | 2 mnd     | 3 mnd     |

CapEx is nu absoluut. **[BESLISSING]** Voor een self-serve tool moet dit een
functie van oppervlak, bouwjaar en energielabel worden — anders krijgt een
appartement van 45 m² een renovatiebudget van € 55.000 voorgeschoteld.

## 4. Financieringsstrategieën

|          | A — Laag | B — Midden | C — Hoog |
|----------|----------|------------|----------|
| LTV      | 0,60     | 0,70       | 0,75     |
| Looptijd | 25 jaar  | 20 jaar    | 15 jaar  |
| Rente    | 2,50%    | 2,85%      | 3,20%    |
| Type     | annuïtair| annuïtair  | annuïtair|

Selectie: `LTV = MAX(min_LTV, MIN(max_LTV, gewenste_LTV))`, waarna de
bijbehorende rente en looptijd volgen. Rentes zijn residenttarieven.

**[BESLIST]** (Changelog D124): Nederlandse kopers zijn per definitie
niet-ingezetene. Het model rekent met een **niet-ingezetenenopslag van +1,0%**
op de scenariorente (3,5% niet-ingezetene vs 2,5% ingezetene, Reference Info
K10/K11). In de engine: `residency: "nonResident"` activeert de opslag.

## 5. Aankoopkosten (Spanje, bestaande bouw)

Elk als percentage van de aankoopprijs, plus renovatie:
overdrachtsbelasting ITP 10% · zegelrecht AJD 1,5% · notaris 0,5% ·
kadaster 0,3% · juridisch advies 1,0% · makelaarscourtage 5% ·
bankkosten € 100 (vast).

**[BESLIST]** (Changelog): de Excel was intern inconsistent; de set uit
**Reference Info** is leidend gemaakt en `Costs & Income` is daarop
gecorrigeerd — notaris 0,15%→0,50%, kadaster 0,20%→0,30%, juridisch advies
0,50%→1,00%, IBI 0,70%→0,40%, property management 5%→8%.

## 6. Exploitatiekosten

Vast: IBI 0,4% van aankoopprijs · verzekeringen (opstal 300 + inboedel 180 +
verhuurdersdekking 250 + overlijdensrisico 300 = € 1.030/jaar) · bankkosten
€ 100 · hypotheekrente = hypotheek × (geselecteerde rente + opslag).

Inkomensafhankelijk: property management (8% bruto huur) · onderhoud (5% bruto
huur × onderhoudsfactor renovatie × onderhoudsinflatie scenario) ·
nutsvoorzieningen (gas 8 + water 3,5 + elektra 10 = 21,5 €/m²/jaar ×
nutsefficiëntie renovatie × scenariomultiplier).

## 7. Scenariolaag

| Multiplier        | Conservatief | Basis | Optimistisch |
|-------------------|--------------|-------|--------------|
| Huurniveau        | 0,90         | 1,00  | 1,10         |
| Bezetting         | 0,90         | 1,00  | 1,10         |
| Rente-delta       | +0,50%       | 0     | −0,25%       |
| Nutskosten        | 1,10         | 1,00  | 0,95         |
| Onderhoudsinflatie| 1,10         | 1,00  | 0,95         |

**[BESLIST]** (v3): de rente-delta is een ondertekende waarde; alle scenario's
tellen op (`rente = geselecteerde rente + delta + opslag`). In v2 stond de
optimistische delta per abuis op +0,25%; v3 corrigeert dit naar −0,25%.

Waardegroei: conservatief 4% · basis 5% · optimistisch 6% per jaar (Reference
Info, met bronvermelding). Nog niet aan een uitkomst gekoppeld (geen
meerjarenprojectie).

## 8. Uitkomsten

```
NOI          = bruto inkomen − (management + onderhoud + nutskosten
                                + vaste lasten)
jaarcashflow = bruto inkomen − totale opex incl. debt service (annuïteit)
DSCR         = NOI / debt service (annuïteit)
toetsen      = cashflow ≥ min · DSCR > 1 · LTV binnen grenzen ·
               budget gehaald (equity ≤ totaalbudget, capex ≤ max renovatie,
               maandlast ≤ max)
```

Vaste lasten in NOI en totale opex (sinds v3): IBI € 1.320 + verzekeringen
€ 1.030 + bankkosten € 100 = **€ 2.450/jaar** (referentiecasus; IBI schaalt
met de aankoopprijs). Hypotheekrente valt hier niet onder — die zit in de
debt service.

Deze posten lopen bewust **niet** door de scenariomultipliers heen; de Excel
annoteert dat bij L85 als "prijs- noch inkomensgedreven". Ze zijn in alle drie
de scenario's gelijk.

Debt service: annuïteit over hypotheek = aankoopprijs × geselecteerde LTV,
looptijd van de geselecteerde strategie, scenariorente = geselecteerde rente +
delta + niet-ingezetenenopslag.

**Belasting** (Reference Info): niet-ingezetenen 19% (EU/EER) of 24% (buiten
EU) over huurinkomsten minus aftrekbare kosten (rente aflossingsvrij + IBI +
verzekeringen + onderhoud + management + afschrijving + bankkosten).
Afschrijving 3% over 80% van de aankoopwaarde; de aftrekbare-kostentabel
gebruikt per scenario factor 0,94 / 1,00 / 1,04 op die basis (gerepliceerd
zoals in de Excel).

## 9. Drie fouten in de oorspronkelijke Excel — **[BESLIST: gecorrigeerd in v2]**

1. **DSCR telde de schuldlast dubbel** (`NOI / (aflossingsvrije rente +
   annuïteit)`) → nu `NOI / annuïteit` (Changelog L108/N108/P108).
2. **Onderhoud in het optimistische scenario gebruikte de
   bezettingsmultiplier (1,1)** i.p.v. de onderhoudsinflatie (0,95) →
   gecorrigeerd (Changelog P80).
3. **Cashflow en DSCR gebruikten verschillende schuldlasten** (opex rekende
   aflossingsvrij) → opex rekent nu met de annuïteit (Changelog L98/N98/P98).

Daarnaast hersteld in v2: land Indonesië→Spanje, gebroken externe verwijzingen
(#VALUE!), trailing spaces in strategienamen, hardcoded strategie-B-rente in
D165.

## 10. Wat het model nog niet doet

- **Meerjarige cashflowprojectie.** Nu één jaar. **[BESLISSING]** welke
  horizon (5 of 10 jaar) met indexatie van huur, kosten en rente.
- **IRR en exit.** Geen verkoopwaarde, verkoopkosten, plusvalía of
  vermogenswinstbelasting; zonder exit geen IRR.
- **Correctiefactoren wegen niet mee.** Het tabblad bevat elf
  macro-indicatoren met tijdreeksen 2014–2030 en bronvermelding, maar geen
  enkele formule gebruikt ze. **[BESLISSING]** scenariodriver, aparte
  risicoscore, of contextpagina.
- **Er is geen score.** Voor het rapport optioneel, voor de crawl noodzakelijk.
- **Min ROI wordt niet getoetst.** De invoer bestaat (D22) maar de Excel
  berekent geen ROI-toets; de engine repliceert dat en toetst hem dus ook
  (nog) niet.

## 11. Referentiecasus (voor de tests)

Avenida Primado Reig 19, Valencia · appartement, 5 studio's · 133 m² ·
7 kamers, 5 slaapkamers, 5 badkamers · bouwjaar 1972 · label B ·
studentenhuisvesting · langetermijn verhuurd · aankoopprijs € 330.000 · eigen
geld € 115.000 · hypotheek € 215.000 · renovatie € 55.000.

Uitgangspunten: budget € 450.000 · max renovatie € 60.000 · LTV 0,60–0,75 ·
risicotolerantie midden · dealtype licht · strategie hybride · min ROI 4% ·
min maandcashflow € 500 · max maandlast € 1.000. Selecties: huur 17/36 €/m² ·
financiering strategie C · niet-ingezetene, EU/EER.

Verwachte uitkomsten (gecorrigeerde Excel v3, vastgelegd in
`lib/rules/es/__tests__/engine.test.ts`):

| Grootheid | Conservatief | Basis | Optimistisch |
|---|---|---|---|
| Bruto inkomen | 23.036,98 | 28.440,72 | 34.413,27 |
| Vaste lasten | 2.450 | 2.450 | 2.450 |
| NOI | 14.331,54 | 19.433,93 | 24.859,05 |
| Rente | 4,70% | 4,20% | 3,95% |
| Annuïteit | 23.025,05 | 22.267,59 | 21.894,39 |
| Jaarcashflow | −8.693,51 | −2.833,66 | 2.964,67 |
| Maandcashflow | −724,46 | −236,14 | 247,06 |
| DSCR | 0,6224 | 0,8727 | 1,1354 |
| DSCR-toets | NO | NO | Yes |

Aankoop: totaal € 445.490 · hypotheek € 247.500 · equity € 197.990 · binnen
budget: ja · renovatie binnen budget: ja. Vaste exploitatie (incl.
hypotheekrente): € 12.845. Belasting (basis, EU/EER): aftrekbaar € 24.462,29 ·
belastbaar € 3.978,43 · verschuldigd € 755,90; aftrekbaar optimistisch
€ 24.850,74 (rente aflossingsvrij 9.776,25 bij 3,95%).
