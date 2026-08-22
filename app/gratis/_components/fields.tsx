"use client";

/**
 * Form field primitives for the free indication's form. A small, local
 * duplicate of app/rapport/nieuw/_components/fields.tsx rather than an
 * import from it: that folder's leading underscore marks it private to
 * the paid wizard's route, and the free indication is deliberately a
 * separate flow with no shared state (this task's own instruction). Only
 * the field kinds this form needs are duplicated, not the paid form's
 * full set - a number and a select from the original five-field form,
 * plus a radio group added in fase A stap 1 for the two new closed-choice
 * narrowing fields (staat van onderhoud, huurniveau).
 *
 * Styling matches UI_SPEC.md §1 (dark, dense, functional) via the same
 * globals.css tokens the paid wizard's fields use.
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
  "bg-surface border-border focus-visible:border-border-strong focus-visible:ring-accent-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const inputErrorClass = "border-signal-negative";

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
  placeholder?: string;
  unit?: string;
}

/**
 * Text input rather than type="number", same reasoning as the paid
 * form's: the value stays exactly as typed (parse-number.ts handles
 * "350.000" and "85,5"), and a half-typed value is never silently
 * discarded.
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

/** Radios rather than a select, same reasoning as the paid form's own RadioGroup: the answer is short enough to show every option at once. */
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
              className={`has-[:focus-visible]:ring-accent-ring flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
                selected
                  ? "border-border-strong bg-surface-raised"
                  : "border-border hover:bg-surface-raised/50"
              } ${error ? "border-signal-negative" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="[accent-color:var(--color-accent)] mt-1 outline-none"
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

/** Groups related fields under a heading. */
export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="text-text-faint mb-1 text-xs tracking-widest uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}
