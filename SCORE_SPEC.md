# SCORE_SPEC — TSG-scoremodel

Specificatie van het scoremodel. Dit bestand gaat in de repo naast MODEL_SPEC.md en UI_SPEC.md. Het scoremodel is een engine-onderdeel, geen UI-onderdeel: de score wordt berekend in de rekenlaag en meegeleverd in de uitkomst.

---

## 1. Structuur

Vijf dimensies, elk 0,0–10,0 (één decimaal). Gewogen totaalscore 0,0–10,0. Percentiel 0–99 (geheel getal), afgeleid uit een referentieverdeling.

## 2. Dimensiescoring

Elke dimensie is een monotone mapping van één engine-uitkomst naar een 0–10 schaal. De mapping is gedefinieerd als een stuksgewijs lineaire functie (piecewise linear) tussen ankerpunten. Tussen ankerpunten wordt lineair geïnterpoleerd. Onder het laagste ankerpunt: 0. Boven het hoogste: 10.

Stuksgewijs lineair in plaats van een sigmoid of logistische curve, omdat:

- het exact herleidbaar is: de klant kan met een liniaal zien waarom hij een 6 kreeg
- het geen verborgen parameters heeft (geen k, geen midpoint)
- het eenvoudig bij te stellen is zonder de hele curve te verschuiven

### 2.1 Cashflow

Invoer: maandcashflow basisscenario (€).

| Ankerpunt | Score |
|---|---|
| ≤ −500 | 0,0 |
| −250 | 2,0 |
| 0 | 4,0 |
| +250 | 6,0 |
| +500 | 7,5 |
| +1.000 | 9,0 |
| ≥ +1.500 | 10,0 |

Toelichting: 0 is niet het midden maar een 4 — break-even is een prestatie bij gefinancierd buitenlands vastgoed. Negatieve cashflow is niet automatisch fataal (zie de referentiecasus), maar drukt de score wel stevig.

### 2.2 Schuldbestendigheid

Invoer: DSCR basisscenario (ratio).

| Ankerpunt | Score |
|---|---|
| ≤ 0,50 | 0,0 |
| 0,75 | 2,5 |
| 1,00 | 5,0 |
| 1,20 | 7,0 |
| 1,40 | 8,5 |
| ≥ 1,80 | 10,0 |

Toelichting: DSCR = 1,0 is exact break-even op de schuldlast en krijgt een 5 — niet goed, niet slecht. Onder 1,0 legt de belegger bij; boven 1,4 is er substantiële buffer.

### 2.3 Rendement

Invoer: IRR basisscenario minus rendementseis (procentpunten).

| Ankerpunt | Score |
|---|---|
| ≤ −4% | 0,0 |
| −2% | 2,0 |
| 0% | 5,0 |
| +2% | 7,0 |
| +4% | 8,5 |
| ≥ +8% | 10,0 |

Toelichting: de score meet niet de absolute IRR maar het surplus boven de eis van de belegger. 0% surplus = de eis net gehaald = een 5. Dit maakt de score persoonlijk zonder subjectief te zijn: twee beleggers met verschillende eisen krijgen een verschillende score op hetzelfde pand, en dat is correct.

### 2.4 Haalbaarheid

Invoer: twee binaire toetsen uit de engine.

| Situatie | Score |
|---|---|
| Eigen vermogen onvoldoende EN budget overschreden | 0,0 |
| Eigen vermogen onvoldoende OF budget overschreden | 3,0 |
| Beide gehaald, maar marge < 10% | 7,0 |
| Beide gehaald, marge ≥ 10% | 10,0 |

Toelichting: dit is de enige dimensie die niet continu is. Een deal die financieel niet haalbaar is, is niet haalbaar — daar zit geen grijsgebied. De marge van 10% op de bovenste twee treden voorkomt dat een deal die met €50 marge net past dezelfde score krijgt als een deal met €30.000 ruimte.

"Marge" = min(equityAvailable − equityRequired, maxRenovationBudget − renovationCost) / equityRequired. Waar een van beide inputs ontbreekt, wordt die toets overgeslagen en geldt de andere.

### 2.5 Datazekerheid

Invoer: aantal PLACEHOLDER-parameters in placeholdersUsed.

