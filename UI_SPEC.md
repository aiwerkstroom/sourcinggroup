# UI_SPEC — TSG Yield Engine

Productspecificatie voor de interface en het rapport. Vastgesteld door Samuel; dit bestand gaat vóór op implementatiegemak.

---

## 1. Uitgangspunten

Volledig self-serve. Geen analist in de loop. Elke uitkomst herleidbaar, elke aanname zichtbaar, en het product benoemt zelf waar het ophoudt.

Toon: nuchter en licht menselijk. Cijfers voeren het woord, het oordeel is licht. Geen verkooppraat, geen alarm, geen aanbeveling om te kopen. De geloofwaardigheid komt uit terughoudendheid.

Taal: Nederlands. Interface, rapport en communicatie.

Visuele richting: donker, dicht, functioneel. Data eerst. Grotesk of monospace voor cijfers. Strakke tabellen. Kleur uitsluitend als signaal (drempel gehaald / niet gehaald). Bandbreedtes in plaats van schijnprecisie: € 1.240 – € 1.480, niet € 1.362,47. Geen enkele superlatief.

Referenties: Palantir (interface), McKinsey (analytische opbouw), Upfront (toon).

## 2. Twee niveaus

**Gratis indicatie.** Geen account vereist. Draait op eerste-ordegegevens. Geeft een bandbreedte en een indicatieve score, geen oordeel. Zegt zelf dat het indicatief is. Doel: laten zien dat het klopt.

**Betaald rapport — € 49.** Account vereist. Vereist de volledige tweede-ordegegevens en weigert zonder. Rapport blijft één week toegankelijk in het account, plus PDF-download. Na een week vervalt de toegang; de PDF blijft bij de klant.

## 3. Invoer

### Eerste orde — gratis indicatie

postcode of wijk · vraagprijs · woonoppervlak (gebouwd) · pandtype · aantal eenheden

### Tweede orde — vereist voor het betaalde rapport

volledig adres · bruikbaar én gebouwd oppervlak (apart) · indeling (kamers, slaapkamers, badkamers) · bouwjaar · energielabel · staat van onderhoud · huidige huurstatus en werkelijke huidige huur indien verhuurd · gastos de comunidad per jaar · kadastrale waarde (van het IBI-aanslagbiljet) · título habilitante voor toeristische verhuur: ja/nee

### Belegger

beschikbaar eigen vermogen · gewenste LTV · renovatiebudget · verhuurstrategie · houdperiode · minimale maandcashflow · minimale ROI

### Drie velden die bijzondere aandacht verdienen in de interface

**Gastos de comunidad** — verplicht, geen default. Toelichting: "Dit bedrag staat in de advertentie of is bij de verkoper op te vragen."

**Kadastrale waarde** — optioneel. Waar ingevuld, verbetert het de IBI-berekening en de afschrijvingsgrondslag. Waar niet ingevuld, meldt het rapport dat het met een benadering werkt. Toelichting: "Te vinden op het IBI-aanslagbiljet (recibo del IBI)."

**Bruikbaar versus gebouwd oppervlak** — toelichting: "Spaanse advertenties vermelden doorgaans m² construidos. Uw huurschatting wordt nauwkeuriger als u ook het bruikbaar oppervlak invult."

## 4. De vergunningspoort

Kortetermijnverhuur is in Valencia sinds 31 maart 2026 vergunningsplichtig onder een systeem van verzadigingslimieten per wijk. Zonder geldig título habilitante verdwijnen het ST- en het hybridescenario volledig uit het rapport — ze verschijnen niet als nul, ze verschijnen niet. Het rapport legt uit waarom die scenario's ontbreken.

## 5. TSG-score

### Vijf dimensies, elk 0–10

| Dimensie | Gebaseerd op | Meet |
|---|---|---|
| Cashflow | Maandcashflow basisscenario | Kan de belegger het dragen? |
| Schuldbestendigheid | DSCR basisscenario | Houdt het stand bij tegenwind? |
| Rendement | IRR basisscenario vs. rendementseis | Wordt het risico beloond? |
| Haalbaarheid | Eigen-vermogentoets + budgettoets | Kan deze deal überhaupt? |
| Datazekerheid | Aantal PLACEHOLDER-parameters | Hoe stevig staan de cijfers? |

### Totaalscore

Gewogen gemiddelde van de vijf dimensies. De weging is een interne modelkeuze en wordt niet gepubliceerd. De methodiek wordt in het rapport in hoofdlijnen toegelicht: welke dimensies worden meegenomen, wat ze meten, en dat de totaalscore een gewogen gemiddelde is. De exacte gewichten worden niet gedeeld.

### Percentiel

