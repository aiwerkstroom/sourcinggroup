import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { SESSION_COOKIE } from "@/lib/auth/supabase-mock";

/**
 * Golden test for POST /rapport/betalen/voorbereiden (fase 4 stap 2),
 * driven over real HTTP against a running production server rather than
 * by calling the handler directly - the things worth checking here are
 * the response headers and what does and does not cross the wire, and a
 * direct call would test none of that.
 *
 * Three claims carry the weight:
 *
 * 1. The validation gate holds. Reordering the flow moved runEngine()
 *    after the payment, and with it the cross-field validation that used
 *    to fail at the exit step for free. The licence/short-term
 *    combination below is the exact case build-engine-input.test.ts pins
 *    as one runEngine() refuses - so if this route lets it through, a
 *    customer pays EUR 49 and only then learns their report cannot be
 *    computed. It must come back 400.
 * 2. Nothing sensitive crosses back. The address and the financial
 *    figures went up in the body; what returns is a client secret and an
 *    amount, and the token that reaches the input lives in an httpOnly
 *    cookie, not in the JSON and not in a URL.
 * 3. The cookie is set with the flags the design depends on - httpOnly so
 *    no script can read or forge it, and SameSite=Lax rather than Strict
 *    so a customer returning from a redirect-based payment method still
 *    carries it.
 *
 * Same weight and preconditions as fase 3's pdf-export.test.ts: needs a
 * production build to already exist, and spawns `next start` on its own
 * port so it can run alongside the other server-backed tests.
 */

const PORT = 3179;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 60_000;

/** A complete, computable case - the shape a customer would have typed into the four steps. */
const validCase: WizardData = {
  pand: {
    address: "Carrer de Sant Vicent 40, Valencia",
    neighborhood: "__other__",
    propertyType: "",
    units: "",
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
    communityFeesAnnual: "900",
    cadastralSuelo: "",
    cadastralConstruccion: "",
    currentRentStatus: "",
    currentRentMonthly: "",
    hasTouristRentalLicense: "yes",
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
    rentalStrategy: "hybrid",
    rentPerM2LongTerm: "17",
    rentPerM2ShortTerm: "36",
    rentFromActualCurrentRent: "",
    rentPrefilled: true,
  },
  exit: {
    sellingCommissionPercent: "4",
    municipalCapitalGainsTax: "3.500",
  },
  listingOrigin: null,
};

/**
 * Assembles fine, then fails the engine's own cross-field rule: no
 * tourist licence, but a short-term strategy. The permit gate
 * (MODEL_SPEC.md's título habilitante) lives in validateEngineInput, so
 * this is precisely the class of problem that would otherwise surface
 * only after payment.
 */
const invalidCrossFieldCase: WizardData = {
  ...validCase,
  staatEnLasten: { ...validCase.staatEnLasten, hasTouristRentalLicense: "no" },
  belegger: { ...validCase.belegger, rentalStrategy: "shortTerm" },
};

/** Unparseable rather than contradictory - buildEngineInput's own failure mode. */
const unparseableCase: WizardData = {
  ...validCase,
  pand: { ...validCase.pand, purchasePrice: "" },
};

/**
 * This route sits under /rapport, so middleware.ts requires a session.
 * Same approach as pdf-export.test.ts: middleware only checks the
 * cookie's presence and shape, and supabase-mock.ts's signUp()/signIn()
 * are client-only, so a hand-built cookie in the format they would have
 * set is both sufficient and the only option from a Node-side test.
 */
function sessionCookie(): string {
  const value = encodeURIComponent(
    JSON.stringify({ id: "prepare-test-user", email: "prepare-test@example.com" }),
  );
  return `${SESSION_COOKIE}=${value}`;
}

async function post(body: unknown, options: { withSession?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.withSession !== false) headers.Cookie = sessionCookie();

  return fetch(`${BASE_URL}/rapport/betalen/voorbereiden`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  });
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
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives the prepare route through a real `next start` server.",
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

describe("POST /rapport/betalen/voorbereiden - opening a payment", () => {
  it("returns a client secret and the report price for a computable case", async () => {
    const response = await post(validCase);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.clientSecret).toMatch(/^pi_[0-9a-f]{24}_secret_[0-9a-f]{24}$/);
    expect(body.amount).toBe(4900);
    expect(body.currency).toBe("eur");
  });

  it("sets the pending-input token in an httpOnly, lax, path-wide cookie", async () => {
    const response = await post(validCase);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain("tsg-pending-report=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=1800");
  });

  it("keeps the address and the figures out of the response entirely", async () => {
    const response = await post(validCase);
    const raw = await response.text();

    expect(raw).not.toContain("Sant Vicent");
    expect(raw).not.toContain("330.000");
    expect(raw).not.toContain("330000");
    expect(raw).not.toContain("115.000");

    // The token is the browser's only handle on that input, and it
    // belongs in the cookie alone - never in a body a script could read.
    const token = /tsg-pending-report=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];
    expect(token).toBeDefined();
    expect(raw).not.toContain(token!);
  });

  it("gives each request its own intent and its own token", async () => {
    const [first, second] = await Promise.all([post(validCase), post(validCase)]);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(firstBody.clientSecret).not.toBe(secondBody.clientSecret);
    expect(first.headers.get("set-cookie")).not.toBe(second.headers.get("set-cookie"));
  });
});

describe("the validation gate - nobody pays for a report that cannot be computed", () => {
  it("refuses a cross-field failure with 400 and the engine's own issues", async () => {
    const response = await post(invalidCrossFieldCase);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues.join(" ")).toMatch(/t[ií]tulo habilitante/i);
  });

  it("opens no payment and hands out no token when validation fails", async () => {
    const response = await post(invalidCrossFieldCase);

    expect(response.headers.get("set-cookie")).toBeNull();
    const raw = await response.text();
    expect(raw).not.toContain("_secret_");
  });

  it("refuses unparseable input with the offending field named", async () => {
    const response = await post(unparseableCase);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.issues.join(" ")).toContain("purchasePrice");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a malformed body without crashing", async () => {
    const response = await post("this is not json");
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.issues).toEqual(["Ongeldige aanvraag."]);
  });
});

describe("the route is behind the session gate like the rest of /rapport", () => {
  it("redirects an unauthenticated request to signin instead of opening a payment", async () => {
    const response = await post(validCase, { withSession: false });

    expect(response.status).toBe(307);
    // Resolved against the base rather than parsed on its own: middleware
    // answers with a relative Location here, and either form is valid.
    const location = new URL(response.headers.get("location")!, BASE_URL);
    expect(location.pathname).toBe("/auth/signin");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