| Ankerpunt | Score |
|---|---|
| 0 | 10,0 |
| 3 | 8,0 |
| 6 | 6,0 |
| 10 | 4,0 |
| 15 | 2,0 |
| ≥ 20 | 0,0 |

Toelichting: de curve is bewust omgekeerd — meer placeholders, lagere score. Bij de referentiecasus (12 placeholders) komt dit uit op 3,6. Dat is laag, en dat is de bedoeling: het model werkt met prop data en de score zegt dat.

Zodra de klant de kadastrale waarde invult en echte huurreferenties beschikbaar zijn, daalt het aantal placeholders en stijgt de score. De dimensie beloont dus betere data zonder dat de klant hoeft te begrijpen wat een placeholder is.

## 3. Weging

| Dimensie | Gewicht | Waarom |
|---|---|---|
| Cashflow | 0,20 | Belangrijk maar niet allesbepalend — zie referentiecasus |
| Schuldbestendigheid | 0,15 | Afgeleid van cashflow, maar meet iets anders (buffer) |
| Rendement | 0,30 | Dit is uiteindelijk waarom de belegger koopt |
| Haalbaarheid | 0,20 | Een deal die niet kan, kan niet — zwaar genoeg om de totaal te drukken |
| Datazekerheid | 0,15 | Niet de deal zelf maar de betrouwbaarheid van het oordeel |

Totaal: 1,00.

De weging is een startpunt. Ze is niet gepubliceerd in het rapport (zie UI_SPEC §5) en kan worden bijgesteld op basis van kalibratie tegen echte deals. Vastleggen wanneer en waarom een wijziging plaatsvindt.

**Totaalscore** = Σ (dimensiescore × gewicht), afgerond op één decimaal.

## 4. Referentiecasus

Avenida Primado Reig 19, basisscenario, met de huidige engine-uitkomsten:

| Dimensie | Invoer | Score |
|---|---|---|
| Cashflow | −€ 236/maand | 2,1 |
| Schuldbestendigheid | DSCR 0,87 | 3,7 |
| Rendement | IRR 5,84% − 4% eis = +1,84% | 6,8 |
| Haalbaarheid | EV tekort (197.990 vs 115.000) | 3,0 |
| Datazekerheid | 12 placeholders | 3,2 |

**Totaalscore** = 0,20×2,1 + 0,15×3,7 + 0,30×6,8 + 0,20×3,0 + 0,15×3,2 = 0,42 + 0,555 + 2,04 + 0,60 + 0,48 = **4,1**

Dat is een zwak-voldoende: het rendement is er, maar de deal is niet haalbaar met het beschikbare eigen vermogen, de cashflow is negatief, en een derde van de berekening rust op onbevestigde aannames. Dat is precies wat de score moet zeggen.

> **Voetnoot:** de cashflow- en datazekerheidsscore hierboven zijn herrekend via de curves in §2, die leidend zijn — de eerder gepubliceerde versie van deze tabel gaf 3,1 en 3,6 (totaal 4,4), wat niet uit §2 volgde. Verder zijn dit de waarden ten tijde van het schrijven van deze spec, vóór de correctie in MODEL_SPEC.md §15 die gastos de comunidad als verplichte, niet-standaard last toevoegde. Sindsdien liggen de engine-uitkomsten voor deze referentiecasus lager (−€ 311/maand, DSCR 0,832, IRR +1,54% surplus, 13 placeholders); de live testuitkomst komt daarmee op een totaalscore van 3,8, niet 4,1. Zie `lib/rules/es/__tests__/score.test.ts`.

## 5. Percentiel

### Referentieverdeling

Genereer bij de eerste build een synthetische set van 1.000 casussen:

- Aankoopprijzen: € 80.000 tot € 600.000, uniform verdeeld in stappen van € 20.000
- Oppervlaktes: 30 tot 200 m², uniform
- Wijken: alle wijken uit de huurtabel, gelijk verdeeld
- Financieringsstrategieën: alle drie, gelijk verdeeld
- Renovatiestrategieën: alle drie, gelijk verdeeld
- Huurstrategie: langetermijn (70%) en hybride (30%)
- Eigen vermogen: 80% tot 120% van equityRequired, uniform
- Overige invoer: de defaults uit parameters.ts

