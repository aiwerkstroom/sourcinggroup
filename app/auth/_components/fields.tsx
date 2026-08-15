"use client";

/**
 * Form field primitive for the auth pages - a small, local duplicate of
 * the field-shell pattern app/rapport/nieuw/_components/fields.tsx and
 * app/gratis/_components/fields.tsx both already use (label, optional
 * hint, optional error, all wired to the input via aria-describedby),
 * not an import from either: /app/auth is its own route family,
 * decoupled the same way /gratis already is from the paid wizard. Only
 * the one field kind signup/signin actually need - a labelled text input
 * that can be type="email" or type="password" - is duplicated here, not
 * the wizard's full NumberField/SelectField/RadioGroup set.
 */

import { useId } from "react";

interface AuthFieldProps {
  label: string;
  type: "email" | "password";
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
  error?: string;
}

const inputClass =
  "bg-surface border-border focus-visible:border-border-strong focus-visible:ring-accent-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const inputErrorClass = "border-signal-negative";

export function AuthField({ label, type, value, onChange, autoComplete, hint, error }: AuthFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint !== undefined ? hintId : null, error !== undefined ? errorId : null]
      .filter((v) => v !== null)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint !== undefined ? (
        <p id={hintId} className="text-text-muted text-xs leading-relaxed">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} ${error !== undefined ? inputErrorClass : ""}`}
      />
      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-signal-negative text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
