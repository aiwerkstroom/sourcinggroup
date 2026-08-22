# SOURCING_SPEC — pijler 2: panden zoeken en alerts

Vastgesteld op basis van interviewrondes met Samuel. Dit document is autoritatief
voor het sourcing-onderdeel (pijler 2). Het bouwt voort op de bestaande rekenlaag,
wizard en betaalflow — die blijven ongewijzigd; sourcing voegt een pad ervoor toe.

Kernprincipe, juridisch geborgd: TSG toont panden die aan de door de klant opgegeven
criteria voldoen. Het rangschikt niet op aantrekkelijkheid en beveelt niets aan. De
taal is overal "voldoet aan uw criteria", nooit "aanbevolen" of "beste keuze". Dit
houdt de positie "geen bemiddeling, geen advies" overeind (zie COMPLIANCE_CHECKLIST
§3).

---

## 1. Databron — vervangbare interface

De data komt in v1 van een derde-partij-scraper (Apify/RapidAPI-klasse, ~$0,50/1000
resultaten). Dit is bewust gekozen voor snelheid, met het risico dat het Idealista's
voorwaarden schendt (juridisch grijs, anti-bot-maatregelen). De mitigatie is
architectonisch:

**Alle brontoegang loopt via één dunne interface** — `lib/sourcing/source/`, met een
functiecontract dat niets weet van wélke bron eronder zit:

```
searchListings(criteria: SearchCriteria): Promise<Listing[]>
getListingDetail(sourceId: string): Promise<ListingDetail | null>
```

- v1 achter deze interface: een scraper-adapter. In de sandbox onbereikbaar (net als
  Stripe/Supabase), dus mock-first — een `source-mock.ts` met realistische testdata
  (echte Valenciaanse wijken, plausibele prijzen/oppervlakken), dezelfde
  async-signaturen als de echte adapter, zodat de swap één bestand is.
- Later schoon te wisselen naar de officiële Idealista-partner-API of een andere bron
  zonder dat de rest van sourcing verandert.

`Listing` is een bron-neutraal type — de adapter vertaalt het bronformaat ernaartoe,
zodat geen enkele bron-eigenaardigheid in de rest van de code lekt. Minimaal:
`sourceId`, `neighborhood`, `priceEUR`, `builtAreaM2`, `propertyType`, `sourceUrl`,
`title`, plus optioneel `usableAreaM2`, `photoUrls`, `listedDate`.

## 2. Zoekcriteria

Grover dan de wizard — bij het zoeken weet de klant de doorreken-details (vermogen,
financiering, exit) nog niet. Vier filters:

| Criterium | Vorm |
|---|---|
| Locatie | Wijk-dropdown (dezelfde 13 als de wizard) of bredere regio |
| Prijsrange | Min–max in euro's |
| Pandtype | Dezelfde typen als de wizard |
| Yield-drempel | Minimaal bruto aanvangsrendement (%), als zeef |

**De yield-drempel is een filter, geen rangschikking.** De klant stelt de grens; het
systeem toont wat eraan voldoet. Dit is neutrale informatievoorziening — het is niet
TSG die zegt "dit pand is goed", het is de klant die zegt "toon alleen wat mijn grens
haalt". Deze scheiding is juridisch wezenlijk (zie §Kernprincipe) en moet in de UI-
taal zichtbaar blijven.

**Yield-berekening voor de zeef.** Het zoeken heeft geen wizard-invoer, dus de
volledige `runEngine()` kan hier niet draaien. Gebruik een vereenvoudigd brutoyield
op basis van wat de listing en de wijktabel wél geven — analoog aan hoe de gratis-
indicatieband al een eigen vereenvoudigd rekenpad heeft (nooit `runEngine()` met
verzonnen invoer). Ontwerp dit rekenpad expliciet en leg het aan Samuel voor voordat
je het bouwt — het is een nieuwe metric die de klant als grens gebruikt, dus de
herkomst en de aannames moeten net zo zuiver zijn als in de rest van het model. Dit
is een aparte ontwerpstap, geen uitvoeringsdetail.

## 3. Toegang — account vereist

Zoeken vereist een account (anders dan de gratis indicatie, die anoniem is). Reden:
de alerts hebben sowieso een account nodig (opgeslagen criteria per gebruiker), en
één toegangsmodel voor heel pijler 2 is eenvoudiger dan anoniem-zoeken plus
account-alerts. Zoeken zelf blijft gratis — de betaalde waarde zit in het rapport per
pand.

Dit betekent: de zoekroutes zijn beschermd door dezelfde middleware als `/rapport/*`.