Reken elke casus door en bewaar alleen de totaalscore. Sorteer de 1.000 scores en sla de verdeling op als een gesorteerde array.

**Percentiel** = het percentage casussen in de referentieverdeling met een lagere totaalscore. Bij de referentiecasus (4,4): als 320 van de 1.000 casussen lager scoren, is het percentiel 32.

### Presentatie

In het rapport: "Deze investering scoort in het 32ste percentiel van ons modelbereik." Geen interpretatie eraan koppelen — het getal spreekt voor zich.

### Verversing

De referentieverdeling wordt opnieuw gegenereerd wanneer:

- parameters in parameters.ts veranderen (bronupdate, herclassificatie)
- de scoringscurves of de weging worden bijgesteld
- de crawl voldoende echte casussen heeft om de synthetische set te vervangen

Leg het tijdstip van generatie vast in de verdeling zelf.

## 6. Implementatie

`/lib/score.ts` — piecewiseLinear(), dimensiescores, totalScore(). `/lib/percentile.ts` — laden en doorzoeken van de referentieverdeling. `/lib/distribution/generate.ts` — generatie van de synthetische set (eenmalig, uitkomst opslaan als JSON).

Geen externe afhankelijkheden. De scoring is deterministisch: dezelfde invoer geeft altijd dezelfde score, ongeacht wanneer of hoe vaak je hem draait.

## 7. Wat de score niet doet

- Geen voorspelling. De score beoordeelt de huidige configuratie, niet de toekomst.
- Geen vergelijking met de markt. Het percentiel vergelijkt met het modelbereik, niet met werkelijke transacties (totdat de crawl dat vervangt).
- Geen advies. Een score van 8 is geen koopadvies. Een score van 3 is geen verkoopadvies.

Dit moet letterlijk in het rapport staan, niet in de kleine letters.

---

## 8. Indicatieve score (gratis indicatie)

Aanvulling, vastgesteld nadat de free-tier band (zie FREE_TIER_BAND_* in parameters.ts) gereed was. Dit is een eigen, kleinere functie — geen uitgeklede computeTsgScore(). Zonder beleggersinvoer bestaan DSCR, IRR en de eigen-vermogentoets niet; drie van de vijf dimensies uit §2 vallen dus weg.

### 8.1 Twee dimensies, niet vijf

| Dimensie | Basis |
|---|---|
| Cashflow-indicatie | Middelpunt van de free-tier band |
| Datazekerheid | Aantal PLACEHOLDER-parameters in de band-berekening |

Rendement, schuldbestendigheid en haalbaarheid ontbreken. Dat wordt niet gecompenseerd door de resterende twee zwaarder te wegen — een indicatie met twee dimensies claimt niet hetzelfde te meten als de volledige score met vijf, alleen lichter. Zie §8.3.

### 8.2 Grove schaal, bewust anders dan §2

Geen 0–10 getal. Drie labels: **Laag / Gemiddeld / Hoog**, zodat niemand een indicatiescore naast een betaalde TSG-score legt en ze als vergelijkbare getallen leest.

**Cashflow-indicatie — omzetting vanuit §2.1-ankerpunten.**

Bereken eerst de onderliggende 0–10 score op het middelpunt van de band (`(unfavourable + favourable) / 2`), met exact dezelfde piecewiseLinear-curve als §2.1. Zet die vervolgens om:

| §2.1-score | Label |
|---|---|
| 0,0 – 3,9 | Laag |
| 4,0 – 6,9 | Gemiddeld |
| 7,0 – 10,0 | Hoog |

De drempel bij 4,0 sluit aan op §2.1 zelf: een cashflow van € 0 (break-even) geeft daar al een 4,0, dus "Gemiddeld" begint bij break-even, niet eronder. Dat is inhoudelijk consistent met hoe de volledige score break-even leest.

**Datazekerheid — omzetting vanuit §2.5-ankerpunten**, dezelfde drempels toegepast op de onderliggende 0–10 score.

De onderliggende getallen worden nergens getoond — alleen gebruikt om het label te bepalen. Dit voorkomt dat iemand "6,4" ziet, het onthoudt, en het later naast een betaalde score van "6,4" legt alsof het dezelfde meting is.

