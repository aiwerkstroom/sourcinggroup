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
huurtype, **bruikbaar oppervlak en gebouwd oppervlak, m² gescheiden — §17**,
aantal kamers/slaapkamers/badkamers, huidige huurstatus, bouwjaar,
energielabel, aankoopprijs, eigen inbreng, hypotheek, renovatiebudget,
**gastos de comunidad €/jaar (verplicht, geen default — §15)**,
**kadastrale waarde suelo/construcción (optioneel — §16)**,
**geldig título habilitante ja/nee (verplicht — §18)**.

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
basishuur/maand   = huurprijs €/m²/maand × bruikbaar oppervlak (§17 - niet gebouwd oppervlak)
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

Vast: IBI 0,4% van aankoopprijs (of van de kadastrale waarde wanneer die is
ingevuld — §16) · verzekeringen (opstal 300 + inboedel 180 +
verhuurdersdekking 250 + overlijdensrisico 300 = € 1.030/jaar) · bankkosten
€ 100 · **gastos de comunidad (verplichte invoer per pand, geen default —
§15)** · hypotheekrente = hypotheek × (geselecteerde rente + opslag).

Inkomensafhankelijk: property management (8% bruto huur) · onderhoud (5% bruto
huur × onderhoudsfactor renovatie × onderhoudsinflatie scenario) ·
nutsvoorzieningen (gas 8 + water 3,5 + elektra 10 = 21,5 €/m²/jaar ×
**gebouwd oppervlak, niet bruikbaar oppervlak — §17** ×
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
- ~~Min ROI wordt niet getoetst.~~ **Opgelost in fase 1b §12/§7:**
  `InvestorConstraints.minRoiTarget` wordt nu getoetst tegen de IRR
  (`ReturnRequirementCheck`), niet tegen de eenjarige fase-1-cashflow — de
  Excel had er toch geen formule voor.

## 11. Referentiecasus (voor de tests)

Avenida Primado Reig 19, Valencia · appartement, 5 studio's · 133 m² ·
7 kamers, 5 slaapkamers, 5 badkamers · bouwjaar 1972 · label B ·
studentenhuisvesting · langetermijn verhuurd · aankoopprijs € 330.000 · eigen
geld € 115.000 · hypotheek € 215.000 · renovatie € 55.000 · gastos de
comunidad € 900/jaar (§15 — testfixture, niet gesourced voor dit specifieke
pand).

Uitgangspunten: budget € 450.000 · max renovatie € 60.000 · LTV 0,60–0,75 ·
risicotolerantie midden · dealtype licht · strategie hybride · min ROI 4% ·
min maandcashflow € 500 · max maandlast € 1.000. Selecties: huur 17/36 €/m² ·
financiering strategie C · niet-ingezetene, EU/EER.

Verwachte uitkomsten (gecorrigeerde Excel v3 **+ € 900/jaar gastos de
comunidad**, vastgelegd in `lib/rules/es/__tests__/engine.test.ts`; de pure
Excel-pariteit zonder deze post staat apart vast in
`acquisition.test.ts`, `communityFeesAnnual: 0`):

| Grootheid | Conservatief | Basis | Optimistisch |
|---|---|---|---|
| Bruto inkomen | 23.036,98 | 28.440,72 | 34.413,27 |
| Vaste lasten | 3.350 | 3.350 | 3.350 |
| NOI | 13.431,54 | 18.533,93 | 23.959,05 |
| Rente | 4,70% | 4,20% | 3,95% |
| Annuïteit | 23.025,05 | 22.267,59 | 21.894,39 |
| Jaarcashflow | −9.593,51 | −3.733,66 | 2.064,67 |
| Maandcashflow | −799,46 | −311,14 | 172,06 |
| DSCR | 0,5833 | 0,8323 | 1,0943 |
| DSCR-toets | NO | NO | Yes |

Aankoop: totaal € 445.490 · hypotheek € 247.500 · equity € 197.990 · binnen
budget: ja · renovatie binnen budget: ja (gastos de comunidad zit niet in de
aankoopkosten, alleen in de exploitatie). Vaste exploitatie (incl.
hypotheekrente en gastos de comunidad): € 13.745. Belasting (basis, EU/EER):
aftrekbaar € 25.362,29 · belastbaar € 3.078,43 · verschuldigd € 584,90;
aftrekbaar optimistisch € 25.750,74 (rente aflossingsvrij 9.776,25 bij
3,95%).

## 12. Fase 1b — meerjarige projectie, exit en IRR

Aanvulling volgens `MODEL_SPEC_FASE1B.md`. Horizon: 10 jaar, met een
tussenstand op jaar 5. Jaar 1 is het fase-1-basisjaar (huur- en kostenindex
= 1); indexatie werkt vanaf jaar 2.

**Indexatie** (`lib/rules/es/indexation.ts`), bron Correction Factors:
- huurgroei uit rij "Rent Price Changes" (2026: 1,06 aflopend naar 1,03 in
  2030), toegepast op de bruto huur;
- kosteninflatie uit rij "CPI (YoY%)" (~2%), toegepast op onderhoud,
  nutskosten, verzekeringen, bankkosten **en IBI**;
- waardegroei 4/5/6% per scenario, samengesteld, gebruikt voor de
  verkoopprijs bij exit (§5) — niet voor IBI.
- Reeks loopt tot 2030; daarna wordt de laatst bekende waarde doorgetrokken
  en het jaar gemarkeerd als `extrapolated`.

**[HERZIEN t.o.v. MODEL_SPEC_FASE1B.md §3]** De oorspronkelijke fase-1b-spec
liet IBI de pandwaarde volgen. Dat is feitelijk onjuist: IBI wordt geheven
over de **kadastrale waarde** (valor catastral), die administratief wordt
vastgesteld en periodiek wordt herzien — niet over de marktwaarde, en dus
niet over hetzelfde groeipad als de verkoopprijs. Dit model heeft geen
kadastrale-waardereeks; de IBI-grondslag is daarom een **benadering**: IBI
wordt met CPI geïndexeerd, net als de overige vaste lasten. Zodra een
kadastrale-waardereeks beschikbaar is, hoort die de indexatie te bepalen in
plaats van CPI.

**Cashflow na belasting** (`lib/rules/es/projection.ts`):
```
rente(jaar)      = uit het aflossingsschema (annuïteit gesplitst per jaar,
                    niet de vlakke aflossingsvrije schatting van fase 1)
NOI(jaar)         = bruto huur(jaar) − (management + onderhoud + nutskosten
                    + IBI + verzekeringen + bankkosten + gastos de
                    comunidad)(jaar)
cashflow voor belasting(jaar) = NOI(jaar) − rente(jaar) − aflossing(jaar)
belastbaar(jaar)  = bruto huur(jaar) − aftrekbare kosten(jaar)
                    (rente + IBI + verzekeringen + onderhoud + management +
                    afschrijving + bankkosten + gastos de comunidad,
                    allemaal van dat jaar)
belasting(jaar)   = MAX(0, belastbaar(jaar)) × belastingtarief
cashflow na belasting(jaar) = cashflow voor belasting(jaar) − belasting(jaar)
```
Gastos de comunidad (§15) volgt dezelfde CPI-indexatie als IBI/verzekeringen/
bankkosten — het is een vaste last, geen inkomensafhankelijke post.
Property management schaalt mee met de geïndexeerde huur (is per definitie
een percentage van de huur van dat jaar, geen aparte CPI nodig). Afschrijving
blijft vlak: gekoppeld aan de historische aanschafwaarde, niet geïndexeerd.
Een negatief belastbaar bedrag levert geen belastingteruggave op — de
Spaanse IRNR-heffing voor niet-ingezetenen is een periodieke aangifte, geen
jaarlijkse verrekening met terugbetaling; de belasting is daarom geklemd op
€ 0 in plaats van negatief getoond.

**Afschrijvingsgrondslag — [BESLISSING], opstalpercentage per pand nodig.**
Fase 1 rekent (voor de eenjarige, Excel-parity belastingschatting) met een
vaste 80% opstalaandeel — dat is de conventie van de Excel zelf (Reference
Info H58) en blijft ongewijzigd staan in `tax.ts` voor de fase-1-parity-
tests. De Spaanse afschrijvingsregel is echter 3% per jaar over de hoogste
van de kadastrale opstalwaarde of het opstalgedeelte van de aanschafkosten,
exclusief grond — geen vast percentage van de aankoopprijs. 80% is dus geen
brongegeven maar een aanname over het grondaandeel.

Voor de meerjarige projectie (`lib/rules/es/projection.ts`) is het
opstalpercentage losgetrokken tot een expliciete, overschrijfbare parameter:
`DEFAULT_BUILDING_SHARE_OF_VALUE = 0,70` in `parameters.ts`, met een
TODO-commentaar erbij. Dit is een generieke placeholder, geen per-pand
waarde. **De echte waarde moet uit de kadastrale waardesplitsing van het
specifieke pand komen** (Catastro: valor catastral desglosado in suelo /
construcción) voordat een rapport voor een concreet pand wordt uitgebracht.

**Aanloopvertraging tot verhuur, jaar 1.** De renovatiestrategieën kennen
een `timeToRentMonths` (1/2/3 maanden voor minimaal/licht/zwaar) die in
fase 1 nergens meerekent — de Excel modelleert dit niet, dus de
fase-1-Excel-pariteit blijft ongewijzigd. In de meerjarige projectie telt
jaar 1 wél naar rato minder huurmaanden: bij strategie licht (2 maanden)
dus 10 van de 12 maanden. Alleen de huur en de daaraan gekoppelde property
management fee (percentage van de huur) schalen mee; onderhoud,
nutskosten, IBI, verzekeringen, bankkosten, gastos de comunidad en de volledige annuïteit lopen
gewoon voor het hele jaar door — het pand kost evenveel om aan te houden
tijdens de renovatie, het levert alleen nog geen (volledige) huur op.
Vanaf jaar 2 is de aanloopperiode voorbij en telt het volledige jaar.

**Exit** (`lib/rules/es/exit.ts`), gecorrigeerd naar de daadwerkelijke
IRNR-berekening voor niet-ingezetenen (bron: Agencia Tributaria,
"Ganancias patrimoniales — Impuesto sobre la Renta de no Residentes",
instructies Modelo 210):
```
verkoopprijs             = aankoopprijs × waardegroei^houdperiode (per scenario)
overdrachtswaarde (CGT)  = verkoopprijs − verkoopcourtage − plusvalía
                           (transmissiekosten die de VERKOPER draagt)
aanschafwaarde voor CGT  = aankoopprijs + ITP + AJD + notaris + kadaster + juridisch
                           + (renovatiekosten × renovationImprovementShare)
                           − cumulatieve afschrijving over de houdperiode
                           (géén makelaarscourtage aankoop, géén bankkosten)
meerwaarde                = overdrachtswaarde (CGT) − aanschafwaarde voor CGT
vermogenswinstbelasting  = MAX(0, meerwaarde) × 19% (vlak, niet-ingezetene)
netto verkoopopbrengst   = verkoopprijs − verkoopcourtage − plusvalía
                           − vermogenswinstbelasting − restschuld
```
**Correctie — geen dubbeltelling.** Verkoopcourtage en plusvalía komen op
twee plekken voor: ze verlagen de overdrachtswaarde (en dus de
belastinggrondslag, art. IRNR: "el valor de transmisión ... se minorará en
el importe de los gastos y tributos inherentes a la transmisión que hayan
sido satisfechos por el transmitente") én ze worden apart van de
verkoopprijs afgetrokken in de netto verkoopopbrengst. Dat zijn twee
verschillende grootheden — belastbare winst versus daadwerkelijk ontvangen
kasgeld — die toevallig dezelfde twee posten aftrekken; geen dubbeltelling.

Restschuld komt uit hetzelfde aflossingsschema als de jaarlijkse cashflow
(§4) — geen aparte berekening. De houdperiode is het jaartal van het
laatste projectiejaar; de verkoopprijs gebruikt dezelfde
`propertyValueIndex` als in §3, nu voor het eerst daadwerkelijk gebruikt.

**Mejora — renovatiekosten in de aanschafwaarde.** De IRNR-regel verhoogt
de aanschafwaarde met "inversiones y mejoras efectuadas" (art. valor de
adquisición, Agencia Tributaria): alléén echte verbeteringen, geen
onderhoud/reparatie. Welk deel van de renovatie (CapEx uit de gekozen
strategie) als mejora kwalificeert is niet uit dit model af te leiden.
`renovationImprovementShare` (default `DEFAULT_RENOVATION_IMPROVEMENT_SHARE
= 0` in `parameters.ts`) is daarom een optionele parameter met een veilige
default: 0% mejora onderschat de aftrek nooit, een verzonnen percentage
zou hem kunnen overschatten. **[BESLISSING]** de echte verhouding moet per
pand worden onderbouwd vanuit de renovatiefacturen/-scope; niet invullen
zonder die onderbouwing.

**Cumulatieve afschrijving in de aanschafwaarde.** De IRNR-regel voor het
`valor de adquisición` (Agencia Tributaria, instructies Modelo 210)
schrijft voor: het aanschafbedrag wordt verminderd met de fiscaal
afgetrokken afschrijvingen over de bezitsperiode — dezelfde afschrijving
mag niet zowel jaarlijks als bij verkoop worden "teruggekocht". `exit.ts`
neemt hiervoor géén tweede berekening op basis van
`DEFAULT_BUILDING_SHARE_OF_VALUE`; `computeExit()` krijgt de volledige
projectiereeks (`ProjectionYear[]`) en telt letterlijk op wat §4's
belastinglaag per jaar al heeft afgetrokken (`.depreciation`). Wijzigt de
afschrijvingsberekening in §4 later, dan verandert deze aftrek vanzelf mee
— er is precies één plek waar afschrijving wordt bepaald.

**[BESLISSING — geen default, verplichte invoer]** Verkoopcourtage en
plusvalía municipal hebben géén standaardwaarde in de engine.
`ExitAssumptions.sellingCommissionRate` (spec: 3–5% + IVA) en
`.municipalCapitalGainsTax` (gemeentelijk, afhankelijk van kadastrale
grondwaarde en houdperiode) zijn verplichte parameters van `computeExit()`
— een aanroep zonder deze cijfers compileert niet. De golden tests
gebruiken testwaarden (4% courtage, € 3.500 plusvalía) die uitsluitend de
formule testen en geen aanbeveling zijn.

De 3%-inhouding (Modelo 211) is een voorschot op de vermogenswinstbelasting
dat via Modelo 210 wordt verrekend, geen kostenpost. `nonResidentWithholdingAdvance`
staat apart in de uitkomst (ter informatie voor het rapport — het pand zet
tijdelijk een deel van de opbrengst vast) en telt niet mee in de netto
verkoopopbrengst.

**IRR op eigen vermogen** (`lib/rules/es/irr.ts`):
```
jaar 0    = −(eigen inbreng + renovatie)  =  −AcquisitionCosts.equityRequired
jaar 1..n = netto cashflow na belasting (§4, ProjectionYear.cashflowAfterTax)
jaar n    += netto verkoopopbrengst (§5, ExitResult.netSaleProceeds)
IRR       = bisectie op NPV(r) = 0, r ∈ [−99%, 10.000%]
```
`eigen inbreng + renovatie` is exact `AcquisitionCosts.equityRequired`
(Excel-geverifieerd, §11: D153 = € 197.990) — dat bedrag bevat de
renovatiekosten al, dus die twee termen apart optellen zou dubbeltellen of
een tweede berekening van dezelfde waarde vereisen.

Bisectie is gekozen boven Newton-Raphson: geen afgeleide nodig en
gegarandeerde convergentie zodra een geldige bracket is gevonden.

**Correctie — het zoekbereik omvat negatieve rentevoeten.** Een reeks met
precies één tekenwisseling (het gangbare patroon hier: een eigen-
vermogeninleg, dan een reeks die bij verkoop definitief positief wordt) is
"conventioneel": NPV(r) is strikt monotoon op (−1, ∞), dus er bestaat altijd
een nulpunt — positief, nul, of negatief. Een negatieve IRR is een
informatief antwoord ("het rendement was negatief"), geen storing.
`{ defined: false, reason }` is gereserveerd voor het geval waarin de
cashflowreeks helemaal geen teken wisselt (alleen uitgaven, of alleen
ontvangsten) — daar bestaat wiskundig gegarandeerd geen enkele rente die de
NPV op nul brengt, ongeacht het teken.

**Referentiecasus — alle drie scenario's hebben een gedefinieerde,
positieve IRR.** De ongedisconteerde som van jaar 1–10 (incl.
verkoopopbrengst) overtreft in alle drie scenario's de inleg van
€ 197.990, ook in het conservatieve scenario (€ 254.799,97 tegenover
€ 197.990 inleg — lager dan vóór §15's gastos de comunidad, die elk jaar
cashflow wegneemt). IRR: conservatief 2,18% · basis 5,54% · optimistisch
8,64%. Dit wijkt af van de eerdere verwachting dat het conservatieve
scenario geen oplossing zou hebben; die verwachting is met deze
doorrekening niet bevestigd — de cashflow is negatief en de DSCR onder 1
in de vroege jaren, maar het rendement zit in de aflossing en de
waardegroei die bij verkoop vrijkomen, niet in de lopende cashflow. Een
oordeel dat uitsluitend op cashflow- of DSCR-drempels afgaat, wijst een
deal als deze af terwijl de IRR hem misschien rechtvaardigt — dit is een
punt voor de vergelijkingsmaatstaf in de UI-spec (§5), niet iets dat de
rekenlaag zelf oplost.

**Wat dit oplevert per scenario** (`lib/rules/es/outcome.ts`), de
datastructuur waar resultaatpagina en PDF op gebouwd worden. Zelf geen
nieuwe rekenlogica: composeert de projectie (§4), de exit (§5) en de IRR
(§6), en voegt de twee ontbrekende toetsen toe:
```
jaarreeks per jaar         : cashflow na belasting, cumulatieve cashflow
                              (alléén operationeel, exclusief verkoop),
                              pandwaarde, restschuld, opgebouwd eigen
                              vermogen (pandwaarde − restschuld)
totaal rendement            = (som cashflow na belasting + netto
                              verkoopopbrengst − eigen inbreng) / eigen
                              inbreng  (niet-geannualiseerd, complementair
                              aan de IRR)
terugverdientijd             = eerste jaar waarin de cumulatieve
                              operationele cashflow de eigen inbreng
                              evenaart; anders null
```
**Eigen-vermogentoets (nieuw).** Past de benodigde eigen inbreng
(`AcquisitionCosts.equityRequired`) binnen het beschikbare eigen vermogen
van de belegger (`PropertyInput.ownMoney`)? Ontbrak volledig; in de
referentiecasus faalt deze toets in alle drie scenario's (€ 197.990 nodig
tegen € 115.000 beschikbaar — de benodigde inleg hangt niet van het
scenario af). `null` (niet `false`) wanneer `ownMoney` niet is opgegeven.

**Rendementseistoets (nieuw).** Zet de IRR af tegen
`InvestorConstraints.minRoiTarget`; valt terug op
`DEFAULT_MIN_REQUIRED_RETURN = 0` in `parameters.ts` wanneer de belegger
geen eis heeft opgegeven — een 0%-drempel is de zwakst mogelijke grens (elke
niet-negatieve IRR haalt hem) en kan dus nooit een slag die een echte eis
niet zou halen, ten onrechte laten slagen. In de referentiecasus (eis 4%)
haalt alleen het conservatieve scenario (2,18%) de eis niet; basis (5,54%)
en optimistisch (8,64%) wel. `null` wanneer de IRR zelf niet gedefinieerd
is.

**Terugverdientijd is `null` in alle drie scenario's van de
referentiecasus** — ook optimistisch (cumulatieve operationele cashflow na
10 jaar: € 32.416,65, nog altijd ver onder de inleg van € 197.990). Deze
deal verdient zichzelf uitsluitend terug via de verkoop, nooit via tien
jaar huur alleen — precies het patroon dat aanleiding gaf tot de
IRR-correctie hierboven, nu als apart, herleidbaar getal in plaats van als
observatie.

Golden tests: onafhankelijke Python-doorrekening (er is geen Excel-
tegenhanger voor fase 1b), vastgelegd in
`lib/rules/es/__tests__/{indexation,financing,projection,exit,irr,outcome}.test.ts`.

## 13. Herkomstaudit — parameters.ts

Niet elke waarde in dit model weegt even zwaar. Sommige zijn wettelijk
vastgelegd (belastingtarieven, statutaire percentages), andere zijn TSG's
eigen, verdedigbare modelkeuze (hoe "conservatief" is gedefinieerd), en
weer andere zijn plaatsvervangers uit de oorspronkelijke Excel zonder
feitelijke onderbouwing. Elke parameter in `lib/rules/es/parameters.ts`
draagt daarom een expliciet herkomstlabel — **onderdeel van het type**
(`Parameter<T>` in `types.ts`), niet van het commentaar, zodat code erop
kan reageren (zie `ALL_PARAMETERS`, gebruikt door
`lib/rules/es/__tests__/parameters.test.ts` en door de per-uitkomst
placeholder-lijst in §7).

```
SOURCED     — een genoemde externe bron met datum
ESTIMATE    — geen externe bron, maar een bewuste, verdedigbare model-
              conventie (bijv. hoe "hybride" wordt gedefinieerd), geen
              claim over een verifieerbaar extern feit
PLACEHOLDER — gepresenteerd als feit maar niet extern geverifieerd; moet
              worden vervangen door echte, pand-specifieke of
              geverifieerde data vóór productiegebruik
```

**Classificatietoets, toegepast op alle 80 parameters:** doet de waarde
een uitspraak over de **werkelijkheid** of over het **model**?

- Een uitspraak over de werkelijkheid (huurprijzen, kosten, premies,
  rentetarieven, renovatiebedragen, oppervlaktes, groeivoeten, bezetting)
  kan uitsluitend SOURCED of PLACEHOLDER zijn. ESTIMATE is daar niet
  toegestaan — een feitelijke claim heeft een bron, of hij heeft er geen;
  daartussen bestaat geen verdedigbaar midden.
- Een uitspraak over het model (wat een scenario betekent, een verdeling,
  een multiplier die een producttier definieert, een drempel) mag
  ESTIMATE zijn: een bewuste, verdedigbare modelkeuze, geen claim over een
  extern feit.

Bij twijfel tussen ESTIMATE en PLACEHOLDER is PLACEHOLDER gekozen — nooit
het gunstiger label. Optelling na de herclassificatie (`ALL_PARAMETERS`,
`parameters.test.ts`): **25 SOURCED · 27 ESTIMATE · 28 PLACEHOLDER** van
de 80 geaudite waarden (was 25 · 41 · 14 vóór de werkelijkheid-versus-
modeltoets).

**Herclassificatie — 14 parameters verplaatst van ESTIMATE naar
PLACEHOLDER**, omdat ze bij toepassing van de toets een feitelijke claim
bleken te zijn, geen modeldefinitie:
- `BASE_OCCUPANCY_LONG_TERM`, `BASE_OCCUPANCY_SHORT_TERM` — een claim over
  daadwerkelijk haalbare bezetting in de markt, geen modelkeuze.
- `RENOVATION_STRATEGIES.{minimal,light,heavy}.rentMultiplier` (3) — een
  claim over het effect van renovatie op haalbare huur.
- `RENOVATION_STRATEGIES.{minimal,light,heavy}.maintenanceFactor` (3) —
  een claim over het effect op onderhoudskosten.
- `RENOVATION_STRATEGIES.{minimal,light,heavy}.utilitiesEfficiency` (3) —
  een claim over het effect op nutskosten.
- `RENOVATION_STRATEGIES.{minimal,light,heavy}.timeToRentMonths` (3) — een
  claim over hoe lang de renovatie daadwerkelijk duurt.

Onderscheid met wat **wel** ESTIMATE blijft: `FINANCING_STRATEGIES.*.ltv`/
`.loanTermYears` definiëren waar TSG de grens van "Low/Medium/High
Leverage" legt (een producttier-definitie, geen marktclaim — de rente zelf
is wél een marktclaim en blijft SOURCED). `SCENARIOS.*` definieert hoe
streng elk scenario doorrekent (methodologie: wat "conservatief" als
stress-test betekent), niet een voorspelling dat de huur exact 10% zal
dalen. `HYBRID_SHARE_*` en de projectiehorizon
(`PROJECTION_YEARS`/`PROJECTION_INTERIM_YEAR`) zijn eveneens
modeldefinities, geen feitelijke claims.

