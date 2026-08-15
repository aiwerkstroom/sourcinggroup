"use client";

/**
 * Sends the wizard's own in-memory WizardData to pdf/genereer/route.ts
 * (fase 3 stap 3) and downloads whatever comes back. Nothing about this
 * request is stored anywhere first - the POST body is the entire
 * transaction (CLAUDE.md §4, this task's own instruction).
 *
 * Loading-state language matches the visual pass's step 7 pattern
 * exactly (exit-form.tsx's "Bezig met doorrekenen…" + Spinner): the same
 * spinner component, the same disabled-button-during-work shape, so a
 * customer who has already seen that pattern once in the wizard
 * recognises it here.
 */

import { useState } from "react";
import { Spinner } from "../../nieuw/_components/spinner";
import type { WizardData } from "../../nieuw/_state/wizard-state";

type DownloadState = "idle" | "generating" | "error";

export function DownloadPdfButton({ data }: { data: WizardData }) {
  const [state, setState] = useState<DownloadState>("idle");

  async function handleClick() {
    setState("generating");
    try {
      const response = await fetch("/rapport/resultaat/pdf/genereer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        setState("error");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rendementsrapport.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "generating"}
        className="border-accent text-accent focus-visible:ring-accent-ring flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
      >
        {state === "generating" ? <Spinner /> : null}
        {state === "generating" ? "PDF wordt gegenereerd…" : "Download als PDF"}
      </button>
      {state === "error" ? (
        <p role="alert" className="text-signal-negative text-xs">
          Het genereren van de PDF is niet gelukt. Probeer het opnieuw.
        </p>
      ) : null}
    </div>
  );
}
