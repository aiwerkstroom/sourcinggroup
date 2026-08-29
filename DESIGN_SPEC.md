# DESIGN_SPEC — visuele richtlijn TSG

Vastgelegd op basis van vier interviewrondes met Samuel. Deze spec is autoritatief
voor alle visuele beslissingen in fase 2 (UI). Waar UI_SPEC §1 richting geeft
(referenties, taal), maakt dit document het concreet.

Referenties: McKinsey-rapportages (helder, ruim, ingetogen), Palantir Foundry
(dichtheid en precisie waar nodig), Upfront (nuchtere toon).

---

> **Merkwissel Yield & Stone.** Het palet van §1 hieronder is vervangen door
> het definitieve merkpalet. De structuur van het systeem — licht thema, één
> accent, signaalkleuren strikt gereserveerd voor drempels, WCAG AA als
> bindende bovenliggende eis (§6) — is ongewijzigd; alleen de zes kleuren zijn
> anders. De actuele, gemeten waarden staan in `app/globals.css` en worden
> gepind door `app/__tests__/design-tokens.test.ts`. De rest van dit document
> (typografie, layout, componentstijlen, toegankelijkheid) geldt onverkort.
>
> | Merkkleur | Hex | Rol in de tokens |
> |---|---|---|
> | Donkergroen | `#1F2F28` | `--color-accent` — knoppen, links, koppen-accent |
> | Saliegroen | `#6D7F74` | `--color-border-strong`, `--color-accent-ring` |
> | Goud/oker | `#C49A4A` | `--color-highlight` — **uitsluitend decoratief** |
> | Warm zand | `#D9D2C4` | `--color-border`, `--color-surface-raised`, `--color-accent-subtle` |
> | Gebroken wit | `#F6F4F1` | `--color-bg` |
> | Donkergrijs | `#2D343A` | `--color-text` |
>
> Drie tokens die het merkpalet niet benoemt zijn afgeleid en gemeten, omdat
> §6 bindend is bij tegenspraak: `--color-text-muted` `#4A5450` (7,2:1),
> `--color-text-faint` `#636F69` (4,8:1) en `--color-accent-hover` `#16211C`
> (15,1:1). Alle drie liggen in de warm-groengrijze familie van `#2D343A`.
>
> **Goud draagt geen tekst.** `#C49A4A` haalt 2,4:1 op de paginaachtergrond en
> 2,6:1 op wit — onder de 4,5:1 voor tekst én onder de 3:1 voor
> betekenisdragende grafiek. Het mag dus geen link, knoptekst, label of
> datamarkering zijn op een licht vlak; alleen decoratie, of tekst óp het
> donkergroen (5,4:1).
>
> **Twee gemeten botsingen met de signaalkleuren**, bewust niet opgelost (dat
> is een aparte ontwerpbeslissing): saliegroen deelt hue én helderheid met
> signaalgroen "gehaald" en verschilt alleen in verzadiging; goud deelt een
> hue-familie met signaaloranje maar verschilt wél in helderheid. Zie
> `design-tokens.test.ts`, dat beide vastlegt met de meting erbij.
>
> **Merknaam:** "The Sourcing Group" / "TSG" is in alle klantgerichte tekst
> vervangen door "Yield & Stone". Interne codebenamingen (`TSG_SCORE_ANCHORS`,
> `TSG_AUTH_STORE`, `TsgScore*`, bestandsnamen) blijven ongewijzigd —
> `app/__tests__/brand-name.test.tsx` bewaakt beide richtingen.

## 1. Palet en thema

**Licht thema als hoofdthema.** Vervangt de huidige donkere globals.css volledig,
niet uitgebreid.

De hexcodes hieronder zijn de daadwerkelijk toegepaste waarden uit
`app/globals.css`, met het gemeten contrast tegen de pagina-achtergrond
(`#FAFAF9`). Ze zijn bindend. De eerdere voorbeeldwaarden in dit document waren
op het oog gekozen; waar een meting uitwees dat die de contrasteis van §6 niet
haalde, is de waarde aangepast en hieronder vervangen. Zie de voetnoot bij §6
over welke eis leidt bij tegenspraak.

**Achtergrond en oppervlakken.**
- Pagina-achtergrond: warm wit `#FAFAF9` — niet zuiver wit, iets zachter voor
  lange leessessies
- Kaartachtergrond: zuiver wit `#FFFFFF`, scheidt de kaart van de pagina
- Gevulde staat van een keuze-element (geselecteerde radio): `#F3F4F6` — geen
  derde kaartniveau, alleen een subtiele vulling
- Tekst primair: bijna zwart `#111827` (17,0:1), niet zuiver zwart
- Tekst secundair: `#4B5563` (7,2:1) voor labels en metadata
- Tekst subtiel: `#6B7280` (4,6:1) voor voetnoten en de-emphasis
- Randlijnen: zeer licht `#E5E7EB` voor rüinstrepen tussen tabelrijen; iets
  sterker `#D1D5DB` waar een rand zelf de begrenzing is

De grijstrap is als geheel één stap donkerder dan aanvankelijk geschetst. De
oorspronkelijke subtiele tint `#9CA3AF` haalt 2,4:1 en is daarmee onleesbaar
voor voetnoten; alleen die ene waarde ophogen zou secundair en subtiel laten
samenvallen, dus schuift de hele trap mee. Drie zichtbaar verschillende niveaus,
alle drie boven 4,5:1.

