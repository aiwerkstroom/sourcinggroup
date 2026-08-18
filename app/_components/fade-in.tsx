"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../_lib/use-reduced-motion";

/**
 * The homepage's fade-in wrapper (HOMEPAGE_UPGRADE_SPEC.md §1, §2, §3,
 * §6). One component for both triggers the spec names: the hero fades on
 * load because it is the first thing on screen and has nothing to scroll
 * into, everything below it fades as it enters the viewport.
 *
 * A thin client boundary around server-rendered children. Because
 * `children` is passed in as a prop, the content inside stays a Server
 * Component - the cards, the copy and the CTA are still rendered on the
 * server and shipped as HTML. What crosses into the browser bundle is
 * this wrapper and the reduced-motion hook, nothing else. That is what
 * keeps §4.4's "de rest blijft server-rendered" true while sections 1, 2
 * and 5 gain motion.
 *
 * The visual state lives entirely in CSS, keyed off the data-fade
 * attribute (globals.css). This component's only job is deciding when to
 * flip that attribute to "in". Two consequences worth stating, because
 * both are the reason it is built this way:
 *
 *  - A reduced-motion visitor is already at full opacity via a media
 *    query, before this component has run. The hook below then also stops
 *    it from attaching an observer at all - not because the visual would
 *    be wrong otherwise, but because observing something the CSS has
 *    already settled is pointless work.
 *  - Without JavaScript the attribute never flips, which is exactly what
 *    the <noscript> rule in layout.tsx exists to cover.
 *
 * Once faded in, an element stays in. The observer disconnects on first
 * intersection: content that re-hides when scrolled past is a decoration
 * effect, and §1's whole framing is interactivity that does something
 * rather than spectacle.
 */

export interface FadeInProps {
  children: React.ReactNode;
  /**
   * "load" fades as soon as the component mounts (the hero). "scroll"
   * waits until the element enters the viewport - the default, since it
   * is what every section below the fold wants.
   */
  trigger?: "load" | "scroll";
  /**
   * Stagger, in milliseconds. §3 asks for 80-100ms between the three
   * "hoe het werkt" cards so they arrive in sequence rather than as one
   * block. Applied as a transition-delay, not a setTimeout: a delayed
   * timer would still be pending when a reduced-motion visitor should
   * already see the content, whereas the CSS delay is overridden by the
   * same media query that overrides the transition.
   */
  delayMs?: number;
  /** Escape hatch for layout: the wrapper is a div, so it sometimes needs the parent's grid/flex classes. */
  className?: string;
}

export function FadeIn({ children, trigger = "scroll", delayMs = 0, className }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const reducedMotion = useReducedMotion();

  // Derived, not stored. Reduced motion means "already visible", and the
  // CSS media query has put this element at full opacity before any of
  // this ran - so there is no state to update, only a fact to read.
  const visible = shown || reducedMotion;

  useEffect(() => {
    if (visible) return;

    const showNow = () => setShown(true);
    const element = ref.current;

    // Everything that is not "wait for this to scroll into view" resolves
    // through the same immediate path: the hero (nothing to scroll into),
    // a missing ref, and a browser or test environment without
    // IntersectionObserver. That last one matters most - failing towards
    // visible is the only acceptable direction for a fallback that
    // decides whether text can be read at all.
    if (trigger === "load" || element === null || typeof IntersectionObserver !== "function") {
      // Two frames, not a direct call. The element has to be painted at
      // opacity 0 before it is flipped to "in", or the browser coalesces
      // both states into one frame and the transition never runs - the
      // content would appear instantly instead of fading. One frame gets
      // it into the pending paint, the second guarantees that paint
      // happened.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(showNow);
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          showNow();
          observer.disconnect();
        }
      },
      // A small bottom margin so a section begins fading slightly before
      // its top edge is reached, which reads as the page keeping up with
      // the scroll rather than reacting to it.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, trigger]);

  return (
    <div
      ref={ref}
      data-fade={visible ? "in" : ""}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
