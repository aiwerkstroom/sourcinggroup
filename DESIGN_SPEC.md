# DESIGN_SPEC — visuele richtlijn TSG

Vastgelegd op basis van vier interviewrondes met Samuel. Deze spec is autoritatief
voor alle visuele beslissingen in fase 2 (UI). Waar UI_SPEC §1 richting geeft
(referenties, taal), maakt dit document het concreet.

Referenties: McKinsey-rapportages (helder, ruim, ingetogen), Palantir Foundry
(dichtheid en precisie waar nodig), Upfront (nuchtere toon).

---

## 1. Palet en thema

**Licht thema als hoofdthema.** Vervangt de huidige donkere globals.css volledig,
niet uitgebreid.

**Achtergrond en oppervlakken.**
- Pagina-achtergrond: warm wit (bijvoorbeeld `#FAFAF9` of `#F8F8F7`) — niet zuiver
  wit, iets zachter voor lange leessessies
- Kaartachtergrond: zuiver wit (`#FFFFFF`), scheidt de kaart van de pagina
- Tekst primair: bijna zwart (`#111827` of vergelijkbaar), niet zuiver zwart
- Tekst secundair: middengrijs (`#6B7280`) voor labels en metadata
- Tekst subtiel: lichtgrijs (`#9CA3AF`) voor voetnoten en de-emphasis
- Randlijnen: zeer licht (`#E5E7EB`) voor rüinstrepen tussen tabelrijen

**Accentkleur: donkerblauw.**
- Primair accent: donkerblauw (bijvoorbeeld `#1E3A8A` of `#1D4ED8`) — voor links,
  primaire knoppen, tabelheader-onderlijnen, hover-onderlijnen
- Alleen deze ene accentkleur naast de signaalkleuren; geen extra accenten voor
  categorieën of secties

**Signaalkleuren blijven strikt gereserveerd voor drempels** (§7 van UI_SPEC):
- Groen: drempel gehaald (bestaande waarde uit globals.css behouden)
- Rood: drempel niet gehaald
- Oranje: waarschuwing / tussenniveau

Deze mogen nergens anders gebruikt worden — niet voor accenten, niet voor
categorielabels, niet voor de score-liniaal.

## 2. Typografie

**Familie: Inter, één familie voor de hele interface.**
- Laden via next/font (voorkomt FOUT en houdt de font server-side geoptimaliseerd)
- `font-variant-numeric: tabular-nums` als default op alle tabellen en cijfercellen —
  cijfers moeten uitgelijnd zijn in kolommen

**Hiërarchie — bescheiden, gelijkmatig.**
- H1: 24–28px, semibold (600)
- H2: 20–22px, semibold (600)
- H3: 16–18px, semibold (600)
- Lopende tekst: 15–16px, regular (400)
- Metadata en labels: 13–14px, medium (500)
- Voetnoten: 12–13px, regular (400)

Hiërarchie leunt primair op gewicht en witruimte, niet op grootte. Ruime whitespace
boven H2 en H3 (bijvoorbeeld `mt-8` / `mt-6`) doet het meeste werk in de visuele
scheiding tussen secties.

**Regelhoogte.** Ruim: `leading-relaxed` (1.625) voor lopende tekst,
`leading-normal` (1.5) voor cijfercellen en tabellen.

## 3. Layout en dichtheid

**McKinsey-dichtheid**: ruim opgezet met witruimte, comfortabel om te lezen.

- Contentbreedte: max `max-w-5xl` (ongeveer 1024px), gecentreerd
- Marges: royaal aan de zijkanten (`px-8` op desktop, `px-4` op mobiel)
- Verticale ritmiek: `space-y-8` tussen hoofdsecties, `space-y-4` binnen een sectie
- Kaart-padding: `p-6` als default, `p-8` voor grote hoofdkaarten (zoals de score)

**Kaartstijl.**
- Witte achtergrond op de warm-witte pagina
- Zeer subtiele schaduw: `shadow-sm` (Tailwind), niet meer
- Zeer subtiele randlijn: `border border-gray-100` — de schaduw alleen is niet
  altijd zichtbaar op alle schermen