De score wordt afgezet tegen een referentieverdeling. Bij launch is die verdeling synthetisch: duizend doorrekeningen over de parameter-ranges van het model (prijzen, oppervlaktes, wijken, strategiecombinaties). Het rapport zegt: "vergeleken met het bereik van ons model", niet "vergeleken met de markt."

Zodra de crawl draait en echte panden worden gescoord, verschuift de referentie naar werkelijke data. De methodiek verandert dan niet, alleen de verdeling.

### Waar de score verschijnt

- In de gratis indicatie: indicatieve score, geen dimensie-uitsplitsing.
- In het betaalde rapport: volledige uitsplitsing per dimensie met toelichting.
- In de crawl-resultaten: score per gevonden object, als rangordemechanisme.

## 6. Rapportopbouw

In deze volgorde:

1. **TSG-score** — de vijf dimensies visueel, de totaalscore, het percentiel.
2. **Uitkomst in één regel** — het lichte oordeel, met de drie kerncijfers van het basisscenario: maandcashflow, DSCR, IRR.
3. **De drie scenario's naast elkaar** — conservatief, basis, optimistisch.
4. **Opbouw van de cashflow** — van bruto huur naar netto, elke post zichtbaar.
5. **De tienjarige reeks** — met jaar 5 gemarkeerd, geëxtrapoleerde jaren aangeduid.
6. **Exit** — verkoopwaarde, kosten, belasting, restschuld, netto opbrengst.
7. **Toetsing aan de eigen randvoorwaarden** — gehaald of niet, per drempel.
8. **Aannames en bronnen** — elke parameter met herkomst (SOURCED/ESTIMATE/PLACEHOLDER) en datum.
9. **Wat niet geverifieerd is** — expliciete lijst. Dit is geen disclaimer maar een inhoudelijk hoofdstuk dat de geloofwaardigheid van de score draagt.

## 7. Negatief oordeel

De referentiecasus is een afwijzing, en dat zal vaak zo zijn. Het rapport presenteert dat als bevinding: de cijfers voorop, het oordeel licht en menselijk erbij. Geen rode vlakken, geen uitroeptekens, geen suggestie dat de klant iets fout heeft gedaan.

De score is bij een afwijzing laag, niet afwezig. Een pand met een lage cashflowscore maar een hoge rendementsscore (IRR via de exit) is een ander verhaal dan een pand dat op alles laag scoort. Het rapport laat dat zien zonder het te interpreteren.

## 8. Betaling

Per rapport: € 49, via Stripe Payment Element — ingebed op een eigen betaalpagina tussen de wizard en het rapport, niet op een extern Stripe-domein. Per rapport afgerekend; geen tegoeden.

De volgorde ligt vast: de vier wizard-stappen, dan de betaling, en pas na een geslaagde betaling de doorrekening. De invoer wordt tussen die twee momenten kortlevend serverzijdig vastgehouden — nooit in een URL, nooit in browseropslag, en niet permanent opgeslagen. Of er betaald is, bepaalt de server aan de hand van de betaalstatus bij Stripe; niet de melding van de browser.

Validatie gaat vóór de betaling uit: invoer die niet doorrekenbaar is, bereikt de betaalpagina niet. Niemand betaalt voor een rapport dat daarna niet berekend kan worden.

Per crawl-resultaat: per gevonden object. De klant ziet een lijst met scores en basiscijfers; betaalt per object dat hij volledig wil bekijken. Prijs per object nog vast te stellen.

## 9. Account en bewaring

Gratis indicatie: geen account, geen opslag.

Betaald rapport: account vereist (Supabase Auth). Rapport een week toegankelijk in het account plus PDF-download. Na een week vervalt de online toegang.

## 10. Crawl — interface

De klant specificeert zoekcriteria (regio, prijsrange, minimale score, type, strategie). De resultaten verschijnen als een gescoorde lijst. Basisgegevens en de TSG-score zijn zichtbaar; het volledige rapport per object is betaald.

De crawl is pas beschikbaar nadat de voorwaarden uit CLAUDE.md §5 zijn vervuld: officiele bron, juridische toets, en een afgeleid scoremodel.

## 11. Afhankelijkheden in de engine

- ☑ Gastos de comunidad als vaste last
- ☑ Kadastrale waarde als optionele invoer
- ☑ Bruikbaar/gebouwd oppervlak gescheiden
- ☑ Vergunningspoort titulo habilitante
- ☑ Exit en IRR
- ☑ Herkomstaudit (SOURCED/ESTIMATE/PLACEHOLDER) met placeholdersUsed
- ☐ Scoremodel: dimensiescoring, weging, totaalscore
- ☐ Synthetische referentieverdeling voor het percentiel
- ☐ Crawl-scoremodel (afgeleid, op listing-velden)
