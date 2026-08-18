import type { PendingInput } from "./pending-input-contract";
import * as memory from "./pending-input-memory";
import * as supabase from "./pending-input-supabase";

/**
 * THE SWAP POINT. Every caller in the payment flow imports the pending
 * store from here, so which implementation runs is decided once, in this
 * file, and nowhere else.
 *
 * Since fase 4 stap 3's live swap that is the Supabase adapter: a real
 * table, reachable from every Vercel instance. The in-memory Map it
 * replaced was per-process, and separate invocations are separate
 * processes - so an entry written while preparing a payment was not
 * reliably there when the customer returned from their bank. That was a
 * real, observed failure, not a theoretical one.
 *
 * === Why this is a selection and not a hard re-export ===
 *
 * The route-level golden tests (betalen/__tests__/page.test.ts,
 * voorbereiden/__tests__/route.test.ts) drive a real `next start` server
 * through the actual payment routes, and there is no database behind it.
 * Without a way to run those against the Map, roughly ten genuine tests -
 * "shows the page the input that the prepare route stored", "keeps two
 * payments apart", "reads without consuming" - would have to be deleted
 * outright. They spawn their server with TSG_PENDING_STORE=memory instead.
 *
 * === Why this is NOT the silent fallback that was ruled out ===
 *
 * The rejected design was "use Supabase if configured, else the Map".
 * That fails open: a missing key in production quietly restores the
 * per-process Map, and nobody finds out until a customer has paid and
 * lost their report. This one cannot do that, because the selection does
 * not consult the Supabase configuration at all:
 *
 *   - Nothing set (production, preview, any ordinary run) -> Supabase.
 *     A missing SUPABASE_SERVICE_ROLE_KEY then throws, loudly, on the
 *     first call (lib/supabase/server-client.ts).
 *   - TSG_PENDING_STORE set to anything other than the exact string
 *     "memory" - a typo, a stale value, an empty string -> Supabase, and
 *     the same loud failure. The Map is never the default of a fallthrough.
 *   - Only the exact opt-in reaches the Map, which takes a deliberate act.
 *
 * So the Map is unreachable by omission, and reachable only by intent.
 * __tests__/pending-input-selection.test.ts pins each of those branches.
 */

/**
 * The one string that selects the Map. Exported so the tests that opt in
 * use this constant rather than retyping the literal - a typo in a test's
 * spawn env would otherwise silently give it Supabase and a confusing
 * connection error instead of the store it asked for.
 */
export const MEMORY_STORE_ENV_VALUE = "memory";

/**
 * Read at module load, deliberately. Which store this process talks to is
 * a property of the process, not of the request - re-reading it per call
 * would invite a deploy where two requests in one instance disagree.
 */
const useMemoryStore = process.env.TSG_PENDING_STORE === MEMORY_STORE_ENV_VALUE;

const impl = useMemoryStore ? memory : supabase;

export const storePendingInput = impl.storePendingInput;
export const readPendingInput = impl.readPendingInput;
export const takePendingInput = impl.takePendingInput;

export { PENDING_INPUT_COOKIE, PENDING_TTL_MS } from "./pending-input-contract";
export type { PendingInput };