> **Randgeval bij de 4,0-drempel.** De omzetting gradeert de afgeronde score (§1: één decimaal), want de tabel hierboven is over één-decimaalwaarden geschreven. Gevolg: "Gemiddeld" houdt ook enkele euro's onder break-even stand. Op het §2.1-segment van −€ 250 (2,0) naar € 0 (4,0) rondt een ruwe score pas bij −€ 6,25 naar 3,9 af; dáár begint Laag feitelijk. Het alternatief — graderen op de ruwe interpolatie — legt de grens exact op € 0, maar wijkt dan af van de één-decimaalbanden in deze tabel én van de afgeronde dimensiescore die het betaalde rapport voor hetzelfde pand publiceert.

### 8.3 Verplichte disclosure

De indicatieve score krijgt een zesde sleutel naast de vijf uit §free-tier band (zie `FreeTierDisclosureKey`): `indicativeScoreScope`. Tekst (copy-laag, niet in de rekenlaag):

> Deze indicatie is gebaseerd op twee van de vijf factoren die het volledige rapport beoordeelt. Rendement, schuldbestendigheid en haalbaarheid worden pas berekend zodra u uw financieringsgegevens invult.

Deze sleutel is onvoorwaardelijk aanwezig zodra er een indicatieve score wordt getoond — geen uitzondering, net als de andere vijf.

### 8.4 Referentiecasus

Ruzafa, € 350.000, 90 m² (dezelfde als de band-golden-test): band € 350 – € 831/maand, middelpunt € 590,24.

**Cashflow-indicatie:** op het middelpunt ligt de §2.1-curve tussen € 500 (7,5) en € 1.000 (9,0) → interpolatie geeft 7,8 → label **Hoog**.

**Datazekerheid:** 12 placeholders → 3,2 → label **Laag**.

Die twaalf zijn de `placeholdersUsed` van het band-resultaat: zes die voor beide uiteinden gelden (huurmarge, bruikbaar/gebouwd-ratio, kadastrale ratio, langetermijnbezetting, onderhoudstarief, bankkosten) plus drie renovatiemultipliers per tier, voor beide tiers.

De unie van beide tiers, niet één tier, is het punt. De band spant `minimal` tegen `heavy` op; het middelpunt van die band heeft geen eigen renovatietier, dus er is geen enkele tier die je zou kunnen aanwijzen als "de" aanname waar dit getal op rust. Beide zijn gebruikt om het te produceren, dus beide tellen. Vandaar twaalf en niet vijf: capex en doorlooptijd tellen niet mee (die raken een maandcashflow vóór financiering niet), maar de zes multipliers wél.

> **Voetnoot:** een eerdere versie van deze paragraaf verwachtte "Gemiddeld" op basis van een opsomming van vijf parameters, die de bankkosten en alle zes renovatiemultipliers oversloeg. Vijf placeholders zou 6,7 geven en dus Gemiddeld; de werkelijke twaalf geven 3,2 en dus Laag. Bevestigd tegen de code bij implementatie — zie `lib/rules/es/__tests__/free-tier-indicative-score.test.ts`.

### 8.5 Implementatie

`/lib/rules/es/free-tier/indicative-score.ts` — leest een `FreeTierBand`-resultaat, retourneert `{ cashflowLabel, dataConfidenceLabel }` plus de disclosure-sleutel. Hergebruikt de §2.1- en §2.5-curves en -ankerpunten uit score.ts; alleen de omzetting naar labels is nieuw.

De twee drempelwaarden uit §8.2 (4,0 en 7,0) staan als één ESTIMATE-parameter in parameters.ts (`FREE_TIER_INDICATIVE_LABEL_THRESHOLDS`), niet inline in de rekenlaag — CLAUDE.md §6 laat geen hardgecodeerde getallen toe, ook niet als ze verder nergens vandaan komen. Ze zijn een productdefinitie (waar TSG de grens tussen de labels legt), wat precies is waar ESTIMATE voor bedoeld is.

De labels zelf zijn Engels in de rekenlaag (`"low" | "medium" | "high"`); de Nederlandse woorden Laag/Gemiddeld/Hoog staan in `lib/copy/es/free-tier-disclosures.ts`, dezelfde splitsing die de disclosure-sleutels gebruiken.