- Ronding: `rounded-lg` (8px), niet groter — grote afrondingen ogen speels

**Sectie-scheiding binnen de rapportpagina.** Elke van de negen secties in een
eigen kaart. Ruime verticale afstand tussen kaarten (`space-y-8`). Geen scheidings-
lijnen tussen kaarten — de witruimte doet het werk.

## 4. Componentspecifieke stijlen

### Tabellen

Rüinstrepen tussen rijen, geen randen om cellen.
- Header: donkerder tekst (bijna zwart), medium gewicht, accentkleur-onderlijn
  (bijvoorbeeld `border-b-2 border-blue-800`)
- Rijen: onderlijn `border-b border-gray-100` tussen rijen, geen verticale randen
- Getalcellen: rechts uitgelijnd, tabular-nums verplicht
- Padding: `px-4 py-3` per cel — ruim genoeg, niet krap

Geen zebra, geen alternerende achtergronden.

### Knoppen

**Primaire knop (donkerblauw gevuld):**
```
bg-blue-800 text-white hover:bg-blue-900 px-6 py-2.5 rounded-md font-medium
transition-colors
```

**Secundaire knop (wit met blauwe rand):**
```
bg-white text-blue-800 border border-blue-800 hover:bg-blue-50 px-6 py-2.5
rounded-md font-medium transition-colors
```

**Tekstlink:**
```
text-blue-800 hover:underline
```

Hover en focus: subtiel. Kleurverandering + korte transitie (`transition-colors`
op 150ms). Geen schaal-animaties, geen zware schaduwverschuivingen.

**Focus-indicator** (WCAG-eis): duidelijke `ring-2 ring-blue-500 ring-offset-2`
op alle interactieve elementen bij toetsenbord-focus.

### TSG-score dimensies — percentagebalk (Palantir-stijl)

Vervangt de huidige simpele horizontale balken. Per dimensie:
- Een horizontale liniaal van 0 tot 10 (SVG)
- Tick-marks bij de §2-ankerpunten van SCORE_SPEC (bijvoorbeeld voor
  cashflow: 0, 2, 4, 6, 7.5, 9, 10)
- Een marker (verticale streep of kleine driehoek) op de behaalde score
- Kleurloze liniaal en tick-marks (grijstinten), donkerblauwe marker
- Cijfer bovenaan of naast de marker
- Label van de dimensie linksboven, korte uitleg-tekst eronder

Dit is een substantieel implementatiepunt — SVG met tick-marks bij niet-gelijke
intervallen. Bouw het als losse `<ScoreRuler>` component die de ankerpunten en
de behaalde score als props ontvangt.

### Score totaalindicatie

Grote weergave van de totaalscore (bijvoorbeeld 38px) met daaronder het percentiel
in kleinere tekst. Geen dikke balk eromheen, gewoon groot getal met context.

### Kaarten voor scenario-vergelijking

Drie kaarten naast elkaar op desktop (`grid grid-cols-3 gap-6`), gestapeld op
mobiel. Elk scenario zijn eigen kaart, geen kleuraccenten per scenario —
alleen tekstlabels ("Conservatief", "Basis", "Optimistisch").

### Rüinstrepen en badges voor "Gehaald / Niet gehaald"

Sectie 7's badges gebruiken de signaalkleuren (bestaand). Rond, klein, met
tekstlabel ernaast. Voorbeeld:
```
inline-flex items-center gap-2
<span class="w-2 h-2 rounded-full bg-green-500"></span>
<span class="text-sm">Gehaald</span>
```

## 5. Hover, focus, animatie

- Alle interactieve elementen: `transition-colors duration-150`
- Hover: primair kleurverandering, secundair een subtiele accentkleur-onderlijn
  voor tekstlinks
- Focus: expliciet `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`
- Geen scaling, translaties, of bounce-animaties
- Kaarten reageren niet op hover (statisch)

