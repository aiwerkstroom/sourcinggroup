# Sourcing Group — Rentabiliteitsplatform

## TSG Yield Engine — Fase 1 + 1b: de motor (actueel)

De rekenlaag van de **TSG Yield Engine** staat in `lib/rules/es/` (pure
TypeScript, geen framework). Fase 1 repliceert de gecorrigeerde
`TSG_Model_v3.xlsx` exact (Excel-pariteit); fase 1b bouwt daarop voort met
een meerjarige projectie, cashflow na belasting, exit en IRR
(`MODEL_SPEC_FASE1B.md`). Specificatie: [`MODEL_SPEC.md`](MODEL_SPEC.md) —
inclusief de openstaande **[BESLISSING]**-punten die door Samuel moeten worden
vastgesteld. Alle parameters staan met bron en datum in
`lib/rules/es/parameters.ts`; er zitten geen hardgecodeerde getallen in de
rekenfuncties.

```bash
npm install
npm test          # 143 tests: golden tests tegen de referentiecasus
                  # (Excel-pariteit fase 1, onafhankelijke Python-
                  # doorrekening fase 1b)
```

Fasering (zie projectspecificatie): 1 motor → 1b meerjarige projectie/exit/IRR
→ 2 invoer & resultaat (Next.js) → 3 PDF-rapport → 4 account & betaling
→ 5 crawl. Fase 1 en 1b zijn af zodra `npm test` groen is en de uitkomsten
met het model/de onafhankelijke doorrekening overeenkomen — dat is nu het
geval.

---

## Eerdere Python-opzet (werkstromen)

Van Excel-model naar geautomatiseerd beoordelingsplatform voor investeringspanden.
Twee werkstromen op één rekenkern:

1. **Beoordeling** — een investeerder voert een pand + bestedingsplan in en krijgt
   direct een score met dashboard.
2. **Sourcing** — een database met investeringspanden wordt door hetzelfde model
   gehaald en gerankt op aantrekkelijkheid.

## Architectuur

```
                    ┌──────────────────────────────┐
  TSG Model.xlsx ──►│  engine/   (de rekenkern)    │
  (logica overzetten│  - schema.py   invoervelden  │
   met tools/…)     │  - model.py    KPI-berekening│
                    │  - scoring.py  weging → score│
                    │  config/scoring.yaml drempels│
                    └──────┬───────────────┬───────┘
                           │               │
              ┌────────────▼───┐   ┌───────▼────────────┐
  Werkstroom 1│ api/ (FastAPI) │   │ batch/rank.py      │Werkstroom 2
              │ + web/dashboard│   │ database → ranglijst│
              └────────────────┘   └────────────────────┘
```

**Kernprincipe:** de logica leeft op precies één plek (`engine/`), niet in Excel,
niet in de website. Excel wordt de *specificatie*; de engine is de *uitvoering*.
Beide werkstromen — en alles wat er later bijkomt (rapporten, alerts, API voor
partners) — gebruiken dezelfde engine, dus een aanpassing in het model werkt
overal meteen door.

## Waarom niet "Excel aan de website knopen"?

Drie opties zijn overwogen:

| Aanpak | Oordeel |
|---|---|
| Excel live aanroepen vanaf de site (Graph API / xlwings) | Traag, fragiel, niet schaalbaar naar duizenden panden, licentie-gedoe |
| Excel elke keer handmatig converteren | Foutgevoelig, geen versiebeheer op logica |
| **Logica één keer overzetten naar code + paritytests** | Snel, testbaar, schaalbaar; Excel blijft bron van waarheid via golden tests |

De derde aanpak is hier gebouwd.

## Stappenplan: het Excel-model overzetten

De bestanden `TSG Model.xlsx` en `Yield Report Database.xlsx` zijn nog niet in
deze repository aanwezig — dit is stap 1.

1. **Upload de bestanden** naar `data/` in deze repo (of deel ze in een sessie).
2. **Extraheer de structuur:**
   ```bash
   python tools/extract_excel.py "data/TSG Model.xlsx"
   ```
   Dit levert een JSON en een leesbaar Markdown-overzicht met álle formules,
   waarden en named ranges.
3. **Map de logica naar de engine.** Elke invoercel wordt een veld in
   `engine/schema.py`; elke berekening een regel in `engine/model.py`; de
   weging/drempels gaan naar `config/scoring.yaml`. De huidige implementatie
   bevat al de standaard-KPI's (BAR, NAR, cash-on-cash, DSCR) als vertrekpunt.
4. **Golden tests.** Neem 3–5 doorgerekende voorbeelden uit Excel en leg de
   uitkomsten vast in `tests/`. Pas de engine aan tot alle cijfers exact
   overeenkomen — dan is de overzetting bewezen correct.
5. **Kolommap voor de database.** Zet de kolomkoppen van
   `Yield Report Database.xlsx` in `config/kolommen.yaml`.

## Gebruik

```bash
pip install -r requirements.txt
pytest                                   # rekenkern controleren

# Werkstroom 1: dashboard
uvicorn api.main:app --reload            # open http://localhost:8000

# Werkstroom 2: database ranken
python -m batch.rank "data/Yield Report Database.xlsx" --top 25 --uitvoer ranglijst.xlsx
```

De API kan ook direct met JSON worden aangeroepen (voor koppelingen met andere
systemen): `POST /api/beoordeling` en `POST /api/ranking` (bestand-upload).
Interactieve API-documentatie: `http://localhost:8000/docs`.

## Roadmap (na de basis)

- **Uploads verrijken:** bestedingsplan als xlsx-upload met vaste template i.p.v.
  één totaalbedrag; PDF-rapport per beoordeling.
- **Accounts & opslag:** beoordelingen bewaren per klant (database, bv. Postgres),
  login, geschiedenis.
- **Sourcing-pijplijn:** de pandendatabase periodiek verversen vanuit databronnen
  (aanbodfeeds/partners — let op de voorwaarden van bronnen zoals funda), en
  investeerders automatisch matchen op hun zoekprofiel (budget, regio, minimale score).
- **Hosting:** de FastAPI-app draait op elke standaard host (Railway, Render,
  Fly.io, Azure); het dashboard kan later worden vervangen door een volwaardige
  frontend (Next.js) op dezelfde API.

## Projectstructuur

```
engine/            rekenkern (schema's, KPI's, scoring)
config/            scoring.yaml (weging/drempels) en kolommen.yaml (databasemapping)
api/               FastAPI-webservice
web/               dashboard (werkstroom 1)
batch/             database-ranker (werkstroom 2)
tools/             extract_excel.py — Excel-model uitlezen
tests/             sanity- en (straks) golden tests
```
