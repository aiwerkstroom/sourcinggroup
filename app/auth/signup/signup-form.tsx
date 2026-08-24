"use client";

/**
 * Sign-up form (fase 4 stap 3). Client component - useAuth() needs the
 * AuthProvider React context. Split out from page.tsx (the live Auth
 * swap task) so page.tsx can stay a Server Component - see page.tsx's
 * own docstring for why that split exists.
 *
 * On success, redirects to /rapport/nieuw - the paid wizard's own entry
 * point, which already redirects to its first step (WIZARD_STEPS[0]).
 * That is the thing an account exists for right now (UI_SPEC.md §2:
 * "Betaald rapport: account vereist"); the free indication still needs
 * none.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { AuthField } from "../_components/fields";
import { Card } from "../_components/card";
import { Spinner } from "../_components/spinner";

export function SignUpForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signUp(email, password);
    setSubmitting(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    router.push("/rapport/nieuw");
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <div className="mx-auto max-w-md">
        <header className="mb-8">
          <p className="text-text-faint text-xs tracking-widest uppercase">Account aanmaken</p>
          <h1 className="mt-1 text-xl font-semibold">Nieuw account</h1>
        </header>

        <Card>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
            <AuthField
              label="E-mailadres"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />
            <AuthField
              label="Wachtwoord"
              type="password"
              autoComplete="new-password"
              hint="Minstens 8 tekens."
              value={password}
              onChange={setPassword}
            />
            {error !== null ? (
              <p role="alert" className="text-signal-negative text-sm">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="bg-accent text-surface focus-visible:ring-accent-ring flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {submitting ? <Spinner /> : null}
              {submitting ? "Bezig met aanmaken…" : "Account aanmaken"}
            </button>
          </form>
        </Card>

        <p className="text-text-muted mt-6 text-sm">
          Heeft u al een account?{" "}
          <Link
            href="/auth/signin"
            className="text-accent focus-visible:ring-accent-ring rounded-sm underline transition-colors hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
