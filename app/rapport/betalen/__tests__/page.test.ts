import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { SESSION_COOKIE } from "@/lib/auth/supabase-mock";

/**
 * Golden test for the payment page (fase 4 stap 2, stap 3 van 5), and
 * before anything else for the boundary underneath it.
 *
 * THE BOUNDARY. voorbereiden/route.ts is a Route Handler; this page is a
 * Page. Next.js gives those separate module instances even inside one
 * `next start` process - confirmed empirically in fase 3, where exactly
 * that cost the PDF pipeline its token: the route wrote into one Map and
 * the page read an empty one. pending-input.ts parks its Map on
 * globalThis for that reason, and this file is the first thing that can
 * actually prove it, because this page is the first reader of an entry
 * the route wrote. Everything else here rests on that holding, so it is
 * checked first and checked directly: the address the route was given
 * has to come back out of the page's HTML.
 *
 * Driven over real HTTP against a production server rather than by
 * rendering the component - a component test shares one module instance
 * by construction and would report success no matter what, which is the
 * precise failure mode being guarded against.
 */

const PORT = 3180;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 60_000;

const ADDRESS = "Carrer del Pont de Fusta 12, Valencia";

const validCase: WizardData = {
  pand: {
    address: ADDRESS,
    neighborhood: "__other__",
    purchasePrice: "330.000",
    builtAreaM2: "133",
    usableAreaM2: "133",
    rooms: "7",
    bedrooms: "5",
    bathrooms: "5",
    constructionYear: "1972",
    energyLabel: "B",
  },
  staatEnLasten: {
    maintenanceCondition: "average",
    renovationStrategyOverride: "",
    communityFeesAnnual: "900",
    cadastralSuelo: "",
    cadastralConstruccion: "",
    currentRentStatus: "",
    currentRentMonthly: "",
    hasTouristRentalLicense: "yes",
    hasUpcomingDerramas: false,
    upcomingDerramasAmount: "",
  },
  belegger: {
    ownMoney: "115.000",
    totalBudget: "450.000",
    maxRenovationBudget: "60.000",
    preferredLtvPercent: "75",
    minLtvPercent: "60",
    maxLtvPercent: "75",
    maxMonthlyDebt: "1.000",
    minMonthlyCashflow: "500",
    minRoiTargetPercent: "4",
    holdingYears: "10",
    taxResidency: "netherlands",
    rentalStrategy: "hybrid",
    rentPerM2LongTerm: "17",
    rentPerM2ShortTerm: "36",
    rentFromActualCurrentRent: "",
    rentPrefilled: true,
    occupancyLongTermPercent: "",
    occupancyShortTermPercent: "",
  },
  exit: {
    sellingCommissionPercent: "4",
    municipalCapitalGainsTax: "3.500",
    plusvaliaPrefilled: true,
  },
  listingOrigin: null,
};

function sessionCookie(): string {
  const value = encodeURIComponent(
    JSON.stringify({ id: "betalen-test-user", email: "betalen-test@example.com" }),
  );
  return `${SESSION_COOKIE}=${value}`;
}

/** Runs the real prepare call and hands back the pending token it set. */
async function openPayment(): Promise<{ token: string; clientSecret: string }> {
  const response = await fetch(`${BASE_URL}/rapport/betalen/voorbereiden`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie() },
    body: JSON.stringify(validCase),
  });
  expect(response.status).toBe(200);

  const token = /tsg-pending-report=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];
  expect(token).toBeDefined();

  const body = await response.json();
  return { token: token!, clientSecret: body.clientSecret };
}

async function getPage(cookies: string) {
  return fetch(`${BASE_URL}/rapport/betalen`, { headers: { Cookie: cookies }, redirect: "manual" });
}

async function waitForServer(deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // Not up yet - keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Production server did not become ready on ${BASE_URL} in time`);
}

let server: ChildProcessWithoutNullStreams;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../../../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives the payment page through a real `next start` server.",
    );
  }

  // TSG_PENDING_STORE=memory: this server has no Supabase behind it, and
  // since fase 4 stap 3's live swap pending-input.ts otherwise resolves
  // to the real adapter. The tests below are about the routes and the
  // page, not about which store backs them, so they run on the in-memory
  // one - the explicit opt-in pending-input.ts documents, never a
  // fallback the absence of a key could trigger.
  server = spawn(nextBin, ["start", "-p", String(PORT)], {
    cwd: repoRoot,
    stdio: "pipe",
    env: { ...process.env, TSG_PENDING_STORE: "memory" },
  });
  await waitForServer(Date.now() + START_TIMEOUT_MS);
}, TEST_TIMEOUT_MS);

