import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentIntent } from "../payment-intent-contract";

/**
 * Isolated unit test for the Supabase-backed payment-intent store, driven
 * against a fake client - the same approach, and deliberately the same
 * shape, as pending-input-supabase.test.ts.
 *
 * WHAT THIS PROVES, AND WHAT IT CANNOT. It proves this adapter's own
 * logic: which table and columns it addresses, that it upserts rather
 * than inserts (an intent is rewritten on every status change, under an
 * id it already has), that expiry is enforced on read rather than
 * trusted to the sweep, that a failed write throws while a failed cleanup
 * does not - and, in the last block, that an intent written by one
 * instance is readable by another that shares no memory with it.
 *
 * It proves NOTHING about Supabase itself. The client is a fake; no query
 * is parsed, no column validated, no RLS policy evaluated, no network
 * call made. Whether payment_intents exists with these columns and
 * whether the service role gets past RLS is a live-environment question
 * this sandbox cannot answer - its egress policy blocks *.supabase.co
 * outright. That is the ceiling here, not a choice.
 */

const { getServerSupabaseClient } = vi.hoisted(() => ({
  getServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({ getServerSupabaseClient }));

const TABLE = "payment_intents";

interface Row {
  id: string;
  data: PaymentIntent;
  expires_at: string;
}

interface Call {
  op: "upsert" | "select" | "delete";
  table: string;
  filter?: { method: string; column: string; value: string };
  values?: Row;
}

function anIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: "pi_abc123",
    client_secret: "pi_abc123_secret_xyz",
    status: "requires_payment_method",
    amount: 4900,
    currency: "eur",
    ...overrides,
  };
}

/**
 * A fake standing in for the query-builder chain, backed by a `rows`
 * array that stands in for the table. Deliberately literal about the
 * chain (.from().select().eq().maybeSingle() and friends) rather than a
 * loose stub: the chain is the part hand-written against the SDK's
 * documented surface, and therefore the part most likely to be wrong.
 *
 * `rows` is accepted from outside so two independently-loaded adapter
 * instances can be pointed at ONE table - which is what makes the
 * cross-invocation test at the bottom mean anything.
 */
function makeFakeClient(
  options: {
    rows?: Row[];
    selectError?: string;
    upsertError?: string;
    deleteError?: string;
  } = {},
) {
  const rows = options.rows ?? [];
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      return {
        upsert(values: Row) {
          calls.push({ op: "upsert", table, values });
          if (options.upsertError !== undefined) {
            return Promise.resolve({ error: { message: options.upsertError } });
          }
          const existing = rows.findIndex((row) => row.id === values.id);
          if (existing === -1) rows.push(values);
          else rows[existing] = values;
          return Promise.resolve({ error: null });
        },
        select(_columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                maybeSingle() {
                  calls.push({
                    op: "select",
                    table,
                    filter: { method: "eq", column, value },
                  });
                  if (options.selectError !== undefined) {
                    return Promise.resolve({
                      data: null,
                      error: { message: options.selectError },
                    });
                  }
                  const found = rows.find((row) => row.id === value) ?? null;
                  return Promise.resolve({ data: found, error: null });
                },
              };
            },
          };
        },
        delete() {
          const record = (method: string, column: string, value: string) => {
            calls.push({ op: "delete", table, filter: { method, column, value } });
            if (options.deleteError !== undefined) {
              return Promise.resolve({ error: { message: options.deleteError } });
            }
            return Promise.resolve({ error: null });
          };
          return {
            eq(column: string, value: string) {
              if (options.deleteError === undefined) {
                const at = rows.findIndex((row) => row.id === value);
                if (at !== -1) rows.splice(at, 1);
              }
              return record("eq", column, value);
            },
            lte(column: string, value: string) {
              if (options.deleteError === undefined) {
                for (let i = rows.length - 1; i >= 0; i -= 1) {
                  if (Date.parse(rows[i]!.expires_at) <= Date.parse(value)) rows.splice(i, 1);
                }
              }
              return record("lte", column, value);
            },
          };
        },
      };
    },
  };

  return { client, calls, rows };
}

/** Loads a FRESH module instance of the adapter, wired to the given client. */
async function loadAdapter(client: unknown) {
  vi.resetModules();
  getServerSupabaseClient.mockReturnValue(client);
  return import("../payment-intent-supabase");
}

beforeEach(() => {
  getServerSupabaseClient.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
});

