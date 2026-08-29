"use client";

/**
 * The site-wide navigation bar, rendered once by app/layout.tsx above
 * every page.
 *
 * WHAT THIS FIXES, beyond looking like a nav bar: /zoeken (pijler 2,
 * SOURCING_SPEC.md) had no link anywhere in the interface. It was
 * reachable only by typing the URL, which means sourcing was effectively
 * invisible to anyone who did not already know it existed. That is the
 * substantive half of this change; the pill styling is the other half.
 *
 * === Client component, and why ===
 *
 * Two reasons, both load-bearing rather than cosmetic:
 *
 *  1. usePathname() - the print routes must not render a nav bar. They
 *     are what Playwright navigates to inside the PDF pipeline
 *     (app/rapport/resultaat/pdf/route.ts), so anything rendered there
 *     ends up printed into the customer's PDF. A website nav bar in a
 *     PDF report is plainly wrong, and app/layout.tsx is a Server
 *     Component that cannot read the path to exclude them.
 *  2. useAuth() - the right-hand button has to say something true. A
 *     signed-in visitor should not be invited to log in.
 *
 * Neither adds anything to the client bundle that was not already there:
 * AuthProvider (and with it auth-client.ts and @supabase/supabase-js) is
 * already mounted on every page by app/layout.tsx, so useAuth() here is
 * free. This file itself imports nothing from lib/rules/es and nothing
 * from any route's private _components folder.
 *
 * === Styling ===
 *
 * The semantic tokens throughout - surface, border, accent, text - so the
 * Yield & Stone palette reached this bar by changing globals.css alone,
 * with no edit here. That is the whole point of naming tokens by role
 * rather than by colour.
 *
 * One deliberate deviation, flagged rather than buried: the pill uses
 * rounded-xl (12px), where DESIGN_SPEC.md §3 caps rounding at rounded-lg
 * (8px). That cap is written under "Kaartstijl" and is about cards; this
 * is a floating nav pill, and 12px was specified for it directly. Every
 * card on the site keeps 8px.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";

/**
 * The print routes, excluded from the nav (see the docstring above). A
 * prefix match, because /rapport/resultaat/print/[token] is the same
 * pipeline as /rapport/resultaat/print.
 */
const PRINT_ROUTE_PREFIX = "/rapport/resultaat/print";

/**
 * The four destinations. /zoeken is the one that had no entry point at
 * all before this bar existed.
 *
 * "Betaald rapport" points at /rapport/nieuw rather than at the first
 * wizard step directly: that route already redirects to WIZARD_STEPS[0],
 * so linking the step would duplicate a decision that lives in one place.
 */
export const SITE_NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/gratis", label: "Gratis indicatie" },
  { href: "/rapport/nieuw", label: "Betaald rapport" },
  { href: "/zoeken", label: "Zoeken" },
];

/**
 * Marks the current section. An exact match for "/", a prefix match for
 * the rest - otherwise "/" would light up on every page, since every path
 * starts with it.
 */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname.startsWith(PRINT_ROUTE_PREFIX)) return null;

  // Signed in, the button stops being an invitation to log in and becomes
  // the way back into the thing an account is for (UI_SPEC.md §2).
  const account = user === null
    ? { href: "/auth/signin", label: "Inloggen" }
    : { href: "/rapport/nieuw", label: "Mijn rapporten" };

  return (
    // The bar floats clear of the page edge rather than running
    // edge-to-edge: the outer padding is the margin around the pill.
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-8 md:pt-6">
      <nav
        aria-label="Hoofdnavigatie"
        className="bg-surface border-border shadow-nav flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border px-4 py-3 md:px-5"
      >
        <Link
          href="/"
          className="focus-visible:ring-accent-ring rounded-sm text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Yield &amp; Stone
        </Link>

        <ul className="order-last flex w-full flex-wrap items-center gap-x-5 gap-y-2 md:order-none md:w-auto md:justify-center">
          {SITE_NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "text-accent focus-visible:ring-accent-ring rounded-sm text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      : "text-text-muted hover:text-accent focus-visible:ring-accent-ring rounded-sm text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* The primary button from DESIGN_SPEC.md §4, unchanged. */}
        <Link
          href={account.href}
          className="bg-accent text-surface focus-visible:ring-accent-ring inline-flex rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {account.label}
        </Link>
      </nav>
    </div>
  );
}
