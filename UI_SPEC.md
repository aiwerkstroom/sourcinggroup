# UI_SPEC — TSG Yield Engine

Dit bestand bestaat nog niet volledig; het start hier met het enige punt dat
tot nu toe uit gesprek en rekenlaag is voortgekomen. Andere secties (layout,
componenten, invoerformulier, rapportstructuur) volgen zodra ze worden
aangeleverd of vastgesteld. Niets hieronder is verzonnen ter aanvulling —
alleen vastgelegd wat al is onderbouwd.

## §5. Beoordelingslogica — vergelijkingsmaatstaf, geen enkelvoudige drempel

**Bevinding (fase 1b, referentiecasus Avenida Primado Reig 19):** een deal
kan op elke drempel falen — cashflow onder het minimum, DSCR onder 1 — en
toch een positieve IRR opleveren. In het conservatieve scenario van de
referentiecasus is dat expliciet het geval: negatieve cashflow en DSCR < 1
in alle tien projectiejaren, maar een IRR van 2,49% omdat de aflossing en
de waardegroei bij verkoop het rendement dragen, niet de lopende cashflow.
Terugverdientijd via cashflow alleen is `null` in alle drie scenario's van
deze casus — ook optimistisch (zie `lib/rules/es/outcome.ts`,
`MODEL_SPEC.md` §12).

**Wat dit betekent voor het rapport:** een oordeel dat uitsluitend op
cashflow- of DSCR-drempels afgaat, wijst zo'n deal af terwijl hij voor een
deel van de markt — een belegger die bewust bijlegt uit ander inkomen en
het rendement bij verkoop haalt — precies passend kan zijn. Dat is een
legitieme strategie, geen tegenstrijdigheid in het model.

**Vereiste:** het rapport heeft een vergelijkingsmaatstaf nodig, geen
enkelvoudige pass/fail-drempel. De rekenlaag levert hiervoor al de
bouwstenen (`ScenarioOutcome` in `lib/rules/es/outcome.ts`):
`irr` (incl. `defined: false`-geval), `returnRequirement`
(IRR vs. `minRoiTarget`), `equityFit`, `paybackYear`, en de
drempeltoetsen uit fase 1 (cashflow, DSCR, LTV, budget) via `years`/`exit`.
Deze horen **naast elkaar** getoond te worden — niet samengevat tot één
oordeel — zodat de lezer zelf kan zien *welke* maatstaf een deal wel of
niet haalt, en waarom.

**[BESLISSING]** Hoe dit visueel wordt vormgegeven (tabel, kaarten,
stoplichtkleuren per maatstaf, samenvattende tekst) staat nog open; dat is
onderdeel van de rest van deze spec, die nog moet worden aangeleverd.
