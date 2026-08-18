"use client";

import { useId, useState } from "react";
import { useReducedMotion } from "../_lib/use-reduced-motion";

/**
 * The FAQ as an accordion (HOMEPAGE_UPGRADE_SPEC.md §5). The homepage's
 * second client component, and like FadeIn it is isolated to the one
 * thing that needs interactivity - the page around it stays server-
 * rendered.
 *
 * === Multiple open at once, not one ===
 *
 * §5 leaves this free. Allowing several is the better default for an FAQ
 * specifically: it is a reference, not a walkthrough. Someone comparing
 * "wat kost het" against "is dit beleggingsadvies" wants both on screen,
 * and an accordion that closes the first question the moment they open
 * the second is fighting the reader rather than helping them.
 *
 * === Why the answers stay in the DOM ===
 *
 * A closed item is collapsed, never unmounted. Two reasons, and the
 * second is the one that matters:
 *
 *  - Height cannot transition from nothing; the content has to exist to
 *    be animated.
 *  - The answers are the page's actual substance. Rendering them only on
 *    click would mean the server HTML - what a crawler reads, and what
 *    LANDING_SPEC's own golden test asserts on - no longer contains the
 *    answer to "is dit beleggingsadvies". That answer is a compliance
 *    position (COMPLIANCE_CHECKLIST.md §3.1), not decoration, so it ships
 *    in the HTML whether or not anyone clicks.
 *
 * Collapsed content being present but unreachable is exactly what `inert`
 * is for: it drops the panel out of the tab order and hides it from
 * assistive technology, so a keyboard user never tabs into an answer they
 * cannot see. Without it, "in the DOM" would mean "in the tab order",
 * which is a real bug rather than a nicety.
 *
 * === The height transition ===
 *
 * grid-template-rows 0fr -> 1fr, not max-height. max-height needs an
 * invented ceiling: too low clips a long answer, too high makes the
 * collapse look like it stalls before anything moves. The grid technique
 * animates to the content's real height with no magic number.
 *
 * Its failure mode is also the right one. A browser that will not
 * interpolate grid-template-rows still applies the end state, so the
 * panel opens and closes correctly and only the smoothness is lost -
 * which is the same outcome a reduced-motion visitor gets deliberately.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqAccordionProps {
  items: readonly FaqItem[];
}

/** §5: kort, 150-200ms, geen bounce. Plain ease-out, matching DESIGN_SPEC §5's language. */
const TRANSITION = "180ms ease-out";

function Chevron({ open, animate }: { open: boolean; animate: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="text-text-faint h-4 w-4 shrink-0"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: animate ? `transform ${TRANSITION}` : undefined,
      }}
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const baseId = useId();
  const [openIndexes, setOpenIndexes] = useState<ReadonlySet<number>>(new Set());
  const reducedMotion = useReducedMotion();

  function toggle(index: number) {
    setOpenIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <dl className="flex flex-col">
      {items.map((item, index) => {
        const open = openIndexes.has(index);
        const buttonId = `${baseId}-vraag-${index}`;
        const panelId = `${baseId}-antwoord-${index}`;

        return (
          <div
            key={item.question}
            className="border-border border-b first:border-t"
          >
            <dt>
              {/*
                A real <button>, which is what makes Enter and Space work
                without a single key handler of our own - and keeps the
                focus ring, the disabled semantics and the AT role
                correct by construction. A div with onClick would have to
                reimplement all of that, and would get it subtly wrong.
              */}
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="focus-visible:ring-accent-ring flex w-full items-center justify-between gap-4 rounded-sm py-5 text-left transition-colors duration-150 hover:text-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="text-base font-medium">{item.question}</span>
                <Chevron open={open} animate={!reducedMotion} />
              </button>
            </dt>

            <dd
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!open}
              className="grid"
              style={{
                gridTemplateRows: open ? "1fr" : "0fr",
                transition: reducedMotion ? undefined : `grid-template-rows ${TRANSITION}`,
              }}
            >
              {/*
                The inner wrapper carries overflow:hidden. It has to be a
                separate element from the grid container: the clipping
                belongs to the row being sized, not to the grid itself,
                and without it the text would spill out of a 0fr row
                instead of being hidden by it.
              */}
              <div className="overflow-hidden">
                <p className="text-text-muted max-w-prose pb-5 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