**PLACEHOLDER** (28, moeten vóór productiegebruik worden vervangen of
onderbouwd): de 14 hierboven, plus `RENT_MATRIX_LONG_TERM_PER_M2`/
`_SHORT_TERM_PER_M2` (geen externe bron voor deze specifieke prijspunten),
`MAINTENANCE_RATE`, `BANK_FEE` (Excel-only, geen externe bron), CapEx per
renovatiestrategie (`RENOVATION_STRATEGIES.{minimal,light,heavy}.capex` —
al [BESLISSING] in §3), `DEFAULT_RENOVATION_IMPROVEMENT_SHARE`,
`DEFAULT_MIN_REQUIRED_RETURN`, `DEFAULT_BUILDING_SHARE_OF_VALUE` (alle
drie al [BESLISSING] elders in dit document), `DEPRECIATION_BUILDING_SHARE`
(bestaat uitsluitend voor fase-1-Excel-pariteit, geen claim over een echt
pand) en `DEPRECIATION_SCENARIO_FACTORS` per scenario (uit de Excel
gerepliceerd zonder toegelichte afleiding — bij twijfel dus PLACEHOLDER,
niet ESTIMATE).

**ESTIMATE** (27, TSG's eigen modeldefinities, geen externe claim): de
scenariomultipliers (`SCENARIOS`), de hybride-verdeling
(`HYBRID_SHARE_LONG_TERM`/`_SHORT_TERM`), de financieringstiers
(`ltv`/`loanTermYears` per strategie), en de projectiehorizon
(`PROJECTION_YEARS`/`PROJECTION_INTERIM_YEAR`, MODEL_SPEC_FASE1B §2's
eigen aanbeveling).

**SOURCED** (25): belastingtarieven (IBI, huurinkomsten, vermogenswinst,
afschrijving, niet-ingezetenenopslag), aankoopkosten (ITP/AJD/notaris/
kadaster/courtage), de wijktabellen, verzekeringen, nutskosten,
financieringsrentes, en de Correction Factors-reeksen (huurgroei, CPI,
waardegroei) — elk met een genoemde bron en datum, zie de commentaren bij
elke waarde in `parameters.ts` voor het volledige citaat.

**Afgeleide waarden — zwakste-schakelregel.** Een afgeleide parameter
(bijv. `TOTAL_INSURANCE_ANNUAL`, de som van vier verzekeringsposten) krijgt
het zwakste label van zijn onderdelen, nooit stilzwijgend het sterkste.
`types.ts` exporteert `weakestProvenance()` en `deriveParameter()`;
`TOTAL_INSURANCE_ANNUAL` en `TOTAL_UTILITIES_PER_M2_ANNUAL` worden hiermee
**berekend**, niet met een handmatig getypt label — als een onderdeel later
wordt gedegradeerd (bijv. van SOURCED naar PLACEHOLDER omdat een bron
onbetrouwbaar blijkt), volgt de afgeleide waarde automatisch mee. Dat
maakt stilzwijgend verschuiven structureel onmogelijk in plaats van
afhankelijk van menselijke discipline. `parameters.test.ts` legt dit vast:
een test met een gesimuleerde degradatie bevestigt dat de afgeleide waarde
meebeweegt, en twee regressietests bevestigen dat de huidige
`TOTAL_INSURANCE_ANNUAL`/`TOTAL_UTILITIES_PER_M2_ANNUAL` exact overeenkomen
met wat `deriveParameter()` uit hun bronparameters zou berekenen.

Bestaande golden tests die op een nu-PLACEHOLDER waarde steunen (bijv. de
80%-afschrijvingsbasis of de CapEx-bedragen) zijn ongewijzigd gebleven —
ze toetsen dat de rekenlogica de waarde correct gebruikt, niet dat de
waarde zelf juist is. Dat blijft zo totdat een PLACEHOLDER wordt vervangen
door een geverifieerd cijfer.

## 14. Herkomst zichtbaar in de scenario-uitkomst — `outcome.ts`

Onderdeel §13 geeft elke parameter een herkomstlabel; dit onderdeel draagt
dat label door tot in `ScenarioOutcome` (MODEL_SPEC_FASE1B §7), zodat het
rapport later kan tonen welke conclusies op onbevestigde aannames rusten —
zonder de gehele rekenketen te herbouwen om `Parameter<T>`-objecten in
plaats van kale getallen door te geven.

**Ontwerp: een lijst per uitkomst, geen vlag.** `ScenarioOutcome` krijgt
een nieuw veld `placeholdersUsed: Parameter<unknown>[]` — de volledige
PLACEHOLDER-objecten (naam, waarde, redenering) die déze specifieke
combinatie van scenario, huurstrategie en renovatiestrategie daadwerkelijk
gebruikt, niet elke PLACEHOLDER die ergens in `parameters.ts` bestaat. Een
enkel `hasPlaceholder: boolean`-veld zou geen van beide vragen kunnen
beantwoorden die het rapport moet stellen: *welke* aannames, en *waarom*
onbevestigd.

**Herleiding, niet gok.** `outcome.ts` exporteert (intern)
`collectPlaceholders()`, die per uitkomst teruggrijpt op de daadwerkelijke
code-paden in de andere modules — nagelopen bestand voor bestand, niet
aangenomen:

- `MAINTENANCE_RATE` (`scenarios.ts`) en `BANK_FEE` (`operating.ts`,
  `acquisition.ts`) gelden voor élke uitkomst onvoorwaardelijk.
- `BASE_OCCUPANCY_LONG_TERM`/`SHORT_TERM` (`income.ts`) gelden alleen voor
  de daadwerkelijk gekozen huurstrategie: beide bij hybride, één bij
  langetermijn/kortetermijn — `buildIncomeModel()` berekent intern altijd
  beide lijnen, maar alleen de geselecteerde stroomt door naar
  `selectedGrossAnnualIncome` en dus naar de rest van de keten.
- De vijf PLACEHOLDER-velden van de gekozen renovatiestrategie
  (`RENOVATION_STRATEGIES[id]`) — de twee niet-gekozen strategieën hebben
  deze uitkomst nooit geraakt.
- `DEPRECIATION_SCENARIO_FACTORS[scenario]` (`projection.ts`) — alleen de
  factor van dit ene scenario.
- `DEFAULT_BUILDING_SHARE_OF_VALUE` (`projection.ts`) en
  `DEFAULT_RENOVATION_IMPROVEMENT_SHARE` (`exit.ts`) alleen wanneer de
  aanroeper geen pandspecifiek cijfer heeft meegegeven — `outcome.ts` kan
  dat niet zelf zien in een reeds berekend `ExitResult`/`ProjectionYear[]`,
  dus `buildScenarioOutcome()` accepteert twee expliciete vlaggen
  (`buildingShareOfValueProvided`, `renovationImprovementShareProvided`)
  die de aanroeper zet zodra hij zelf een niet-standaardwaarde doorgeeft
  aan `buildProjectionYears()`/`computeExit()`. Zodra onderdeel 4
  (kadastrale waarde) de eerste daadwerkelijk verbindt, verdwijnt
  `DEFAULT_BUILDING_SHARE_OF_VALUE` automatisch uit de lijst voor elk pand
  waar de kadastrale waarde is ingevuld.
- `DEFAULT_MIN_REQUIRED_RETURN` (`outcome.ts` zelf) alleen wanneer de
  belegger geen `minRoiTarget` heeft opgegeven.

De `RENT_MATRIX_LONG_TERM_PER_M2`/`SHORT_TERM_PER_M2` PLACEHOLDERS (§13)
komen bewust niet voor: die tabellen voeden vandaag geen enkele berekening
(referentiedata voor een toekomstige huurselectie-UI), dus geen enkele
uitkomst rust erop.

**Referentiecasus (hybride, licht renovatie).** `placeholdersUsed` bevat
twaalf parameters: `MAINTENANCE_RATE`, `BANK_FEE`, beide
bezettingsgraad-PLACEHOLDERS (hybride gebruikt beide), de vijf
`RENOVATION_STRATEGIES.light.*`-velden, `DEPRECIATION_SCENARIO_FACTORS`
van het betreffende scenario, en de twee standaardaannames
(`DEFAULT_BUILDING_SHARE_OF_VALUE`, `DEFAULT_RENOVATION_IMPROVEMENT_SHARE`
— geen van beide is in de referentiecasus overschreven).
`DEFAULT_MIN_REQUIRED_RETURN` ontbreekt, omdat de referentiecasus wél een
`minRoiTarget` (4%) opgeeft.

Golden tests (`outcome.test.ts`, `describe("placeholdersUsed: ...")`):
de exacte referentiecasus-lijst; dat elk item werkelijk PLACEHOLDER is en
nooit SOURCED/ESTIMATE; dat een langetermijn-only uitkomst wél de
langetermijn- maar niet de kortetermijn-bezettingsgraad meedraagt; en dat
een expliciet meegegeven `buildingShareOfValue`/`renovationImprovementShare`
de bijbehorende default uit de lijst laat verdwijnen.

## 15. Gastos de comunidad — verplichte invoer, geen default

**Nieuwe vaste last, naast IBI, verzekeringen en bankkosten.** Elk gebouw
met gemeenschappelijke ruimtes (trappenhuis, lift, tuin, zwembad, portiek)
kent een maandelijkse of jaarlijkse bijdrage aan de vereniging van eigenaars
(comunidad de propietarios). Deze post ontbrak volledig in
`TSG_Model_v3.xlsx` en in fase 1/1b tot dit onderdeel.

**Geen default — verplichte invoer per pand.** In tegenstelling tot IBI
(een vast percentage van de aankoopprijs) of de verzekeringen (een vaste,
gebronde jaarsom) is gastos de comunidad niet als percentage of vast bedrag
te benaderen: het verschilt te sterk per gebouw — grootte van de
vereniging, aanwezigheid van lift/zwembad/conciërge, staat van onderhoud
van de gemeenschappelijke delen. Een generieke schatting zou hier meer
schade doen dan een lege invoer: `PropertyInput.communityFeesAnnual` is
daarom een **verplicht** veld zonder fallback in `parameters.ts` —
`validateEngineInput()` wijst een ontbrekende of negatieve waarde af
(`communityFeesAnnual must be zero or positive`); 0 is een geldige waarde
voor een gebouw zonder vereniging.

**Waar het meetelt.** Dezelfde behandeling als IBI/verzekeringen/
bankkosten, overal waar die voorkomen:
- `FixedOperatingCosts.communityFees` (`operating.ts`) — telt mee in
  `FixedOperatingCosts.total` en, via `engine.ts`, in elk scenario's
  `fixedCosts`/NOI/opex/cashflow/DSCR (fase 1, `scenarios.ts`).
- `TaxResult`/`ProjectionYear.deductibleCosts` (`tax.ts`, `projection.ts`)
  — een aftrekbare kostenpost bij het bepalen van de IRNR-huurbelasting,
  dezelfde categorie als IBI/verzekeringen/onderhoud/management.
- `ProjectionYear.communityFees` (`projection.ts`) — volgt de CPI-indexatie
  van §3, net als de overige vaste lasten (géén marktwaarde-koppeling zoals
  bij een huurgroei-gekoppelde post).
- Blijft buiten `AcquisitionCosts` (geen aankoopkosten) en buiten
  `ExitResult` (geen invloed op de aanschafwaarde of de vermogenswinst).

**Referentiecasus.** `€ 900/jaar` is een **testfixture**, niet gesourced
voor Avenida Primado Reig 19 — er bestaat geen brongegeven voor deze
specifieke vereniging van eigenaars. Gekozen als rond getal om de formule
te toetsen, net als `ExitAssumptions.sellingCommissionRate`/
`.municipalCapitalGainsTax` in §12. `acquisition.test.ts` houdt daarnaast
een expliciete `communityFeesAnnual: 0`-golden test aan om de pure
Excel-pariteitscijfers (§11's onderliggende Excel-waarden, zonder deze
post) apart herleidbaar te houden.

Golden tests bijgewerkt via onafhankelijke Python-doorrekening (dezelfde
methode als fase 1b): `operating.ts`/`engine.ts`/`tax.ts`
(`acquisition.test.ts`, `engine.test.ts`), `projection.ts`
(`projection.test.ts`, incl. een eigen CPI-indexatietoets voor
`communityFees`), en de stroomafwaartse `irr.test.ts`/`outcome.test.ts` —
`exit.test.ts` blijft **ongewijzigd**: `computeExit()` gebruikt nergens
cashflow of vaste lasten, alleen verkoopprijs, cumulatieve afschrijving
(onaangetast) en restschuld (onaangetast), dus gastos de comunidad raakt
de exit-berekening niet.

## 16. Kadastrale waarde — optionele invoer, betere IBI- en afschrijvingsgrondslag

**Twee bestaande benaderingen, één echte oplossing.** Twee plekken in het
model schatten een grondslag die eigenlijk uit de kadastrale waarde (valor
catastral) hoort te komen, omdat dat gegeven zelden voorhanden is:
- IBI (§6) wordt berekend als 0,4% van de **aankoopprijs** — feitelijk
  wordt IBI geheven over de kadastrale waarde, niet over de markt-/
  aankoopprijs, en die twee lopen in Spanje doorgaans sterk uiteen.
- De meerjarige afschrijvingsgrondslag (§12) is
  `aankoopprijs × DEFAULT_BUILDING_SHARE_OF_VALUE (0,70)` — een generieke
  aanname over het opstalaandeel, terwijl de wet uitgaat van het
  daadwerkelijke opstalgedeelte van de kadastrale waarde.

`PropertyInput.cadastralValue?: { suelo: number; construccion: number }`
(optioneel) — de kadastrale waarde zoals het Catastro die zelf al
uitsplitst in grond (suelo) en opstal (construcción) — lost beide op zodra
ze bekend is:
```
IBI                = (suelo + construcción) × PROPERTY_TAX_IBI_RATE
afschrijvingsbasis = construcción  (exclusief grond, zoals de wet vereist)
```
`fixedOperatingCosts()` (`operating.ts`) en `buildProjectionYears()`
(`projection.ts`) krijgen elk een optionele `cadastralValue`-parameter die,
wanneer meegegeven, voorrang heeft boven respectievelijk de
aankoopprijs-benadering en `buildingShareOfValue` (die laatste wordt dan
genegeerd, ook als hij expliciet is meegegeven — een pandspecifieke
kadastrale waarde is sterker bewijs dan een handmatige schatting van het
opstalaandeel).

**Waar niet ingevuld, blijft de huidige benadering staan — en wordt dat nu
een aanname die code kan zien.** Vóór dit onderdeel bestond er geen
PLACEHOLDER voor "IBI over de aankoopprijs benaderd"; alleen de
afschrijvingskant had er een (`DEFAULT_BUILDING_SHARE_OF_VALUE`, al gedekt
door onderdeel 2's `placeholdersUsed`-mechanisme). Nieuwe parameter in
`parameters.ts`:
```
DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO = 1,0   [PLACEHOLDER]
```
Geen sourced ratio bestaat tussen kadastrale waarde en markt-/aankoopprijs
(kadastrale waardes worden administratief vastgesteld en wijken doorgaans
af van de marktprijs); 1,0 is expliciet géén marktclaim maar een
identiteits-placeholder die de IBI-schatting berekenbaar houdt zolang er
geen echte kadastrale waarde is. Deze waarde verandert niets aan de
rekenuitkomst (× 1,0) maar maakt de aanname zelf inspecteerbaar: hij komt
in `ALL_PARAMETERS` te staan en wordt door `outcome.ts`'s
`collectPlaceholders()` in `placeholdersUsed` opgenomen zodra
`cadastralValueProvided` op `false` staat (default), naast
`DEFAULT_BUILDING_SHARE_OF_VALUE` wanneer die ook niet is overschreven.

**Referentiecasus ongewijzigd.** Avenida Primado Reig 19 heeft geen
kadastrale waarde ingevuld, dus alle bestaande golden tests (§11, §12)
blijven exact staan — dit onderdeel introduceert alleen een nieuw, apart
pad, geen wijziging van de bestaande uitkomst. Nieuwe golden tests
(`acquisition.test.ts`, `projection.test.ts`, `outcome.test.ts`,
`validation.test.ts`) tonen dat pad met een synthetisch voorbeeld
(suelo € 120.000, construcción € 80.000): IBI € 800 in plaats van € 1.320,
afschrijvingsbasis € 80.000 (vóór 3%/scenariofactor) in plaats van
€ 231.000 (330.000 × 0,70), en dat beide defaults uit `placeholdersUsed`
verdwijnen zodra de kadastrale waarde is doorgegeven.

## 17. Bruikbaar en gebouwd oppervlak — gescheiden invoer

**Twee verschillende oppervlaktes, één invoerveld in de Excel.**
`TSG_Model_v3.xlsx` heeft één `livingAreaM2` dat zowel de huurschatting als
de nutskostenschatting voedt. Feitelijk zijn dit twee verschillende
metingen: superficie útil (bruikbaar oppervlak — vloeroppervlak binnen de
muren, waar een huurder daadwerkelijk woont) en superficie construida
(gebouwd oppervlak — inclusief buitenmuren en een aandeel gemeenschappelijke
ruimtes), en Spaanse vastgoedadvertenties/kadastrale gegevens vermelden ze
vaak apart. `PropertyInput` splitst dit nu:
```
usableAreaM2?: number   (superficie útil, optioneel)
builtAreaM2: number     (superficie construida, verplicht)
```

**Wat elk oppervlak voedt.** Ongewijzigd qua formule, alleen de juiste
invoer gekoppeld:
- Huurschatting (§2, `income.ts`): `basishuur = huurprijs €/m² × bruikbaar
  oppervlak` — niet gebouwd oppervlak, dat een huurder niet daadwerkelijk
  gebruikt.
- Nutskosten (§6, `operating.ts`): `nutskosten = 21,5 €/m²/jaar × gebouwd
  oppervlak` — gas/water/elektra-aansluitingen en -leidingen lopen door het
  hele gebouwde oppervlak, niet alleen het bruikbare deel.

**Waar alleen gebouwd oppervlak bekend is.** `builtAreaM2` is verplicht;
`usableAreaM2` is optioneel omdat vastgoedadvertenties en kadastrale
gegevens het gebouwde oppervlak vaker vermelden dan het bruikbare. Nieuwe
parameter in `parameters.ts`:
```
DEFAULT_USABLE_TO_BUILT_AREA_RATIO = 0,85   [PLACEHOLDER]
```
Een uitspraak over de werkelijke verhouding tussen twee fysieke metingen
van een concreet gebouw — geen modelkeuze — dus volgens de toets uit §13
uitsluitend SOURCED of PLACEHOLDER, nooit ESTIMATE. Geen bron gevonden voor
dit specifieke cijfer (een veelgenoemde vuistregel, geen geciteerde
meting) en de werkelijke verhouding verschilt per gebouw (muurdikte,
aandeel gemeenschappelijke circulatieruimte) — PLACEHOLDER. `engine.ts`
past hem alleen toe wanneer `usableAreaM2` ontbreekt:
`usableAreaM2 = builtAreaM2 × DEFAULT_USABLE_TO_BUILT_AREA_RATIO`.

**Zichtbaar in de uitkomst (onderdeel 2, §14).** `buildScenarioOutcome()`
krijgt een nieuwe vlag `usableAreaM2Provided`; wanneer die op `false` staat
(default, en dus ook wanneer de aanroeper hem vergeet te zetten), neemt
`collectPlaceholders()` `DEFAULT_USABLE_TO_BUILT_AREA_RATIO` op in
`placeholdersUsed` — dezelfde vlag-op-caller-niveau als bij
`buildingShareOfValueProvided`/`cadastralValueProvided`, om dezelfde reden:
`outcome.ts` ziet zelf niet of de al berekende `ProjectionYear[]` op een
gemeten of afgeleid oppervlak rust.

**Referentiecasus ongewijzigd.** Avenida Primado Reig 19 heeft in
`TSG_Model_v3.xlsx` één oppervlaktecijfer (133 m²), geen aparte
bruikbaar/gebouwd-splitsing. `referencecase.ts` zet `usableAreaM2` en
`builtAreaM2` daarom expliciet en identiek op 133 — de huidige benadering
letterlijk voortgezet, niet de `DEFAULT_USABLE_TO_BUILT_AREA_RATIO`-fallback
(die alleen intreedt wanneer `usableAreaM2` wordt weggelaten). Alle
bestaande golden tests (§11, §12, §15, §16) blijven daardoor exact staan.

Golden tests: `engine.test.ts` (`describe("usable vs. built floor area")`)
bewijst met een synthetisch voorbeeld (bruikbaar 100 m², gebouwd 120 m²)
dat huur en nutskosten onafhankelijk de juiste invoer gebruiken, en dat de
conversiefactor correct wordt toegepast wanneer `usableAreaM2` ontbreekt
(120 × 0,85 = 102 m² bruikbaar); `validation.test.ts` toetst dat
`usableAreaM2` niet groter mag zijn dan `builtAreaM2`; `outcome.test.ts`
bevestigt dat `DEFAULT_USABLE_TO_BUILT_AREA_RATIO` alleen in
`placeholdersUsed` verschijnt wanneer `usableAreaM2Provided` op `false`
staat.

## 18. Vergunningspoort — título habilitante voor toeristische verhuur

**Kortetermijn-/toeristische verhuur is in Spanje vergunningsplichtig.**
Zonder geldig título habilitante (de verhuurvergunning die gemeentes en
autonome regio's voor toeristische verhuur eisen) mag een eigenaar
wettelijk niet kortetermijn of hybride (LT/ST-mix) verhuren — alleen
langetermijn blijft dan toegestaan. `TSG_Model_v3.xlsx` modelleert dit niet:
het rekent ST/hybride-scenario's door ongeacht vergunningsstatus.

**Nieuwe verplichte invoer.** `PropertyInput.hasTouristRentalLicense:
boolean` — in tegenstelling tot gastos de comunidad (§15) geen bedrag dat
per gebouw varieert, maar een simpel, altijd kenbaar ja/nee-feit over het
pand/de eigenaar. Geen default; `validateEngineInput()` wijst een
ontbrekende of niet-boolean waarde af.

**Poort, niet een uitkomst op nul.** Twee plekken dwingen dit af:
- `validateEngineInput()` wijst `selections.rentalStrategy` "shortTerm" of
  "hybrid" af zodra `hasTouristRentalLicense` `false` is — `runEngine()`
  compileert/rekent in dat geval helemaal niet door voor die selectie.
  "longTerm" blijft ongeacht vergunningsstatus toegestaan.
- `EngineResult.rentalStrategies` (nieuw, `lib/rules/es/licensing.ts`,
  `rentalStrategyAvailability()`) geeft, onafhankelijk van welke strategie
  daadwerkelijk is geselecteerd, een overzicht van wat er sowieso mogelijk
  is voor dit pand:
  ```
  available    : RentalStrategy[]                        (bijv. ["longTerm"])
  unavailable  : { strategy: RentalStrategy; reason: string }[]
  ```
  Zonder vergunning bevat `available` alléén `"longTerm"` —
  `"shortTerm"`/`"hybrid"` staan niet in die lijst met een impliciete
  nulwaarde, ze **ontbreken volledig**. `unavailable` draagt de reden per
  uitgesloten strategie (`"Requires a valid título habilitante..."`), zodat
  een rapport of selector-UI kan uitleggen waarom kortetermijn/hybride niet
  aangeboden worden, ook al is er nooit een cijfer voor berekend.

**Referentiecasus.** Avenida Primado Reig 19 selecteert `"hybrid"` als
verhuurstrategie (§11); `hasTouristRentalLicense: true` is daarom vereist
om die selectie geldig te houden — gezet als een consistentie-eis van deze
testfixture, geen claim over de werkelijke vergunningsstatus van dit
specifieke pand. Alle bestaande golden tests blijven daardoor exact staan.

Golden tests: `licensing.test.ts` toetst `rentalStrategyAvailability()`
puur (met/zonder vergunning, exacte `available`/`unavailable`-inhoud en de
reden); `validation.test.ts` toetst dat "shortTerm"/"hybrid" zonder
vergunning worden afgewezen (`runEngine()` gooit `ValidationError`) en dat
"longTerm" ongeacht vergunningsstatus geldig blijft; `engine.test.ts`
bevestigt `EngineResult.rentalStrategies` op zowel de referentiecasus (alle
drie beschikbaar) als een synthetisch geval zonder vergunning (alleen
langetermijn beschikbaar, de andere twee met reden in `unavailable`, en de
engine draait gewoon door voor de wél geldige `"longTerm"`-selectie).

## 19. Renovatieduur — de verbouwing kost tijd, en die tijd kost huur

**Het probleem.** Het model rekende een verbouwing als instantaan. De werkbladen kennen per renovatiescenario wel een CapEx-bedrag en een aanlooptijd om een huurder te vinden (`timeToRentMonths`, 1/2/3 maanden), maar geen doorlooptijd van het werk zelf. `projection.ts` prorateerde jaar 1 dus alleen op die aanlooptijd, en telde volle huur over de maanden waarin het pand een bouwplaats was. Voor elk pand overschatte dat jaar 1.

Dat de klantcopy van `timeToRentMonths` altijd al zei "het pand staat X maanden leeg *voordat het verhuurd wordt*" — dus ná de verbouwing — maakte het eenduidig: er ontbrak een periode, er was er niet één verkeerd gelabeld.

**De correctie.** `RENOVATION_DURATION_MONTHS_BY_TIER` (PLACEHOLDER: minimaal 1, licht 3, grondig 5 maanden) staat naast de bestaande aanlooptijd, en de twee zijn **additief**:

```
leegstand jaar 1 = renovatieduur + aanloopleegstand
maanden verhuurd  = max(0, 12 − leegstand jaar 1)
```

PLACEHOLDER, en dat is de juiste markering: het is een claim over hoe lang echt bouwwerk duurt, zonder externe bron — dezelfde status als `timeToRentMonths` zelf. De klant kan de duur overschrijven (`ModelSelections.renovationDurationMonths`); doet hij dat, dan valt de parameter uit `placeholdersUsed` en stijgt de datazekerheid, net als bij een ingevulde kadastrale waarde of bruikbaar oppervlak.

**Wat wél en niet prorateert** is ongewijzigd: alleen de huur en de beheervergoeding (een percentage van die huur) schalen mee. Onderhoud, energie, IBI, verzekering, bankkosten, gastos de comunidad, derramas en de volledige annuïteit lopen het hele jaar door, of er nu verhuurd wordt of niet.

**Twee randgevallen.**

1. `max(0, …)` is geen cosmetica. Zonder de klem levert een leegstand boven twaalf maanden een *negatieve* huur op — de projectie zou het pand geld laten opbrengen door langer leeg te staan.
2. Alleen jaar 1 wordt geprorateerd. Loopt de leegstand door in jaar 2, dan valt dat buiten het model: jaar 2 telt een vol jaar. Het formulier accepteert daarom maximaal 12 maanden verbouwtijd, en het rapport meldt expliciet dat jaar 2 te hoog staat wanneer verbouwing plus aanloop samen de twaalf maanden passeren. Stil afkappen zou de uitkomst mooier maken dan hij is.

**Gevolg voor de referentiecasus** (Avenida Primado Reig 19, licht scenario: 3 + 2 = 5 maanden leeg): bruto huur jaar 1 van € 23.700,60 naar € 16.590,42, cashflow vóór belasting van −€ 8.094,57 naar −€ 14.635,93, IRR van 5,54% naar 5,24%, TSG-score van 3,8 naar 3,6 op percentiel 68. De referentieverdeling uit SCORE_SPEC.md §5 is opnieuw gegenereerd, zoals de "Verversing"-regel daar voorschrijft. Jaar 2 en verder zijn ongewijzigd — wat zelf de controle is dat de proratie tot het eerste jaar beperkt is gebleven.

## 20. Financieringsvoorwaarden — zichtbaar, overschrijfbaar, en één regel in plaats van twee

**Twee regels op dezelfde invoer.** De gewenste LTV bepaalde zowel de tier (voor de looptijd) als de rente, maar via verschillende regels: `deriveFinancingStrategy()` koos de *dichtstbijzijnde* tier-LTV, `selectInterestRate()` (Excel D123) de *eerste tier waarvan de LTV de gewenste dekt*. Bij een gewenste LTV strikt tussen twee tiers gaven die verschillende antwoorden, en de klant kreeg het verschil: bij 62% de looptijd van `low` (25 jaar) met de rente van `medium` (2,85%).

Zolang geen van beide getallen zichtbaar was, bleef dat onopgemerkt. Deze stap toont ze, dus moest de tegenspraak weg.

**De reparatie** trekt de tier naar de regel van de rente, niet andersom: `deriveFinancingStrategy()` gebruikt nu dezelfde dekkende regel. Bij 62% is dat `medium` — 20 jaar tegen 2,85%, één tier, één paar voorwaarden. Dat is ook inhoudelijk de betere lezing: een tier die op 60% aftopt kán geen 62% financieren.

Twee gevolgen:
- `FINANCING_TIER_SELECTION_TIE_BREAK` is verwijderd. Een dekkende regel kent geen gelijkspel, dus die parameter beantwoordde een vraag die niet meer bestaat.
- De referentieverdeling verandert **niet**. De synthetische generator loot zijn tier onafhankelijk van de LTV, en de renteregel is ongemoeid gelaten — de andere richting (rente volgt de tier) zou daar ~67% van de casussen hebben geraakt.

**Zichtbaar en overschrijfbaar.** Stap 3 toont, zodra een LTV is ingevuld, met welke rente en looptijd wordt gerekend. Achter een vinkje ("ik heb een concreet aanbod van mijn bank") staan twee optionele velden. Een ingevulde waarde wint volledig van de tier — hetzelfde precedent als de huur-override en de kadastrale waarde: een hard klantfeit verslaat een modelaanname.

**De rente is all-in.** Een bank die een niet-ingezetene een rente offreert, heeft die opslag al verwerkt. `NON_RESIDENT_INTEREST_SPREAD` wordt daarom níét bovenop een opgegeven rente geteld: `SelectedFinancing.nonResidentSpread` gaat op nul, zodat `interestRate + nonResidentSpread` — wat de rest van de engine leest — precies het opgegeven getal is. Zonder die stap zou een aanbod van 3,6% stilzwijgend 4,6% worden. Het rapport zegt dit ook met zoveel woorden.

**Herkomst.** `FinancingTermsProvenance` heeft een helft per veld, want de twee zijn onafhankelijk optioneel; beide dragen wat de tier zou hebben gegeven, zodat het rapport kan contrasteren. De afgeleide rente die het draagt is de all-in rente, niet de basisrente — anders zou de klant zijn eigen all-in offerte tegen een basisgetal leggen.

Anders dan bij de renovatieduur beweegt de **datazekerheid niet**: de tier-rente is SOURCED en de looptijd ESTIMATE, geen van beide PLACEHOLDER. Overschrijven verandert dus wélke aannames het rapport noemt, niet hoe zeker de data heet te zijn. Dat is juist — je eigen offerte in de plaats stellen van een gepubliceerde marktrente is een ander soort verbetering dan het invullen van een onbevestigde schatting.

**LTV-copy.** Alle drie de LTV-velden hebben een toelichting. Bij "Maximale LTV" staat wat Spaanse banken een niet-ingezetene doorgaans financieren; dat getal komt uit `NON_RESIDENT_TYPICAL_LTV_RANGE` (SOURCED, 60–70%, geraadpleegd augustus 2026), niet uit een tweede hardgecodeerd paar in de copy. De parameter voedt geen enkele berekening — hij informeert alleen het antwoord dat de klant zelf geeft — en dat is precedent dat al bestaat (`RENT_MATRIX_LONG_TERM_PER_M2` heeft dezelfde rol). De zeven geraadpleegde bronnen staan bij de parameter zelf; twee ervan vallen buiten de opgeslagen band (Expatica begint bij 50%, MySpainVisa haalt 75% voor sterke profielen), en het woord "doorgaans" in de copy is precies wat een centrale tendens met uitschieters aan beide kanten draagt.

**Client-bundel.** De afleiding moet live meelopen met wat de klant typt, dus ze kan niet één keer server-side worden opgelost zoals bij stap 1 en 2. Het formulier krijgt in plaats daarvan een platte tabel van de drie tiers als prop (`_lib/financing-bands.ts`, dat zelf niets importeert) en doet daar een pure lookup op. `financing-bands.test.ts` pint die lookup tegen `deriveFinancingStrategy()` over het hele 0–1-bereik, zodat de regel niet op twee plekken uit elkaar kan lopen.

## 21. Aankoopkosten als kopregel op de gratis indicatie — en een openstaande vraag over AJD

**Wat er is toegevoegd.** De gratis indicatiepagina noemde de Spaanse aankoopkosten nergens. Wie alleen de maandcashflow zag, kon denken dat het benodigde kapitaal de koopsom is. Er staat nu een regel bovenaan het resultaat — boven de score, niet tussen de voorbehouden — die zegt wat er bovenop komt.

Het getal is niet nieuw bedacht: `acquisitionCostRates()` telt precies de tarieven op die `acquisitionCosts()` al in rekening brengt, zodat de gratis pagina en het betaalde rapport per constructie hetzelfde percentage noemen. Een golden test rekent dat na op een echte koopsom.

Gesplitst in twee delen, omdat het twee soorten kosten zijn:

| | Tarief |
|---|---|
| Verplicht (ITP 10%, AJD 1,5%, notaris 0,5%, registratie 0,3%, juridisch 1,0%) | **13,3%** |
| Bemiddeling aankoopmakelaar | **5,0%** |
| Totaal zoals het model het berekent | **18,3%** |

`BANK_FEE` (€ 100) valt erbuiten: dat is een vast bedrag, geen tarief, en zou de functie prijsafhankelijk maken voor een verwaarloosbaar getal.

**De openstaande vraag: ITP én AJD tegelijk.** De feedback noemde "typisch 11-12%". Dat is precies ITP + notaris + registratie + juridisch = **11,8%**. Het verschil met de 13,3% hierboven is de 1,5% AJD, die dit model óók toepast.

In Spanje sluiten die twee elkaar normaal gesproken uit: ITP op bestaande bouw, AJD (naast btw) op nieuwbouw. De module zelf zegt "Spain, existing build", wat ITP impliceert en AJD dus niet — behalve op de hypotheekakte, met een andere en veel kleinere grondslag. Dat beide op de volle koopsom worden geheven ziet er daarom uit als een dubbeltelling van 1,5%.

Dit is **niet** in deze wijziging gecorrigeerd, om twee redenen. Het is een rekenlaagwijziging (deze taak was expliciet copy/presentatie), en hij raakt de referentiecasus, de TSG-score en de referentieverdeling — dus hij hoort als eigen stap met eigen review, niet als bijvangst. Tot dat besluit valt, quoteert de gratis pagina wat het model werkelijk rekent: consistentie tussen gratis en betaald weegt hier zwaarder dan de vraag welk van beide getallen juist is, want een verkeerd getal is in beide rapporten hetzelfde verkeerde getal en wordt in één keer gerepareerd.

**De voorbehouden.** Dezelfde pagina toonde vijf losse voorbehouden onder elkaar, wat als vijf redenen tot wantrouwen leest in plaats van vijf verschillende dingen die de lezer moet weten. Ze staan nu in drie gerubriceerde blokken: wat er wel en niet in het bedrag zit, waar de cijfers op rusten, en wat de indicatie niet beoordeelt.

Puur presentatie. `FreeTierDisclosureKey`, de Nederlandse teksten en welke sleutels een resultaat draagt zijn alle drie ongewijzigd; de groepering is een `Record` over de volledige union, dus een nieuwe sleutel zonder groep compileert niet en kan niet stilzwijgend nergens terechtkomen. Lege groepen renderen geen kop — `narrowedByCustomerInput` is voorwaardelijk.