## 4. Flow — van gevonden pand naar rapport

1. Klant logt in, gaat naar de zoekpagina
2. Vult de vier criteria in, krijgt een lijst panden die eraan voldoen (neutraal, geen
   rangschikking — eventueel een neutrale sorteervolgorde zoals prijs of datum, nooit
   "beste match")
3. Klant kiest **één** pand
4. Dat pand stroomt de bestaande wizard in — de bekende velden worden voorgevuld
   (wijk, prijs, oppervlak uit de listing). Pandtype is met datakwaliteitsfix stap 6
   uit de wizard verwijderd en wordt dus niet meer voorgevuld, ook al draagt de
   listing dat veld nog wel (zoekpagina-filter, zie §2 hierboven).
5. Klant vult de resterende wizard-stappen aan (vermogen, financiering, exit)
6. Vanaf daar de bestaande betaalflow: €49 → rapport

**Belangrijke herkomst-consequentie, expliciet vastleggen:** de voorgevulde velden
uit een listing zijn brongegevens, geen door de klant geverifieerde invoer. Een
scraper-prijs kan verouderd of onnauwkeurig zijn. De voorgevulde velden moeten dus:
- bewerkbaar zijn (de klant kan corrigeren)
- een zichtbare herkomstmarkering dragen in het rapport, analoog aan de bestaande
  `rentInputProvenance` — een nieuwe provenance-status "uit listing overgenomen" die
  laat zien dat deze waarde van de bron kwam, niet door de klant is bevestigd, tenzij
  de klant hem heeft aangepast

Dit is dezelfde discipline als bij de huurwaarde-override: een waarde die de uitkomst
draagt maar niet door de klant is geverifieerd, moet zichtbaar zijn als zodanig.
Ontwerp deze provenance-uitbreiding en leg hem voor voordat je hem bouwt.

## 5. Alerts — in-app, opslag-afhankelijk (fase 2 van sourcing)

Alerts bereiken de klant alleen in-app: als hij inlogt, ziet hij nieuwe panden die aan
zijn opgeslagen criteria voldoen. Geen e-mail in v1.

Dit vereist opslag (opgeslagen zoekcriteria per gebruiker), wat op de live-omgeving
pas betrouwbaar werkt na fase 4 stap 3 (Supabase). Daarom de bouwvolgorde:

- **Eerst: eenmalig zoeken** (§2–4) — heeft alleen de bron-mock nodig, volledig
  testbaar in de sandbox
- **Daarna: alerts** — opslag-afhankelijk, achter dezelfde swapbare opslag-interface
  als de pending-store van de betaalflow

Alerts zelf: de klant slaat een zoekopdracht op, het systeem draait die periodiek
opnieuw tegen de bron, en toont bij inloggen wat nieuw is sinds de vorige keer. Het
"wat is nieuw" vergt een vergelijking tegen eerder geziene listings — ook opslag.
Ontwerp de alert-mechaniek apart wanneer we bij deze stap zijn; deze spec legt nu
alleen de vorm en de volgorde vast.

## 6. Wat sourcing NIET doet

- Niet rangschikken op aantrekkelijkheid of "beste match"
- Niet aanbevelen, niet "dit pand is een goede investering" zeggen
- Niet automatisch doorrekenen — de klant kiest bewust één pand en doorloopt de wizard
- Geen contact leggen met verkopers/makelaars namens de klant (dat zou bemiddeling
  zijn)
- Geen e-mail-alerts in v1

## 7. Bouwvolgorde (samenvattend)

1. Bron-interface + `source-mock.ts` met realistische testdata
2. Vereenvoudigd yield-rekenpad voor de zeef — **ontwerp eerst voorleggen**
3. Zoekpagina (achter auth): criteria-invoer, resultatenlijst (neutraal)
4. Listing → wizard-voorvulling + provenance-uitbreiding — **ontwerp eerst voorleggen**
5. (later, na Supabase) opgeslagen zoekopdrachten + in-app alerts

Elke stap eigen golden test, stop na elke stap voor review. De twee "ontwerp eerst
voorleggen"-punten gaan via de AskUser-tool naar Samuel voordat er code komt.

## 8. Mock-first, net als Stripe/Supabase

De bron is in de sandbox onbereikbaar. Alles bouwt tegen `source-mock.ts` met
realistische data en echte-adapter-signaturen. De echte scraper-adapter sluit je aan
op de live-omgeving, als één-bestand-swap, samen met de andere live-diensten. De
bundle-sweep-discipline geldt ook hier: brongegevens en eventuele API-sleutels blijven
server-side, nooit in de client-bundle.
