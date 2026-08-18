"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useReducedMotion } from "../_lib/use-reduced-motion";
import {
  EXAMPLE_DEFAULTS,
  EXAMPLE_PRICE_RANGE,
  EXAMPLE_RENT_RANGE,
  EXAMPLE_TICKS,
  EXAMPLE_WIJK_TYPES,
  computeExampleOutcome,
} from "./example-calculator-formula";
import { ExampleScoreRuler } from "./example-score-ruler";

/**
 * The interactive demonstration (HOMEPAGE_UPGRADE_SPEC.md §4), replacing
 * the static example section. The homepage's third and last client
 * component.
 *
 * The arithmetic lives in example-calculator-formula.ts, which imports
 * nothing; this file is the UI around it. That split is what lets the
 * formula's isolation be checked structurally rather than by reading.
 *
 * === Debounce: on typing, not on dragging ===
 *
 * §4.4 asks for 150ms so the score does not jitter per keystroke. Applied
 * to the number fields only. A slider is continuous and the visitor
 * expects the figure to track their thumb; 150ms there reads as lag, not
 * as calm. So the committed value updates immediately while dragging, and
 * waits while typing - the same setting serving opposite purposes on two
 * input types, which is why it is a per-control decision rather than one
 * debounce around the whole form.
 *
 * === The label is a fixed header, not a hint ===
 *
 * §4.3 requires it to stay visible during interaction. It sits above the
 * controls, outside anything that scrolls or collapses, so it cannot be
 * dismissed or scrolled away from while someone is typing numbers into a
 * calculator that is not the real one.
 */

const DEBOUNCE_MS = 150;

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatScore(score: number): string {
  return score.toFixed(1).replace(".", ",");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * One price/rent control: a slider and a number box driving the same
 * value, the slider committing immediately and the box after the
 * debounce.
 */
function AmountField({
  label,
  unit,
  range,
  value,
  onCommit,
}: {
  label: string;
  unit: string;
  range: { min: number; max: number; step: number };
  value: number;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  // The text the visitor is typing, which is allowed to be briefly
  // invalid ("3", "30") on the way to a real number. Kept apart from the
  // committed value so a half-typed figure never reaches the formula.
  const [draft, setDraft] = useState(String(value));

  // When the committed value changes from outside this field - the
  // slider, or a clamp - the box has to follow. Adjusted during render
  // rather than in an effect: this is React's own documented pattern for
  // "a prop changed, derive state from it", and it avoids the extra
  // commit an effect would cause (and the flash of a stale number in
  // between).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  useEffect(() => {
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed)) return;
    const clamped = clamp(parsed, range.min, range.max);
    if (clamped === value) return;

    const timer = setTimeout(() => onCommit(clamped), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onCommit, range.min, range.max, value]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-text-muted tabular text-sm">{EURO.format(value)}{unit}</span>
      </div>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        step={range.step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="border-border focus-visible:ring-accent-ring tabular w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      />
      <input
        type="range"
        aria-label={`${label} (schuifregelaar)`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        // No debounce: dragging is continuous and the reading should
        // follow the thumb.
        onChange={(event) => onCommit(Number(event.target.value))}
        className="accent-accent focus-visible:ring-accent-ring w-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      />
    </div>
  );
}

export function ExampleCalculator() {
  const wijkId = useId();
  const [priceEUR, setPriceEUR] = useState(EXAMPLE_DEFAULTS.priceEUR);
  const [rentPerMonthEUR, setRentPerMonthEUR] = useState(EXAMPLE_DEFAULTS.rentPerMonthEUR);
  const [wijk, setWijk] = useState(EXAMPLE_DEFAULTS.wijk);
  const reducedMotion = useReducedMotion();

  const outcome = useMemo(
    () => computeExampleOutcome(priceEUR, rentPerMonthEUR, wijk),
    [priceEUR, rentPerMonthEUR, wijk],
  );

  return (
    <div className="flex flex-col gap-6">
      {/*
        §4.3's label, strengthened. The second sentence is the one that
        matters now the section is interactive: once someone types their
        own figures and watches a score move, the risk stops being "thinks
        this property exists" and becomes "thinks they now know the
        method". The first sentence does not address that; this one does.
      */}
      <div className="border-accent bg-accent-subtle rounded-md border-l-2 px-4 py-3">
        <p className="text-sm font-medium">
          Interactief voorbeeld — pas de cijfers aan en zie het effect.
        </p>
        <p className="text-text-muted mt-1 max-w-prose text-sm leading-relaxed">
          Dit is geen echt pand en geen echte berekening. De uitkomst hieronder komt uit een
          vereenvoudigde demonstratieformule, niet uit de methode die het betaalde rapport
          gebruikt.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <AmountField
          label="Vraagprijs"
          unit=""
          range={EXAMPLE_PRICE_RANGE}
          value={priceEUR}
          onCommit={setPriceEUR}
        />
        <AmountField
          label="Huur per maand"
          unit=" /mnd"
          range={EXAMPLE_RENT_RANGE}
          value={rentPerMonthEUR}
          onCommit={setRentPerMonthEUR}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={wijkId} className="text-sm font-medium">
            Type wijk
          </label>
          <select
            id={wijkId}
            value={wijk}
            onChange={(event) => setWijk(event.target.value)}
            className="border-border focus-visible:ring-accent-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {EXAMPLE_WIJK_TYPES.map((type) => (
              <option key={type.name} value={type.name}>
                {type.name}
              </option>
            ))}
          </select>
          <p className="text-text-faint text-xs leading-relaxed">
            Verzonnen categorieën, geen echte wijken. Ze verschuiven alleen de vaste lasten.
          </p>
        </div>
      </div>

      <div className="border-border flex flex-wrap items-baseline gap-x-10 gap-y-4 border-t pt-6">
        <div className="flex items-baseline gap-3">
          <span className="tabular text-5xl font-semibold">{formatScore(outcome.totalScore)}</span>
          <span className="text-text-muted text-sm">fictieve totaalscore</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-text-faint text-xs tracking-wide uppercase">
            Fictieve maandcashflow
          </span>
          <span className="tabular text-lg">
            {EURO.format(Math.round(outcome.monthlyCashflowEUR))}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-text-faint text-xs tracking-wide uppercase">Bruto yield</span>
          <span className="tabular text-lg">
            {outcome.grossYieldPercent.toFixed(1).replace(".", ",")}%
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {outcome.dimensions.map((dimension) => (
          <ExampleScoreRuler
            key={dimension.label}
            label={dimension.label}
            description={dimension.description}
            score={dimension.score}
            ticks={EXAMPLE_TICKS}
            animateMarker={!reducedMotion}
          />
        ))}
      </div>
    </div>
  );
}