## 6. Toegankelijkheid — pragmatisch WCAG AA

Aanpakken vanaf begin, geen volledige audit:
- Contrast: alle tekst moet minimaal 4.5:1 contrast halen tegen zijn achtergrond
  (secundaire tekst en labels ook)
- Focus-indicatoren: zichtbaar op alle interactieve elementen (zie §5)
- Toetsenbordnavigatie: elk formulier bruikbaar zonder muis; tab-volgorde logisch
- Alt-text op inhoudelijke afbeeldingen (nog geen in scope, maar principe geldt)
- Formulierlabels expliciet gekoppeld aan velden (`htmlFor`)
- Voldoende target-groottes voor knoppen (minimaal 44×44px klikbaar gebied)

Wat expliciet niet in scope is voor nu: screenreader-audit, ARIA-live-regions voor
dynamische updates, hoge-contrast-modus. Later te evalueren.

## 7. Responsive gedrag

Desktop is primair. Mobiel moet bruikbaar zijn, niet geoptimaliseerd.

- Layout: max-breedte `max-w-5xl`, marges verkleinen op mobiel (`px-4`)
- Tabellen: horizontaal scrollen zoals nu al gebeurt (`overflow-x-auto` op tabel-
  container). Geen kaart-transformatie van tabellen op mobiel.
- Scenario-vergelijking: `grid grid-cols-1 md:grid-cols-3 gap-6` — één kolom op
  mobiel, drie op desktop
- Wizard-stappen: één sectie tegelijk zichtbaar (huidige gedrag), formuliervelden
  full-width op mobiel

## 8. Laad-staten

Voortgangs-tekst boven skeletschermen.

- Bij formulier-verzenden (Server Action): knop wordt uitgeschakeld en toont
  tekst "Berekening loopt..." met een subtiele spinner-animatie ernaast (kleine
  cirkel, monochroom)
- Bij paginanavigatie: standaard Next.js laadgedrag, geen custom transition
- Foutmelding: bovenaan het formulier of het beoogde resultaatgebied, in
  signaal-rood met een korte, duidelijke uitleg — geen technische termen

## 9. Wat expliciet uit de scope blijft

- Dark mode (het thema is licht, geen toggle)
- Custom illustraties, iconografie, of graphics (afgezien van de score-liniaal
  en de bestaande SVG-lijngrafiek)
- Animaties op de content (fade-in bij scroll, parallax, etc.)
- Emoji, iconen als versiering — alleen functionele iconen (bijv. de kopieer-
  knop-bevestiging) toegestaan, en dan uit een enkele consistente set
  (bijvoorbeeld Lucide of Heroicons)

## 10. Volgorde van uitvoering

De visuele pas is één samenhangende stap, geen sectie-voor-sectie werk. In
volgorde:

1. Vervang `app/globals.css` volledig: nieuw kleurpalet, Inter via next/font,
   tabular-nums als default op tabellen en cijfercellen
2. Bouw een `<ScoreRuler>` component voor de vijf dimensies (nieuw, vervangt
   huidige balken)
3. Pas kaartstijl toe op alle negen secties en beide paden (gratis + betaald)
4. Werk tabelstijl door: rüinstrepen, headerondelijn, tabular-nums
5. Werk knopstijl door: primair blauw, secundair blauw omrand
6. Focus-indicatoren op alle interactieve elementen
7. Voortgangs-tekst op Server Action-knoppen
8. Playwright-verificatie: één screenshot per pagina (gratis-invoer,
   gratis-resultaat, elke wizard-stap, betaalde resultaatpagina)

Golden-render-tests blijven ongewijzigd draaien — de tests toetsen inhoud,
niet stijl. Als een test faalt door een klasseverandering, is dat een fout in
de test die te specifiek was, niet in de nieuwe stijl.

Geen wijzigingen aan de rekenlaag, de rentInputProvenance-logica, de disclosure-
sleutels, of enige andere niet-visuele module. Dit is puur presentatie-werk.
