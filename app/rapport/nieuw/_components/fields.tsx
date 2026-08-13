"use client";

/**
 * Form field primitives for the wizard.
 *
 * Styling follows UI_SPEC.md §1: dark, dense, functional, data first.
 * Numbers use the monospace/tabular treatment from globals.css; colour
 * appears only as a signal, which here means a validation error and
 * nothing else - no decorative accents, no success ticks.
 *
 * Every field carries its label, an optional explanation and an optional
 * error. UI_SPEC.md §3 singles out three fields that need an explanation
 * in the interface (gastos de comunidad, kadastrale waarde, bruikbaar vs.
 * gebouwd oppervlak); `hint` is how those reach the customer, and it sits
 * under the label rather than behind a tooltip so it is read before the
 * field is filled, not after it is filled wrongly.
 */

import { useId } from "react";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; describedBy: string | undefined }) => React.ReactNode;
}

function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="text-text-faint font-normal"> — optioneel</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-text-muted max-w-prose text-xs leading-relaxed">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="text-signal-negative text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "bg-surface border-border focus:border-border-strong w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20";
const inputErrorClass = "border-signal-negative";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
  placeholder?: string;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  optional,
  placeholder,
}: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} ${error ? inputErrorClass : ""}`}
        />
      )}
    </FieldShell>
  );
}

interface NumberFieldProps extends TextFieldProps {
  /** Rendered inside the field, e.g. "€" or "m²". Display only - never parsed back. */
  unit?: string;
}

/**
 * Text input rather than type="number": the value stays exactly as typed
 * (parse-number.ts handles "350.000" and "85,5"), a stray scroll cannot
 * change an amount, and a half-typed value is never silently discarded by
 * the browser the way an invalid type="number" input is.
 */
export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  optional,
  placeholder,
  unit,
}: NumberFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <div className="relative">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} tabular ${unit ? "pr-12" : ""} ${error ? inputErrorClass : ""}`}
          />
          {unit ? (
            <span className="text-text-faint pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              {unit}
            </span>
          ) : null}
        </div>
      )}
    </FieldShell>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
  optional,
}: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <select
          id={id}
          value={value}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} ${error ? inputErrorClass : ""}`}
        >
          <option value="">{placeholder ?? "Maak een keuze"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface RadioGroupProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string; description?: string }>;
  hint?: string;
  error?: string;
}

/**
 * Radios rather than a select for the answers that change what the rest
 * of the form offers - the permit gate above all. A select hides its
 * options behind a click; these two questions decide whether short-term
 * rental exists at all for this property (UI_SPEC.md §4) and which
 * renovation tier the model will assume, so both stay visible with their
 * consequences written out.
 */
export function RadioGroup({ label, value, onChange, options, hint, error }: RadioGroupProps) {
  const name = useId();
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;

  return (
    <fieldset
      aria-describedby={
        [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
      }
    >
      <legend className="text-sm font-medium">{label}</legend>
      {hint ? (
        <p id={hintId} className="text-text-muted mt-1.5 max-w-prose text-xs leading-relaxed">
          {hint}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 ${
                selected ? "border-border-strong bg-surface-raised" : "border-border hover:bg-white/5"
              } ${error ? "border-signal-negative" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-1 accent-white"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">{option.label}</span>
                {option.description ? (
                  <span className="text-text-muted text-xs leading-relaxed">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-signal-negative mt-2 text-xs">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Groups related fields under a heading, keeping a long step scannable. */
export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="text-text-faint mb-1 text-xs tracking-widest uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}
