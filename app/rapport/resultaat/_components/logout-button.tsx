"use client";

/**
 * Logout button for the paid result page (fase 4 stap 4's own addendum).
 * No loading state - signOut() only clears a cookie (supabase-mock.ts's
 * own docstring: the session lives there, not in a network round trip),
 * so there is nothing worth showing a spinner for.
 *
 * Secondary button variant (DESIGN_SPEC.md's visual pass, step 5): white
 * with a blue border, not the filled primary - this is not the page's
 * main action the way "Download als PDF" arguably is, and two filled
 * buttons side by side would fight for the same attention.
 */

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";

export function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();

  async function handleClick() {
    await signOut();
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="border-accent text-accent focus-visible:ring-accent-ring rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      Uitloggen
    </button>
  );
}
