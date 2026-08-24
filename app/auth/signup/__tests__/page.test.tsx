// @vitest-environment jsdom

/**
 * Golden test for the sign-up page (fase 4 stap 3): fill in the form,
 * submit, verify the redirect - the check this task named - plus the
 * inline-error path (this task's other explicit requirement, "bij fout:
 * toon foutmelding inline") so both named behaviours are actually
 * verified, not just the happy path.
 *
 * next/navigation's useRouter is mocked (there is no real router in a
 * component rendered outside the Next.js app tree); every other
 * dependency - useAuth(), the Auth backend underneath it - is the real
 * thing, the same AuthProvider the app itself renders. That backend is
 * auth-memory.ts here (vitest.setup.ts sets TSG_AUTH_STORE=memory for the
 * whole suite): there is no live Supabase project reachable from this
 * sandbox to test the real backend against.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/auth-contract";
import { AuthProvider } from "@/lib/auth/useAuth";
import SignUpPage from "../page";

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
    fireEvent.click(screen.getByRole("button", { name: /Account aanmaken/ }));
  });
}

describe("SignUpPage - golden: form filled in, submitted, redirect verified", () => {
  it("redirects to /rapport/nieuw after a successful sign-up", async () => {
    render(
      <AuthProvider>
        <SignUpPage />
      </AuthProvider>,
    );

    await fillAndSubmit("golden-signup@example.com", "geheimzinnig123");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rapport/nieuw"));
  });

  it("shows an inline error and does not redirect when the password is too short", async () => {
    render(
      <AuthProvider>
        <SignUpPage />
      </AuthProvider>,
    );

    await fillAndSubmit("golden-signup-short-pw@example.com", "kort");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("minstens 8 tekens"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows an inline error and does not redirect when the email is already registered", async () => {
    const email = "golden-signup-duplicate@example.com";

    render(
      <AuthProvider>
        <SignUpPage />
      </AuthProvider>,
    );
    await fillAndSubmit(email, "eerstekeer123");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rapport/nieuw"));
    pushMock.mockClear();
    cleanup();

    render(
      <AuthProvider>
        <SignUpPage />
      </AuthProvider>,
    );
    await fillAndSubmit(email, "tweedekeer123");

    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent("bestaat al een account"),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