describe("storePaymentIntent()", () => {
  it("upserts the whole intent as jsonb under its own id, with an expiry", async () => {
    const fake = makeFakeClient();
    const adapter = await loadAdapter(fake.client);
    const intent = anIntent();

    const before = Date.now();
    await adapter.storePaymentIntent(intent);
    const after = Date.now();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.op).toBe("upsert");
    expect(fake.calls[0]!.table).toBe(TABLE);
    expect(fake.calls[0]!.values!.id).toBe("pi_abc123");
    expect(fake.calls[0]!.values!.data).toEqual(intent);

    const { PAYMENT_INTENT_TTL_MS } = await import("../payment-intent-contract");
    const expiresAt = Date.parse(fake.calls[0]!.values!.expires_at);
    expect(expiresAt).toBeGreaterThanOrEqual(before + PAYMENT_INTENT_TTL_MS);
    expect(expiresAt).toBeLessThanOrEqual(after + PAYMENT_INTENT_TTL_MS);
  });

  it("upserts rather than inserts, so a status change overwrites instead of colliding", async () => {
    // The difference from pending_inputs, and the reason this adapter
    // cannot copy that one verbatim: a pending input is written once under
    // a fresh token; an intent is rewritten on every status change under
    // the id it already has, and insert would hit the primary key.
    const fake = makeFakeClient();
    const adapter = await loadAdapter(fake.client);

    await adapter.storePaymentIntent(anIntent());
    await adapter.storePaymentIntent(anIntent({ status: "succeeded" }));

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0]!.data.status).toBe("succeeded");
  });

  it("throws when the write fails - the customer must not reach a payment page for an intent that exists nowhere", async () => {
    const fake = makeFakeClient({ upsertError: "permission denied" });
    const adapter = await loadAdapter(fake.client);

    await expect(adapter.storePaymentIntent(anIntent())).rejects.toThrow(
      /Could not store payment intent: permission denied/,
    );
  });
});

describe("readPaymentIntent()", () => {
  it("returns the stored intent, addressed by id on the right table", async () => {
    const fake = makeFakeClient();
    const adapter = await loadAdapter(fake.client);
    await adapter.storePaymentIntent(anIntent());

    expect(await adapter.readPaymentIntent("pi_abc123")).toEqual(anIntent());
    const select = fake.calls.find((call) => call.op === "select")!;
    expect(select.table).toBe(TABLE);
    expect(select.filter).toEqual({ method: "eq", column: "id", value: "pi_abc123" });
  });

  it("returns null for an id that is not there", async () => {
    const fake = makeFakeClient();
    const adapter = await loadAdapter(fake.client);
    expect(await adapter.readPaymentIntent("pi_nope")).toBeNull();
  });

  it("treats an expired row as absent and deletes it, rather than waiting for the sweep", async () => {
    const expired: Row = {
      id: "pi_old",
      data: anIntent({ id: "pi_old" }),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    const fake = makeFakeClient({ rows: [expired] });
    const adapter = await loadAdapter(fake.client);

    expect(await adapter.readPaymentIntent("pi_old")).toBeNull();
    expect(fake.calls.some((call) => call.op === "delete" && call.filter?.method === "eq")).toBe(
      true,
    );
  });

  it("throws on a read failure instead of reporting the intent missing", async () => {
    // The distinction that protects a paying customer: "the database is
    // unreachable" must not reach the release route as "this payment does
    // not exist", or it refuses a report someone has already paid for.
    const fake = makeFakeClient({ selectError: "connection reset" });
    const adapter = await loadAdapter(fake.client);

    await expect(adapter.readPaymentIntent("pi_abc123")).rejects.toThrow(
      /Could not read payment intent: connection reset/,
    );
  });
});

describe("writePaymentIntentStatus()", () => {
  it("persists the new status and hands back the updated intent", async () => {
    const fake = makeFakeClient();
    const adapter = await loadAdapter(fake.client);
    await adapter.storePaymentIntent(anIntent());

    const updated = await adapter.writePaymentIntentStatus("pi_abc123", "succeeded");

    expect(updated!.status).toBe("succeeded");
    // Everything else on the intent survives the status change.
    expect(updated!.client_secret).toBe("pi_abc123_secret_xyz");
    expect(updated!.amount).toBe(4900);
    expect((await adapter.readPaymentIntent("pi_abc123"))!.status).toBe("succeeded");
  });

  it("returns null for an intent that is not there, rather than inventing one", async () => {
    const fake = makeFakeClient();
    const adapter = await loadAdapter(fake.client);
    expect(await adapter.writePaymentIntentStatus("pi_nope", "succeeded")).toBeNull();
    expect(fake.rows).toHaveLength(0);
  });
});

describe("sweepExpiredPaymentIntents() - housekeeping never breaks a payment", () => {
  it("deletes by expires_at", async () => {
    const fake = makeFakeClient({
      rows: [
        { id: "pi_old", data: anIntent({ id: "pi_old" }), expires_at: new Date(Date.now() - 1).toISOString() },
        { id: "pi_new", data: anIntent({ id: "pi_new" }), expires_at: new Date(Date.now() + 60_000).toISOString() },
      ],
    });
    const adapter = await loadAdapter(fake.client);

    await adapter.sweepExpiredPaymentIntents();

    expect(fake.rows.map((row) => row.id)).toEqual(["pi_new"]);
    expect(fake.calls.at(-1)!.filter!.method).toBe("lte");
    expect(fake.calls.at(-1)!.filter!.column).toBe("expires_at");
  });

  it("swallows a database error instead of throwing - a cleanup must not fail a payment", async () => {
    const fake = makeFakeClient({ deleteError: "timeout" });
    const adapter = await loadAdapter(fake.client);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(adapter.sweepExpiredPaymentIntents()).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("expiry sweep failed"));

    logged.mockRestore();
  });
});

