"use client";

import { useSyncExternalStore } from "react";

/**
 * Reads the visitor's `prefers-reduced-motion` setting
 * (HOMEPAGE_UPGRADE_SPEC.md §1: "Bouw dit vanaf het begin in een gedeelde
 * utility, niet per component los").
 *
 * This is the JavaScript half of a two-part answer, and it is worth being
 * clear about which half does what, because the CSS half is the one that
 * actually guarantees the outcome:
 *
 * - globals.css handles the visual rule in a plain media query. That
 *   applies before any JavaScript has parsed, works if the JS never
 *   arrives at all, and cannot be raced. A visitor with reduced motion on
 *   sees every faded section at full opacity from the first paint.
 * - This hook lets a component *know*, so it can skip work that would be
 *   pointless or wrong - FadeIn uses it to not attach an
 *   IntersectionObserver at all. The accordion and the interactive tool
 *   (§5, §4) will need the same answer for transitions CSS alone cannot
 *   express.
 *
 * So the hook is an optimisation and a decision input, never the thing
 * standing between a visitor and readable content. If it returned the
 * wrong value the page would still be legible; that is deliberate.
 *
 * Built on useSyncExternalStore rather than useState + useEffect. A media
 * query list is exactly the "external store" that API exists for: the
 * value lives outside React and changes on its own. The effect version
 * read the query and called setState synchronously, which React 19's
 * lint correctly flags as a cascading render - and it also had a real
 * first-paint gap, rendering `false` once before correcting itself. This
 * version reads the true value during the very first client render.
 *
 * The server snapshot is `false`, meaning "animate". That is the safe
 * default in both directions: the server cannot know the setting, and a
 * reduced-motion visitor is already covered by the CSS media query before
 * this value is ever consulted.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const query = window.matchMedia(QUERY);

  // addEventListener is the modern API; addListener is kept as a fallback
  // for Safari before 14, which is still within the range of browsers
  // this audience uses.
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function getSnapshot(): boolean {
  // Guarded rather than assumed: jsdom in some configurations, and any
  // non-browser renderer, can reach this without matchMedia.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