afterAll(() => {
  server?.kill();
});

describe("the Route Handler -> Page boundary (the fase 3 bug, in the place it would recur)", () => {
  it("shows the page the input that the prepare route stored", async () => {
    const { token } = await openPayment();

    const page = await getPage(`${sessionCookie()}; tsg-pending-report=${token}`);
    expect(page.status).toBe(200);

    const html = await page.text();
    // Written by a Route Handler, read by a Page, in separate module
    // graphs of one process. If globalThis were not carrying the Map,
    // this is where an empty read would surface.
    expect(html).toContain(ADDRESS);
  });

  it("keeps two payments apart rather than serving the most recent one to both", async () => {
    const first = await openPayment();
    const second = await openPayment();
    expect(first.token).not.toBe(second.token);

    const page = await getPage(`${sessionCookie()}; tsg-pending-report=${first.token}`);
    const html = await page.text();

    expect(html).toContain(ADDRESS);
    expect(html).toContain(first.clientSecret);
    expect(html).not.toContain(second.clientSecret);
  });

  it("reads without consuming, so the page survives a refresh before paying", async () => {
    const { token } = await openPayment();
    const cookies = `${sessionCookie()}; tsg-pending-report=${token}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const page = await getPage(cookies);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain(ADDRESS);
    }
  });
});

describe("the payment page - what the customer is asked to pay for", () => {
  it("names the property, the product and the price", async () => {
    const { token } = await openPayment();
    const html = await (await getPage(`${sessionCookie()}; tsg-pending-report=${token}`)).text();

    expect(html).toContain(ADDRESS);
    expect(html).toContain("Wat u afrekent");
    expect(html).toContain("negen secties");
    // Formatted through Intl for nl-NL, which separates the sign from the
    // amount with a non-breaking space.
    expect(html.replace(/\s+/g, " ")).toContain("€ 49");
  });

  it("renders the payment form with its three test outcomes named", async () => {
    const { token } = await openPayment();
    const html = await (await getPage(`${sessionCookie()}; tsg-pending-report=${token}`)).text();

    expect(html).toContain("Betaalgegevens");
    expect(html).toContain("Betaal");
    expect(html).toContain("4242424242424242");
    expect(html).toContain("4000000000000002");
    expect(html).toContain("4000002500003155");
    expect(html).toContain("Testomgeving");
  });

  it("hands the client secret to the browser from the server, not from the prepare call", async () => {
    // A customer returning through a full page load has nothing left
    // client-side; the page still has to know which payment they are on.
    const { token, clientSecret } = await openPayment();
    const html = await (await getPage(`${sessionCookie()}; tsg-pending-report=${token}`)).text();

    expect(html).toContain(clientSecret);
  });

  it("keeps the customer's financial figures off the page - only the address and the price", async () => {
    const { token } = await openPayment();
    const html = await (await getPage(`${sessionCookie()}; tsg-pending-report=${token}`)).text();

    expect(html).not.toContain("115.000");
    expect(html).not.toContain("450.000");
    expect(html).not.toContain("330.000");
  });
});

describe("cold entry", () => {
  it("sends a visitor with no pending payment back to the start of the wizard", async () => {
    const page = await getPage(sessionCookie());

    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location")!, BASE_URL).pathname).toBe("/rapport/nieuw/pand");
  });

  it("sends a visitor with an unknown token back too, rather than showing an empty page", async () => {
    const page = await getPage(
      `${sessionCookie()}; tsg-pending-report=00000000-0000-0000-0000-000000000000`,
    );

    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location")!, BASE_URL).pathname).toBe("/rapport/nieuw/pand");
  });

  it("is behind the session gate like the rest of /rapport", async () => {
    const { token } = await openPayment();
    const page = await getPage(`tsg-pending-report=${token}`);

    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location")!, BASE_URL).pathname).toBe("/auth/signin");
  });
});