/**
 * THE TEST THIS WHOLE CHANGE EXISTS FOR.
 *
 * The live bug was not a logic error - every unit test passed while
 * customers were being bounced back to step 1 of the wizard. It was a
 * TOPOLOGY error: on Vercel, /rapport/betalen/voorbereiden (which creates
 * an intent) and /rapport/betalen (which reads it back) build as separate
 * Serverless Functions, so they share no memory. The whole suite missed
 * it because `next start` runs every route in ONE process, where the
 * globalThis Map genuinely is shared.
 *
 * So the property worth pinning is not "the adapter can read what it
 * wrote" - the Map could do that too. It is "a SECOND instance, holding
 * none of the first one's memory, can read what the FIRST one wrote".
 * Both blocks below set up exactly that topology and differ only in which
 * store is under it.
 *
 * How the topology is built, and what it does and does not model:
 * vi.resetModules() plus a re-import gives a genuinely separate module
 * instance - its own module-level state, its own memoised client - which
 * is what a fresh invocation gets. For the memory adapter the globalThis
 * keys are cleared as well, because a fresh process starts with an empty
 * globalThis and keeping the old Map would model one process, not two.
 * What this does NOT model is a real process boundary or a real database;
 * the shared `rows` array stands in for the table. The claim is about the
 * adapter's dependence on process memory, and that is what it measures.
 */
describe("cross-invocation durability - the property the live bug violated", () => {
  const MEMORY_KEYS = [
    Symbol.for("tsg.mockPaymentIntents"),
    Symbol.for("tsg.mockPaymentIntentExpiry"),
  ];

  /** What a cold Vercel invocation starts with: nothing. */
  function freshProcessMemory(): void {
    for (const key of MEMORY_KEYS) {
      delete (globalThis as Record<symbol, unknown>)[key];
    }
  }

  it("the Supabase adapter: instance A writes, instance B reads it back", async () => {
    // One table, two independently-loaded adapters. Nothing but the table
    // connects them.
    const table: Row[] = [];
    const intent = anIntent({ id: "pi_cross", status: "requires_payment_method" });

    const invocationA = makeFakeClient({ rows: table });
    const adapterA = await loadAdapter(invocationA.client);
    await adapterA.storePaymentIntent(intent);

    const invocationB = makeFakeClient({ rows: table });
    const adapterB = await loadAdapter(invocationB.client);

    // B has issued no write of its own and holds none of A's state.
    expect(invocationB.calls).toHaveLength(0);
    expect(adapterB.storePaymentIntent).not.toBe(adapterA.storePaymentIntent);

    expect(await adapterB.readPaymentIntent("pi_cross")).toEqual(intent);
    // And it really came through the database rather than from anywhere else.
    expect(invocationB.calls.some((call) => call.op === "select")).toBe(true);
  });

  it("a status written by one invocation is visible to the next - the release route's whole premise", async () => {
    // Not the same assertion as above: the payment page reads the intent,
    // the payment form confirms it, and the release route then reads the
    // resulting status - three invocations, none sharing memory. If a
    // status change did not survive that, a paid customer would be refused
    // their report.
    const table: Row[] = [];

    const adapterA = await loadAdapter(makeFakeClient({ rows: table }).client);
    await adapterA.storePaymentIntent(anIntent({ id: "pi_paid" }));

    const adapterB = await loadAdapter(makeFakeClient({ rows: table }).client);
    await adapterB.writePaymentIntentStatus("pi_paid", "succeeded");

    const adapterC = await loadAdapter(makeFakeClient({ rows: table }).client);
    expect((await adapterC.readPaymentIntent("pi_paid"))!.status).toBe("succeeded");
  });

  it("the in-memory adapter, under that same topology, loses the intent - this is the live bug", async () => {
    // The negative control, and the reason the two tests above mean
    // something. Without it, a reader cannot tell whether they would also
    // pass against the broken store - which is exactly the blind spot
    // that let this reach production.
    freshProcessMemory();
    vi.resetModules();
    const invocationA = await import("../payment-intent-memory");
    await invocationA.storePaymentIntent(anIntent({ id: "pi_lost" }));
    expect(await invocationA.readPaymentIntent("pi_lost")).not.toBeNull();

    // A new invocation: fresh module instance, fresh process memory.
    freshProcessMemory();
    vi.resetModules();
    const invocationB = await import("../payment-intent-memory");

    expect(await invocationB.readPaymentIntent("pi_lost")).toBeNull();

    freshProcessMemory();
  });
});
