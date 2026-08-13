"use client";

/**
 * Copies the current URL to the clipboard - the free indication has no
 * account and no server state, so the URL itself (query params and all)
 * is the entire shareable result (this task's own instruction). No
 * social-media integrations: one action, one confirmation.
 */

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        className="border-border-strong rounded-md border px-4 py-2 text-sm hover:bg-white/5"
      >
        URL kopiëren
      </button>
      <span
        role="status"
        aria-live="polite"
        className="text-text-muted text-xs"
      >
        {copied ? "URL gekopieerd" : ""}
      </span>
    </div>
  );
}
