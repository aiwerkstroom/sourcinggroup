// @vitest-environment jsdom

/**
 * Golden test for the site-wide navigation bar.
 *
 * The check that carries real weight is the /zoeken one: that route
 * (pijler 2, SOURCING_SPEC.md) had no link anywhere in the interface
 * before this bar existed, so sourcing was reachable only by typing the
 * URL. This file pins that it is now linked; the route-level test in
 * app/__tests__/site-nav-navigation.test.ts proves the link actually
 * works against a real server.
 *
 * The print-route exclusion is the other one worth pinning rather than
 * trusting to a comment. /rapport/resultaat/print is what Playwright
 * navigates to inside the PDF pipeline, so a nav bar rendered there ends
 * up printed into the customer's PDF.
 *
 * SiteNav needs both usePathname() and useAuth(). The router hook is
 * mocked per test (there is no real router outside the Next.js app tree,
 * the same reason the auth page tests mock useRouter); the auth half is
 * the real AuthProvider over the real in-memory backend, which
 * vitest.setup.ts already selects for the whole suite.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/auth-contract";
import { AuthProvider } from "@/lib/auth/useAuth";
import { SITE_NAV_LINKS, SiteNav } from "../site-nav";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

function renderAt(pathname: string) {
  pathnameMock.mockReturnValue(pathname);
  return render(
    <AuthProvider authStoreOverride="memory">
      <SiteNav />
    </AuthProvider>,
  );
}

function hrefOf(name: string | RegExp): string | null {
  return screen.getByRole("link", { name }).getAttribute("href");
}

beforeEach(() => {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  pathnameMock.mockReturnValue("/");
});

describe("the four destinations", () => {
  it("links all four, /zoeken among them - the route that had no entry point at all before", () => {
    renderAt("/");

    expect(hrefOf("Home")).toBe("/");
    expect(hrefOf("Gratis indicatie")).toBe("/gratis");
    expect(hrefOf("Betaald rapport")).toBe("/rapport/nieuw");
    // The one this bar exists for.
    expect(hrefOf("Zoeken")).toBe("/zoeken");
  });

  it("the exported link list is what actually renders, so the two cannot drift", () => {
    renderAt("/");
    for (const link of SITE_NAV_LINKS) {
      expect(hrefOf(link.label), `${link.label} must point at ${link.href}`).toBe(link.href);
    }
  });

  it("is a labelled landmark, so it is skippable and findable", () => {
    renderAt("/");
    expect(screen.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeInTheDocument();
  });
});

describe("the account button", () => {
  it("invites a signed-out visitor to log in, styled as DESIGN_SPEC.md §4's primary button", () => {
    renderAt("/");
    const button = screen.getByRole("link", { name: "Inloggen" });
    expect(button.getAttribute("href")).toBe("/auth/signin");
    expect(button.className).toContain("bg-accent");
  });

  it("does not invite an already signed-in visitor to log in again", async () => {
    const { signUp } = await import("@/lib/auth/auth-memory");
    await signUp("site-nav-signed-in@example.com", "wachtwoord123");

    renderAt("/");

    expect(await screen.findByRole("link", { name: "Mijn rapporten" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inloggen" })).toBeNull();
  });
});

describe("marking the current section", () => {
  it("marks exactly one link aria-current, and it is the one being visited", () => {
    renderAt("/zoeken");

    const current = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]!).toHaveTextContent("Zoeken");
  });

  it("marks Home only on Home - a prefix match would light it up everywhere", () => {
    // Every path starts with "/", so this is the one link that needs an
    // exact match rather than a prefix one.
    renderAt("/gratis");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Gratis indicatie" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the section on a deeper page within it", () => {
    renderAt("/rapport/nieuw/pand");
    expect(screen.getByRole("link", { name: "Betaald rapport" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("the print routes render no navigation at all", () => {
  // These are what the PDF pipeline navigates to. Anything rendered here
  // is printed into the customer's PDF.
  it.each(["/rapport/resultaat/print", "/rapport/resultaat/print/abc-123"])(
    "%s renders nothing",
    (pathname) => {
      const { container } = renderAt(pathname);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("still renders on the customer-facing result page, which is not a print route", () => {
    renderAt("/rapport/resultaat");
    expect(screen.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeInTheDocument();
  });
});
