# HOMEPAGE_UPGRADE_SPEC — UI-opwaardering, Linear/Mercury-richting

Vastgesteld op basis van interviewrondes met Samuel, 18 augustus 2026. Bouwt op
LANDING_SPEC.md en DESIGN_SPEC.md — geen nieuwe kleuren, geen nieuwe
typografie-schaal. Dit voegt gerichte, functionele interactiviteit en subtiele
micro-animatie toe aan de bestaande vijf secties.

Referenties: Linear.app, Mercury.com — sober, precisie, interactiviteit die iets
dóét (hover-detail, live herberekening, inklappen) in plaats van decoratie.
MotionSites.ai-stijl (3D-hero's, zwevende animaties, spektakel) is expliciet
afgewezen — te ver van de Palantir/McKinsey-richting die dit hele project draagt.

---

## 1. Algemene regels, gelden voor alle secties

- **`prefers-reduced-motion: reduce` wordt gerespecteerd.** Alle animaties
  (fade-ins, hover-transities) vervallen naar direct-zichtbaar/geen transitie
  voor bezoekers die dat systeeminstelling hebben. Bouw dit vanaf het begin in
  een gedeelde utility, niet per component los.
- **Animatieduur kort en subtiel**: 150–300ms, geen bounce/spring-easing. Dit
  sluit aan bij de bestaande `transition-colors duration-150` uit DESIGN_SPEC.
- **Focus-states en toegankelijkheid blijven ongewijzigd** — WCAG AA-discipline
  uit DESIGN_SPEC §6 geldt onverkort. Animatie mag focus-ringen nooit vertragen
  of verbergen.
- **Geen nieuwe afhankelijkheden tenzij noodzakelijk.** Scroll-fade-ins en
  hover-states zijn met CSS/Intersection Observer te bouwen zonder een
  animatiebibliotheek. Alleen als de interactieve rekentool dat vereist, mag
  een kleine, gerichte toevoeging overwogen worden — bespreek dat expliciet
  voordat je een package toevoegt.

## 2. Sectie 1 — Hero

- Fade-in bij laden (niet scroll-gebonden — dit is het eerste zichtbare
  element). Korte duur, geen vertraging die het gevoel van traagheid geeft.
- Geen wijziging aan tekst of structuur.

## 3. Sectie 2 — "Hoe het werkt"

- Scroll-fade-in via Intersection Observer: de sectie wordt zichtbaar zodra
  hij het beeld in scrollt.
- De drie kaarten verschijnen met een lichte onderlinge vertraging (stagger),
  bijvoorbeeld 80–100ms tussen elke kaart — niet alle drie tegelijk.
- Subtiele hover-state per kaart: randkleur-verschuiving naar het accent, geen
  schaal- of verplaatsingseffect (blijft binnen DESIGN_SPEC §5's bestaande
  hover-taal).

## 4. Sectie 3 — Voorbeeldsectie: interactieve mini-rekentool

Dit is de kern van de opwaardering en vereist dezelfde architecturale
discipline als de zeef-yield in sourcing.

### 4.1 Wat de klant ziet

Twee tot drie aanpasbare velden naast de bestaande `ScoreRuler`-illustratie:

- **Prijs** (numeriek invoerveld of slider, met een redelijke bandbreedte,
  bijvoorbeeld €150.000–€600.000)
- **Huur** (numeriek invoerveld of slider, bijvoorbeeld €500–€2.500/maand)
- **Wijk** (optioneel, dropdown met een paar fictieve wijknamen — NIET de
  echte 13 wijken uit de wizard, om verwarring met echte data te voorkomen)

Bij elke aanpassing herberekent een lokale, eigen formule de fictieve score en
cashflow, en de `ExampleScoreRuler` (het bestaande losstaande component uit
LANDING_SPEC stap 2) update live.

### 4.2 De formule — eigen, geïsoleerd, nooit de echte rekenlaag

**Harde eis, niet onderhandelbaar:** deze rekentool importeert niets uit
`lib/rules/es`. Geen `runEngine()`, geen `TSG_SCORE_DIMENSION_WEIGHTS`, geen
echte ankerpunten. Dit is dezelfde discipline die al gold voor
`example-score-ruler.tsx` (LANDING_SPEC §5) en `sieve-yield.ts` (SOURCING_SPEC
§2) — en om dezelfde reden: UI_SPEC §5 publiceert de exacte scoremethodiek
nooit, en een interactieve tool die van dichtbij naar de echte curve kijkt zou
die kunnen laten afleiden.

Ontwerp een eigen, simpele formule specifiek voor deze illustratie — een
grove, plausibele relatie tussen prijs/huur en een fictieve score-uitkomst.
Dit is een nieuw stuk rekenwerk, dus:

- **Leg het ontwerp van deze formule eerst voor** (net als bij de zeef-yield
  en de listing-provenance) — dit is geen uitvoeringsdetail, het raakt hoe de
  klant het product voor het eerst "voelt" werken.
- De formule mag losjes op de bestaande §2-ankerpunten uit SCORE_SPEC lijken
  qua vorm (bijvoorbeeld: hogere huur-tot-prijs-verhouding → hogere score),
  maar de concrete getallen/drempels moeten anders zijn dan de echte curve.
- Voeg een collision-check toe naar het patroon van de bestaande
  bundle-sweep (LANDING_SPEC stap 3): controleer dat de gekozen
  voorbeeldwaarden niet toevallig samenvallen met echte parameters of
  bestaande mock-listings.

### 4.3 Labeling — sterker dan voorheen

Het fictief-label wordt prominenter nu de sectie interactief is — een
bezoeker die zelf cijfers intypt en een score ziet veranderen, moet nog
duidelijker begrijpen dat dit geen echte berekening is. Voorstel:

> "Interactief voorbeeld — pas de cijfers aan en zie het effect. Dit is geen
> echt pand en geen echte berekening."

Blijft zichtbaar, niet alleen bij het laden maar ook tijdens interactie
(bijvoorbeeld als vaste kop boven de tool, niet iets dat verdwijnt zodra de
klant begint te typen).

### 4.4 Technisch

- Client component (de enige sectie op de homepage die dat nodig heeft — de
  rest blijft server-rendered).
- State lokaal in React, geen server-aanroep nodig — de formule draait
  volledig in de browser.
- Debounce op de input (bijvoorbeeld 150ms) zodat de score niet bij elke
  toetsaanslag herberekent, voor een rustige, "Mercury-achtige" precisie in
  plaats van een nerveus updaterende UI.
- Scroll-fade-in bij binnenkomst van de sectie, zoals sectie 2.
- Golden test: verifieer dat de tool met verschillende invoer andere scores
  toont, dat de disclosure-tekst permanent zichtbaar blijft, en de
  bundle-sweep bevestigt geen import uit `lib/rules/es`.

## 5. Sectie 4 — FAQ, uitklapbaar

- Elke vraag wordt een uitklapbaar item (accordion), standaard dicht.
- Client component nodig (interactieve staat), geïsoleerd net als elders in
  het project (vergelijkbaar met hoe andere routes hun eigen kleine
  client-subcomponenten hebben).
- Subtiele hoogte-transitie bij open/dicht, kort (150-200ms), geen bounce.
- Focus- en toetsenbordbediening: elke vraag bedienbaar met Enter/Space,
  focus-ring zichtbaar (WCAG-discipline blijft gelden op een nieuw
  interactief element).
- Eén open tegelijk, of meerdere tegelijk open toegestaan — vrij te kiezen
  bij bouw, geen harde eis vanuit deze spec.

## 6. Sectie 5 — Sluitings-CTA

- Scroll-fade-in.
- Verder ongewijzigd: subtiel, één knop, geen versiering.

## 7. Bouwvolgorde

1. Gedeelde `prefers-reduced-motion`-utility en scroll-fade-in-mechanisme
   (Intersection Observer hook), toegepast op secties 1, 2, 5 eerst — dit is
   het minst risicovolle deel en zet de basis-infrastructuur neer.
2. FAQ-accordion.
3. **Stop hier voor het formule-ontwerp van sectie 3** (§4.2) — dit gaat via
   Samuel voordat er code komt, net als de eerdere "ontwerp eerst
   voorleggen"-punten in dit project.
4. Na goedkeuring: de interactieve rekentool bouwen, inclusief de golden test
   en de bundle-sweep-uitbreiding.

Golden-render-tests van bestaande secties blijven ongewijzigd draaien — als
een test faalt door een structuurwijziging (bijvoorbeeld door de
FAQ-accordion), is dat de test die te specifiek was, corrigeer volgens het
patroon dat al eerder in dit project is gebruikt.
