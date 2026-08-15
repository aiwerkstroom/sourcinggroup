import { randomUUID } from "node:crypto";
import type { EngineResult } from "@/lib/rules/es/types";

/**
 * Hands a real customer's EngineResult from the PDF-generation route
 * (pdf/genereer/route.ts) to the print page it drives Playwright to
 * (print/[token]/page.tsx), without persisting it anywhere (CLAUDE.md
 * §4 - accounts and storage are fase 4, not this one) and without putting
 * financial data or an address in a URL (this task's own instruction -
 * only the opaque token appears there, and only in a request Playwright
 * makes to this same server, never one a customer's browser sees).
 *
 * An in-memory Map, not a database: an entry lives for, at most, the few
 * seconds between the POST route storing it and the print page reading it
 * moments later in the same process, then it is deleted immediately - or
 * after PENDING_TTL_MS regardless, as a safety net if the print page is
 * never reached (a crashed render, a killed request). This only works
 * within a single server process; a multi-instance deployment would need
 * a shared store instead. Fine for now - this app runs as one process,
 * same as the rest of fase 2/3's "nothing persisted" design.
 *
 * The Map lives on globalThis rather than as a plain module-level const:
 * confirmed empirically (not assumed) that Next.js bundles a Route
 * Handler and a Page into separate module graphs even within one
 * `next start` process, so pdf/genereer/route.ts and print/[token]/
 * page.tsx each get their own copy of an ordinary module-scoped variable
 * - a token stored by one is invisible to the other. globalThis is the
 * one thing both bundles' module registries actually share.
 */

interface PendingReport {
  result: EngineResult;
  propertyAddress: string;
}

const PENDING_TTL_MS = 30_000;

const globalKey = Symbol.for("tsg.pendingReports");
type GlobalWithPending = typeof globalThis & { [globalKey]?: Map<string, PendingReport> };
const g = globalThis as GlobalWithPending;
const pending = (g[globalKey] ??= new Map<string, PendingReport>());

export function storePendingReport(report: PendingReport): string {
  const token = randomUUID();
  pending.set(token, report);
  const timer = setTimeout(() => pending.delete(token), PENDING_TTL_MS);
  timer.unref();
  return token;
}

/** Reads and immediately removes the entry - each token is good for exactly one render. */
export function takePendingReport(token: string): PendingReport | null {
  const report = pending.get(token);
  if (report === undefined) return null;
  pending.delete(token);
  return report;
}
