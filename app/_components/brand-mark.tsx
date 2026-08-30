"use client";

/**
 * The Yield & Stone brand mark: the stone icon beside the wordmark.
 *
 * Deliberately NOT one combined logo SVG. The icon is artwork; the name
 * is real text, set in Space Grotesk 700. That means the name is
 * selectable, searchable, readable by a screen reader, and it reflows and
 * rescales with the surrounding type instead of being a fixed-size
 * picture of words. It also means the name stays crisp at any size and in
 * any rendering context, including print.
 *
 * === Why the two halves line up by themselves ===
 *
 * inline-flex with align-items:center, and every dimension in `em`: the
 * icon is 1.55em tall, the gap 0.55em. Nothing is positioned by hand, so
 * a caller changes only font-size and the whole mark scales together,
 * still centred. Sizing in px instead would need a second adjustment for
 * every size the mark appears at, and would drift the moment one was
 * missed.
 *
 * === The mask id, which is the trap here ===
 *
 * The icon carves the little house out of the stone with an SVG <mask>,
 * and a mask is referenced by id. Ids are document-global, so two copies
 * of this mark on one page with a hardcoded id would both resolve to the
 * FIRST mask in the document. Today that happens to look right - the
 * masks are identical - but it is a live bug waiting for the first
 * variant: change the mask in one instance and the other silently changes
 * with it, or remove the first instance and the second loses its mask
 * entirely.
 *
 * useId() gives every instance its own. It is React's own SSR-safe
 * generator, so the id is identical in the server HTML and after
 * hydration - a random id would differ between the two and trip a
 * hydration mismatch. That is the reason this file is a client component
 * at all; nothing here is interactive.
 *
 * The supplied `public/logo-icoon.svg` stays the canonical standalone
 * asset (favicon, OG images, anything outside React). The geometry is
 * duplicated here because inlining is what makes per-instance ids and the
 * light/dark variant possible at all - and
 * __tests__/brand-mark.test.tsx compares the two so they cannot drift.
 */

import { useId } from "react";

/**
 * The mark's own two colours, which are NOT the interface palette's.
 *
 * The stone is #183A2D, a little deeper and greener than the interface
 * accent #1F2F28; the mark's gold is #B99152, where the interface
 * highlight is #C49A4A. Both differences are small and both are
 * deliberate - these are the brand artwork's values as delivered. They
 * live here as named constants rather than as loose hexes so the
 * distinction is visible rather than looking like a typo.
 */
const STONE_DARK = "#183A2D";
const STONE_LIGHT = "#F6F4F1";
const BRAND_GOLD = "#B99152";
const WORDMARK_INK = "#1D1B1A";

export type BrandTone = "onLight" | "onDark";

export interface BrandMarkProps {
  /**
   * Which ground the mark sits on. On dark, the stone and the name both
   * go to #F6F4F1; the gold stays exactly as it is, in both tones - it is
   * the one constant of the mark.
   */
  tone?: BrandTone;
  /** Extra classes for the wrapper - font-size lives here, and everything else follows from it. */
  className?: string;
}

/** The icon alone, for callers that want the stone without the words (the favicon route, an avatar). */
export function BrandIcon({ tone = "onLight" }: { tone?: BrandTone }) {
  const maskId = useId();
  return (
    <svg
      viewBox="0 0 160 160"
      aria-hidden="true"
      focusable="false"
      className="block h-[1.55em] w-auto"
    >
      <g transform="translate(-8.35,4.0) scale(0.858)">
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="200">
          <rect x="0" y="0" width="220" height="200" fill="#fff" />
          <path d="M86 162 L86 133 L102 118 L118 133 L118 162 Z" fill="#000" />
          <rect x="99" y="145" width="7" height="17" fill="#fff" />
        </mask>
        <path
          d="M92 34 C56 39 34 72 37 111 C39 145 62 162 95 163 C126 164 157 153 166 126 C177 92 158 57 129 43 C117 37 105 33 92 34 Z"
          fill={tone === "onDark" ? STONE_LIGHT : STONE_DARK}
          mask={`url(#${maskId})`}
        />
        <circle cx="144" cy="27" r="13" fill={BRAND_GOLD} />
      </g>
    </svg>
  );
}

export function BrandMark({ tone = "onLight", className }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-[0.55em] ${className ?? ""}`}>
      <BrandIcon tone={tone} />
      {/*
       * Real text, not a picture of text. font-heading is the Space
       * Grotesk token from globals.css; the negative tracking and
       * line-height:1 are the wordmark's own, so it sits tight and
       * optically centred against the icon.
       */}
      <span
        className="font-heading leading-none font-bold tracking-[-0.02em]"
        style={{ color: tone === "onDark" ? STONE_LIGHT : WORDMARK_INK }}
      >
        Yield &amp; Stone
        {/*
         * The full stop is part of the mark, and it is gold in both
         * tones. Its own span because it is the only character that
         * changes colour - and aria-hidden because a screen reader
         * announcing "Yield and Stone period" adds nothing.
         */}
        <span aria-hidden="true" style={{ color: BRAND_GOLD }}>
          .
        </span>
      </span>
    </span>
  );
}

/** Exported for the golden test, so the colours it checks are the ones this file actually uses. */
export const BRAND_MARK_COLOURS = {
  stoneDark: STONE_DARK,
  stoneLight: STONE_LIGHT,
  gold: BRAND_GOLD,
  ink: WORDMARK_INK,
} as const;