**Accentkleur: donkerblauw.** Eén accent, geen extra accenten voor categorieën
of secties.
- Primair accent: `#1E40AF` (8,4:1) — links, primaire knoppen,
  tabelheader-onderlijnen, de marker op de score-liniaal
- Hover op het accent: `#1E3A8A` (9,9:1)
- Zachte accentvulling: `#EFF6FF` — uitsluitend als achtergrond, draagt zelf
  geen tekst
- Focusring: `#3B82F6` — grafisch element, valt onder de 3:1-eis, niet 4,5:1

**Signaalkleuren blijven strikt gereserveerd voor drempels** (§7 van UI_SPEC):
- Groen `#15803D` (4,8:1): drempel gehaald
- Rood `#B91C1C` (6,2:1): drempel niet gehaald
- Oranje `#B45309` (4,8:1): waarschuwing / tussenniveau

Dit zijn niet de waarden uit de donkere globals.css. Die waren gekozen tegen een
donkere achtergrond en halen op warm wit 1,6 tot 2,7:1 — groen `#4ADE80` komt
niet verder dan 1,7:1. Zelfde tinten, 700-gewicht, waarmee ze wel tekst kunnen
dragen.

Deze mogen nergens anders gebruikt worden — niet voor accenten, niet voor
categorielabels, niet voor de score-liniaal.

## 2. Typografie

**Twee families, met een scherpe scheiding.** Dit verving de oorspronkelijke
"Inter, één familie voor de hele interface" toen de merkidentiteit Yield & Stone
werd vastgesteld: het merk heeft een eigen kopstem nodig, maar de rekendiscipline
van het rapport hangt aan Inter en mag daar niet onder lijden.

| Familie | Waarvoor | Waarom |
|---|---|---|
| **Space Grotesk** (500/600/700) | `h1`, `h2`, `h3` en het woordmerk | De merkstem. Alleen wat *bekeken* wordt. |
| **Inter** | Lopende tekst, labels, formuliervelden, en **elk cijfer** | Alles wat *gelezen of geteld* wordt. `tabular-nums` komt hiervandaan. |

- Beide via next/font, self-hosted op buildtijd (voorkomt FOUT, geen
  runtime-request naar Google)
- `font-variant-numeric: tabular-nums` als default op alle tabellen en cijfercellen —
  cijfers moeten uitgelijnd zijn in kolommen. **Ongewijzigd:** Space Grotesk raakt
  geen enkele cijfercel.

**De scheiding is één elementregel in `app/globals.css`** (`h1, h2, h3 { font-family:
var(--font-heading) }`), geen utility-klasse per kop. Er staan tientallen koppen in
de wizard, het rapport, de gratis indicatie en de printweergave; een klasse op elk
daarvan is tientallen kansen om er één te vergeten. Een elementselector kan niet
vergeten worden.

`h4`–`h6` vallen er bewust buiten — de schaal hieronder stopt bij H3, en wat
daaronder zou vallen is in de praktijk een label.

**Deze regel rust op één invariant:** geen enkele kop in dit project is een kaal
getal. Zou dat ooit veranderen, dan verliest die kop stilzwijgend de tabular-nums
van Inter. `app/__tests__/typography.test.ts` toetst de invariant, en meet de
toepassing via computed styles op een echte pagina — niet via klassenamen, want
wat telt is of de regel wint, niet of hij bestaat.

**Laadkosten:** +21,8 KB preload per paginaweergave (één gewicht), +46,9 KB op
schijf voor alle drie de gewichten. Gewicht 700 wordt op dit moment door geen
enkele kop gebruikt en wordt dus nooit opgehaald door de browser.

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
  (secundaire tekst en labels ook). Puur grafische elementen — randlijnen,
  focusringen, de liniaal en tick-marks van de score, lijnen in een grafiek —
  vallen onder de lagere 3:1-eis, omdat ze geen tekst dragen.
- Focus-indicatoren: zichtbaar op alle interactieve elementen (zie §5)
- Toetsenbordnavigatie: elk formulier bruikbaar zonder muis; tab-volgorde logisch
- Alt-text op inhoudelijke afbeeldingen (nog geen in scope, maar principe geldt)
- Formulierlabels expliciet gekoppeld aan velden (`htmlFor`)
- Voldoende target-groottes voor knoppen (minimaal 44×44px klikbaar gebied)

Wat expliciet niet in scope is voor nu: screenreader-audit, ARIA-live-regions voor
dynamische updates, hoge-contrast-modus. Later te evalueren.

**Bij tegenspraak leidt deze paragraaf.** Waar een kleurvoorstel elders in dit
document de 4,5:1-eis niet haalt, wint de eis en schuift de kleur op — met behoud
van de bedoelde kleurfamilie en de bedoelde onderlinge hiërarchie. De hexcodes in
§1 zijn op die manier vastgesteld en gemeten; ze zijn daarmee de bindende
waarden, niet de illustratieve. Een nieuwe kleur wordt gemeten vóór hij wordt
vastgelegd, niet op het oog gekozen.

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
