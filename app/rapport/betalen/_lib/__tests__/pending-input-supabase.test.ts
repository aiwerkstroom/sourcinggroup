import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";

/**
 * Isolated unit test for the Supabase-backed pending-input store (fase 4
 * stap 3), driven against a fake client.
 *
 * WHAT THIS PROVES, AND WHAT IT CANNOT. It proves this adapter's own
 * logic: which table and columns it addresses, that camelCase maps to
 * snake_case in one direction and back in the other, that expiry is
 * enforced on read rather than trusted to the sweep, that a failed write
 * throws while a failed cleanup does not, and that take() consumes.
 *
 * It proves NOTHING about Supabase. The client is a fake; no query is
 * parsed, no column is validated, no RLS policy is evaluated, no network
 * call happens. Whether pending_inputs exists with these columns, whether
 * the service role gets past RLS, whether jsonb round-trips WizardData
 * unchanged - all of that is a live-environment question, and this file
 * cannot and does not answer it. The sandbox blocks *.supabase.co
 * outright, so that is the ceiling here, not a choice.
 *
 * The fake is deliberately literal about the call chain
 * (.from().select().eq().maybeSingle() and friends) rather than a loose
 * stub: a chain that changes shape should fail here, since the chain is
 * precisely the part hand-written against the SDK's documented surface
 * and therefore the part most likely to be wrong.
 */

const { getServerSupabaseClient } = vi.hoisted(() => ({
  getServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({ getServerSupabaseClient }));

const { PENDING_TTL_MS } = await import("../pending-input");
const { readPendingInput, storePendingInput, sweepExpiredPendingInputs, takePendingInput } =
  await import("../pending-input-supabase");

const TABLE = "pending_inputs";

interface Row {
  token: string;
  data: WizardData;
  payment_intent_id: string;
  expires_at: string;
}

interface Call {
  op: "insert" | "select" | "delete";
  table: string;
  filter?: { method: string; column: string; value: string };
  values?: Row;
}

/**
 * A fake standing in for the query-builder chain. Records every call so a
 * test can assert on the shape of what was asked for, not merely on what
 * came back.
 */
function makeFakeClient(options: {
  rows?: Row[];
  selectError?: string;
  insertError?: string;
  deleteError?: string;
} = {}) {
  const rows = options.rows ?? [];
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      return {
        insert(values: Row) {
          calls.push({ op: "insert", table, values });
          if (options.insertError !== undefined) {
            return Promise.resolve({ error: { message: options.insertError } });
          }
          rows.push(values);
          return Promise.resolve({ error: null });
        },
        select(_columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                maybeSingle() {
                  calls.push({ op: "select", table, filter: { method: "eq", column, value } });
                  if (options.selectError !== undefined) {
                    return Promise.resolve({
                      data: null,
                      error: { message: options.selectError },
                    });
                  }
                  const found = rows.find((row) => row.token === value) ?? null;
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
              const result = record("eq", column, value);
              if (options.deleteError === undefined) {
                const index = rows.findIndex((row) => row.token === value);
                if (index >= 0) rows.splice(index, 1);
              }
              return result;
            },
            lte(column: string, value: string) {
              const result = record("lte", column, value);
              if (options.deleteError === undefined) {
                const cutoff = Date.parse(value);
                for (let i = rows.length - 1; i >= 0; i -= 1) {
                  if (Date.parse(rows[i]!.expires_at) <= cutoff) rows.splice(i, 1);
                }
              }
              return result;
            },
          };
        },
      };
    },
  };

  return { client, calls, rows };
}

const wizardData = { pand: { address: "Calle Ejemplo 12, Valencia" } } as unknown as WizardData;

function use(fake: ReturnType<typeof makeFakeClient>) {
  getServerSupabaseClient.mockReturnValue(fake.client);
  return fake;
}

