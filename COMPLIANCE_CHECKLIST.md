# COMPLIANCE_CHECKLIST — TSG Yield Engine

Werkversie, opgesteld als eigen inschatting — juridisch advies wordt op een later
moment ingewonnen. Dit document is de tussentijdse werkbasis: het legt vast wat er
in de architectuur speelt en welke positie TSG inneemt, zodat een jurist later
gericht kan toetsen in plaats van vanaf nul te beginnen. Niets hierin is een
juridisch bevestigd standpunt.

---

## 1. Wat er wordt verwerkt

| Gegevenscategorie | Waar | Bewaring |
|---|---|---|
| Adres, oppervlak, bouwjaar van het pand | Betaald rapport | 1 week + PDF bij klant |
| Vermogen, budget, LTV, rendementseis | Betaald rapport | 1 week + PDF bij klant |
| E-mailadres (account) | Supabase Auth | Zolang account bestaat |
| Betaalgegevens | Stripe (niet zelf opgeslagen) | Bij Stripe |
| Postcode/wijk, vraagprijs, oppervlak (gratis) | URL-queryparameters | Niet opgeslagen |

Geen bijzondere persoonsgegevens in de AVG-zin (geen gezondheid, ras, etc.). Wel
financiële gegevens gekoppeld aan een identificeerbare persoon zodra er een account
is — dat vraagt om zorgvuldige verwerking, ook zonder wettelijk bijzondere status.

## 2. AVG — concrete actiepunten

### 2.1 Verwerkersovereenkomsten (DPA's)
- [ ] Supabase: DPA getekend vóór eerste klantdata
- [ ] Stripe: DPA getekend vóór eerste transactie
- [ ] Vaststellen waar Supabase-servers staan (EU-regio kiezen indien mogelijk,
      vereenvoudigt internationale doorgifte-vraagstukken aanzienlijk)

### 2.2 Bewaartermijn — technisch afdwingen, niet alleen beloven
- [ ] Verifiëren dat de "1 week toegang"-regel uit UI_SPEC §9 een daadwerkelijke
      verwijdering of ontkoppeling is, niet alleen het UI-zichtbaar maken stopzetten
      terwijl de data in de database blijft staan
- [ ] Vaststellen: wordt het rapport na een week volledig verwijderd, of
      geanonimiseerd bewaard voor productverbetering? Dit moet expliciet worden
      besloten, niet impliciet blijven

### 2.3 Rechten van betrokkenen
- [ ] Proces voor inzage-, rectificatie- en verwijderingsverzoeken (ook al is de
      bewaartermijn kort, de klant heeft recht op verwijdering binnen die week)
- [ ] Proces voor het gratis pad: er wordt niets opgeslagen, maar de URL zelf kan
      door de klant gedeeld worden — vaststellen of dat voldoende transparant is
      gecommuniceerd (het is geen "opslag" in AVG-zin zolang TSG zelf niets bewaart,
      maar de jurist moet bevestigen dat deze lezing standhoudt)

### 2.4 Verwerkingsgrondslag en -register
- [ ] Grondslag vaststellen per verwerking (uitvoering overeenkomst voor het
      betaalde rapport; gerechtvaardigd belang of toestemming voor eventuele
      productverbetering-analytics)
- [ ] Verwerkingsregister opstellen (verplicht, ook voor kleine organisaties in de
      meeste gevallen)

### 2.5 Privacyverklaring en cookies
- [ ] Privacyverklaring die specifiek de twee paden beschrijft (wat er bij gratis
      wél/niet gebeurt versus betaald)
- [ ] Cookie-/trackingbeleid als er analytics wordt toegevoegd (nog niet in scope
      voor fase 2, wel relevant zodra dat gebeurt)

## 3. Wft — werkpositie, nog niet juridisch getoetst

### 3.1 Vastgesteld uitgangspunt (Samuel, augustus 2026)
TSG biedt geen beleggingsadvies en geen bemiddeling. Het product is een analyse- en
sourcingdienst: het rekent een pand door op basis van data en aangeleverde criteria,
zonder een koop- of verkoopaanbeveling te doen. De crawlfunctie sourcet panden op
basis van criteria die de klant zelf opgeeft — geen selectie of aandragen op eigen
initiatief van TSG.

Dit is een redelijke en in de praktijk gangbare positie: het onderscheid tussen
"hier is de doorrekening" en "wij raden dit aan" is precies het onderscheid dat de
Wft-kwalificatie van advies bepaalt. Het is echter een eigen inschatting, geen
juridisch bevestigd feit. Onderstaande blijft daarom staan als voorwaarde waaraan de
bouw moet voldoen om deze positie verdedigbaar te houden, niet als afgerond punt.

### 3.2 Wat de positie in de praktijk vereist van het product
Om "analyse, geen advies" overeind te houden, moet de presentatie dat ondersteunen:
- geen taal die als aanbeveling leest ("dit is een goede investering", "wij raden
  aan") — het rapport constateert, het beveelt niet aan
- de TSG-score is een gewogen weergave van berekende cijfers, geen koopsignaal —
  de UI-teksten eromheen moeten dat consistent laten zien
- de crawl toont panden die aan opgegeven criteria voldoen, gepresenteerd als
  zoekresultaat, niet als aanbod of selectie door TSG
- elke uitkomst blijft herleidbaar naar data en aannames (`placeholdersUsed`, de
  rentInputProvenance-laag, het "wat niet geverifieerd is"-hoofdstuk) — dit
  onderbouwt objectief dat het een doorrekening is, geen oordeel van TSG zelf

Dit is al hoe het product is ontworpen; het is vooral een kwestie van dit zo te
houden bij toekomstige copy- en featurebeslissingen.

### 3.3 Nog te doen, verplaatst naar een later moment
- [ ] Juridische bevestiging van bovenstaande positie (uitgesteld — jurist wordt op
      een later moment ingeschakeld, dit document dient dan als uitgangspunt)
- [ ] Beoordelen of een expliciete disclaimer nodig is ("TSG geeft geen
      beleggingsadvies") en waar die het beste staat
- [ ] Herbeoordelen zodra de crawlfunctie (fase 5) concreter wordt — een dienst die
      actief filtert en rangschikt kan dichter tegen advies aanliggen dan een pure
      rekendienst, ook als de criteria van de klant komen

## 4. Overig, lagere urgentie maar te plannen

- [ ] Aansprakelijkheidsverzekering voor beroepsaansprakelijkheid, gezien het
      product cijfers levert waarop investeringsbeslissingen worden gebaseerd
- [ ] Algemene voorwaarden: wat gebeurt er als een klant het oneens is met een
      rapport (zie eerdere open vraag richting het CX-team over restitutiebeleid)
- [ ] KVK-inschrijving en rechtsvorm, indien nog niet geregeld, met het oog op
      aansprakelijkheidsbeperking

## 5. Volgorde van urgentie

1. Bewaartermijn technisch correct implementeren (§2.2) — raakt de huidige bouw
   (Supabase-schema), dus relevant zodra fase 4 (account/opslag) begint
2. Verwerkersovereenkomsten (§2.1) — moeten getekend zijn vóór de eerste klant, dus
   vóór launch, niet urgent voor de huidige bouwfase
3. Wft-positie (§3) laten bevestigen door een jurist — uitgesteld naar een later
   moment, maar wel vóór launch: de werkpositie in §3.1 stuurt tot die tijd de
   copy- en featurebeslissingen
4. Rest — kan parallel lopen aan de bouw, moet rond zijn vóór launch
