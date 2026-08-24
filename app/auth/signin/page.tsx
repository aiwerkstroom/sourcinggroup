/**
 * Sign-in page (fase 4 stap 3). Server Component, deliberately - the form
 * itself (SignInForm) is a client component, since useAuth() needs the
 * AuthProvider React context, but this file exists to hold the
 * force-dynamic export below, which a "use client" file cannot carry
 * (Next.js silently ignores route segment config exported from a client
 * component - confirmed empirically during the live Auth swap: the route
 * stayed statically prerendered with the export present, no build error
 * either).
 *
 * That export exists for one reason: app/layout.tsx reads
 * process.env.TSG_AUTH_STORE server-side and passes it down to
 * AuthProvider, which decides whether the app talks to the real Supabase
 * backend or the in-memory test double
 * (lib/auth/auth-client.ts's resolveAuthBackend()). A statically
 * prerendered page bakes that env read into HTML the one time
 * `next build` runs; this page needs it fresh on every visit, because the
 * Playwright golden tests spawn their own `next start` with the variable
 * set and expect it to actually reach AuthProvider. Real deploys are
 * unaffected either way - TSG_AUTH_STORE is never set there, so the
 * result is identical to what static prerendering would have produced.
 */

import { SignInForm } from "./signin-form";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <SignInForm />;
}
