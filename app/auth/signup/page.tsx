/**
 * Sign-up page (fase 4 stap 3). Server Component - see
 * app/auth/signin/page.tsx's identical structure and docstring for why:
 * the force-dynamic export below has to live in a Server Component file,
 * and it exists so app/layout.tsx's read of process.env.TSG_AUTH_STORE is
 * taken fresh per request rather than baked into static HTML.
 */

import { SignUpForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return <SignUpForm />;
}
