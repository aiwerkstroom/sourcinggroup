// @vitest-environment jsdom

/**
 * Golden test for the sign-in page (fase 4 stap 3) - the same shape as
 * signup/__tests__/page.test.tsx: fill in the form, submit, verify the
 * redirect, plus the inline-error path. Each test seeds its own account
 * directly through auth-memory.ts (bypassing the UI - the sign-up flow
 * is not what this file is testing) so signIn() has something real to
 * authenticate against. auth-memory.ts is what the AuthProvider this file
 * renders actually runs on too - vitest.setup.ts sets TSG_AUTH_STORE=memory
 * for the whole suite, since there is no live Supabase project reachable
 * from here to test the real backend against.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/auth-contract";
import * as mockAuth from "@/lib/auth/auth-memory";
import { AuthProvider } from "@/lib/auth/useAuth";
import SignInPage from "../page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
});

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("E-mailadres"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Wachtwoord"), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Inloggen/ }));
  });
}

describe("SignInPage - golden: form filled in, submitted, redirect verified", () => {
  it("redirects to /rapport/nieuw after a successful sign-in to an existing account", async () => {
    const email = "golden-signin@example.com";
    const password = "bestaandwachtwoord123";
    await mockAuth.signUp(email, password);
    // signUp() itself also establishes a session - clear it so this test
    // exercises signIn()'s own path, not signUp()'s leftover cookie.
    await mockAuth.signOut();

    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>,
    );

    await fillAndSubmit(email, password);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rapport/nieuw"));
    const session = await mockAuth.getSession();
    expect(session?.email).toBe(email);
  });

  it("shows an inline error and does not redirect on a wrong password", async () => {
    const email = "golden-signin-wrong-password@example.com";
    await mockAuth.signUp(email, "hetjuistewachtwoord");
    await mockAuth.signOut();

    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>,
    );

    await fillAndSubmit(email, "helemaalfout");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("onjuist"));
    expect(pushMock).not.toHaveBeenCalled();
    expect(await mockAuth.getSession()).toBeNull();
  });

  it("shows an inline error and does not redirect for an account that does not exist", async () => {
    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>,
    );

    await fillAndSubmit("nooit-geregistreerd@example.com", "watdanook123");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("onjuist"));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