beforeEach(() => {
  getServerSupabaseClient.mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("storePendingInput", () => {
  it("writes one row to pending_inputs with the columns the migration declares", async () => {
    const fake = use(makeFakeClient());
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" });

    const insert = fake.calls.find((call) => call.op === "insert");
    expect(insert).toBeDefined();
    expect(insert!.table).toBe(TABLE);
    expect(Object.keys(insert!.values!).sort()).toEqual([
      "data",
      "expires_at",
      "payment_intent_id",
      "token",
    ]);
    expect(insert!.values!.token).toBe(token);
    expect(insert!.values!.payment_intent_id).toBe("pi_test_1");
    expect(insert!.values!.data).toEqual(wizardData);
  });

  it("returns an opaque token, not anything derived from the input", async () => {
    use(makeFakeClient());
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" });

    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(token).not.toContain("pi_test_1");
    expect(JSON.stringify(wizardData)).not.toContain(token);
  });

  it("sets expires_at exactly PENDING_TTL_MS ahead, as an ISO timestamp", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-18T12:00:00.000Z");
    vi.setSystemTime(now);

    const fake = use(makeFakeClient());
    await storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" });

    const insert = fake.calls.find((call) => call.op === "insert")!;
    expect(insert.values!.expires_at).toBe(
      new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
    );
  });

  it("throws when the write fails - the customer must not pay for input that was never stored", async () => {
    use(makeFakeClient({ insertError: "duplicate key" }));
    await expect(
      storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" }),
    ).rejects.toThrow(/Could not store pending input: duplicate key/);
  });
});

describe("readPendingInput", () => {
  it("reads back what was stored, mapped from snake_case to PendingInput", async () => {
    const fake = use(makeFakeClient());
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" });

    const entry = await readPendingInput(token);
    expect(entry).not.toBeNull();
    expect(entry!.paymentIntentId).toBe("pi_test_1");
    expect(entry!.data).toEqual(wizardData);
    expect(typeof entry!.expiresAt).toBe("number");

    const select = fake.calls.find((call) => call.op === "select")!;
    expect(select.filter).toEqual({ method: "eq", column: "token", value: token });
  });

  it("returns null for a token that does not exist", async () => {
    use(makeFakeClient());
    expect(await readPendingInput("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("does not consume - a second read still finds the entry", async () => {
    use(makeFakeClient());
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" });

    expect(await readPendingInput(token)).not.toBeNull();
    expect(await readPendingInput(token)).not.toBeNull();
  });

  it("treats an expired row as absent, even before any sweep has removed it", async () => {
    const expired: Row = {
      token: "11111111-1111-1111-1111-111111111111",
      data: wizardData,
      payment_intent_id: "pi_test_1",
      // One millisecond in the past: expiry is enforced on read, not
      // merely swept eventually.
      expires_at: new Date(Date.now() - 1).toISOString(),
    };
    const fake = use(makeFakeClient({ rows: [expired] }));

    expect(await readPendingInput(expired.token)).toBeNull();
    // ...and it cleans the row up while it is there.
    expect(fake.calls.some((c) => c.op === "delete" && c.filter?.value === expired.token)).toBe(
      true,
    );
  });

  it("throws on a read error rather than reporting the entry as missing", async () => {
    // The distinction matters: null means "no such token" and would make
    // the release step refuse a report the customer already paid for.
    use(makeFakeClient({ selectError: "connection reset" }));
    await expect(readPendingInput("any-token")).rejects.toThrow(
      /Could not read pending input: connection reset/,
    );
  });
});

describe("takePendingInput", () => {
  it("returns the entry and deletes the row, so one token releases one report", async () => {
    const fake = use(makeFakeClient());
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_test_1" });

    const first = await takePendingInput(token);
    expect(first).not.toBeNull();
    expect(first!.paymentIntentId).toBe("pi_test_1");

    expect(
      fake.calls.some(
        (call) => call.op === "delete" && call.filter?.column === "token" && call.filter.value === token,
      ),
    ).toBe(true);
    expect(await takePendingInput(token)).toBeNull();
  });

  it("still returns the entry when the cleanup delete fails - a paid report is not withheld over a failed delete", async () => {
    const row: Row = {
      token: "22222222-2222-2222-2222-222222222222",
      data: wizardData,
      payment_intent_id: "pi_test_9",
      expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    };
    use(makeFakeClient({ rows: [row], deleteError: "permission denied" }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const entry = await takePendingInput(row.token);
    expect(entry).not.toBeNull();
    expect(entry!.paymentIntentId).toBe("pi_test_9");
    expect(consoleError).toHaveBeenCalled();
  });

  it("returns null for an unknown token without attempting a delete", async () => {
    const fake = use(makeFakeClient());
    expect(await takePendingInput("33333333-3333-3333-3333-333333333333")).toBeNull();
    expect(fake.calls.some((call) => call.op === "delete")).toBe(false);
  });
});

describe("sweepExpiredPendingInputs - the retention mechanism (COMPLIANCE_CHECKLIST.md §2.2)", () => {
  it("deletes by expires_at <= now, the same predicate the SQL function uses", async () => {
    const now = Date.parse("2026-08-18T12:00:00.000Z");
    const fake = use(makeFakeClient());

    await sweepExpiredPendingInputs(now);

    const del = fake.calls.find((call) => call.op === "delete")!;
    expect(del.table).toBe(TABLE);
    expect(del.filter).toEqual({
      method: "lte",
      column: "expires_at",
      value: new Date(now).toISOString(),
    });
  });

  it("removes expired rows and leaves live ones", async () => {
    const now = Date.now();
    const expired: Row = {
      token: "44444444-4444-4444-4444-444444444444",
      data: wizardData,
      payment_intent_id: "pi_old",
      expires_at: new Date(now - 60_000).toISOString(),
    };
    const live: Row = {
      token: "55555555-5555-5555-5555-555555555555",
      data: wizardData,
      payment_intent_id: "pi_new",
      expires_at: new Date(now + PENDING_TTL_MS).toISOString(),
    };
    const fake = use(makeFakeClient({ rows: [expired, live] }));

    await sweepExpiredPendingInputs(now);

    expect(fake.rows.map((row) => row.token)).toEqual([live.token]);
  });

  it("swallows a sweep failure - housekeeping must never fail a customer's request", async () => {
    use(makeFakeClient({ deleteError: "statement timeout" }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sweepExpiredPendingInputs(Date.now())).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("the adapter matches the in-memory store it replaces", () => {
  it("exports the same three functions, with the same names", async () => {
    const memory = await import("../pending-input");
    const supabase = await import("../pending-input-supabase");

    for (const name of ["storePendingInput", "readPendingInput", "takePendingInput"] as const) {
      expect(typeof supabase[name]).toBe("function");
      expect(typeof memory[name]).toBe("function");
      // Same arity, so a call site cannot compile against one and break
      // against the other.
      expect(supabase[name].length).toBe(memory[name].length);
    }
  });

  it("re-exports the cookie name and TTL, so a swap changes no other module", async () => {
    const memory = await import("../pending-input");
    const supabase = await import("../pending-input-supabase");

    expect(supabase.PENDING_INPUT_COOKIE).toBe(memory.PENDING_INPUT_COOKIE);
    expect(supabase.PENDING_TTL_MS).toBe(memory.PENDING_TTL_MS);
  });
});
