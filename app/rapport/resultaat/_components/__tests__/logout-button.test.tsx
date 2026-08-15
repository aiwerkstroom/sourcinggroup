// @vitest-environment jsdom

/**
 * Golden test for LogoutButton (fase 4 stap 4's addendum): be signed in,
 * click the logout button, verify the session cookie is gone and the
 * redirect to / happened - the exact check this task named.
 *
 * Seeds a real session through supabase-mock.ts's own signUp() (not a
 * hand-built cookie) so the starting state is genuine, then checks
 * document.cookie directly afterwards rather than only trusting
 * useAuth()'s own state - the point is that the cookie itself is gone,
 * which is what middleware.ts's session check actually reads.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/lib/auth/useAuth";
import * as mockAuth from "@/lib/auth/supabase-mock";
import { LogoutButton } from "../logout-button";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
  document.cookie = "tsg-mock-session=; path=/; max-age=0";
});

describe("LogoutButton - golden: signed in, click logout, cookie gone, redirected to /", () => {
  it("clears the session cookie and redirects to / on click", async () => {
    await mockAuth.signUp("logout-golden@example.com", "wachtwoord123");
    expect(document.cookie).toContain("tsg-mock-session=");

    render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Uitloggen" }));
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));

    // The cookie clear sets an empty value with max-age=0, which jsdom
    // (like a real browser) drops from document.cookie entirely - so
    // "not present at all" is the correct assertion, not "present but empty".
    expect(document.cookie).not.toContain("tsg-mock-session=");
    expect(await mockAuth.getSession()).toBeNull();
  });
});
