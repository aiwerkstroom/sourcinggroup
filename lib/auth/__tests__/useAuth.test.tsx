// @vitest-environment jsdom

/**
 * Golden test for useAuth.tsx (fase 4 stap 2). Needs a real DOM (jsdom,
 * scoped to this file only via the directive above - the rest of the
 * suite stays on Vitest's faster default node environment, since nothing
 * else here touches document.cookie or renders interactively): unlike
 * every other test in this project, which renders once via
 * react-dom/server and asserts on the resulting markup, this one exists
 * to prove a stateful React context actually updates in response to an
 * async call, which renderToStaticMarkup cannot exercise at all.
 *
 * The core check is the one this task named: after signUp() runs through
 * the context, the context's own `user` must equal what a call to
 * supabase-mock.ts's getSession() - bypassing the context entirely -
 * independently returns. That is the thing actually worth verifying:
 * not that the context holds *some* user object, but that it is reading
 * and writing the same session the mock itself considers current.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import * as mockAuth from "../supabase-mock";
import { AuthProvider, useAuth } from "../useAuth";

/** Each test brings its own email - supabase-mock.ts's user registry is globalThis-backed and deliberately outlives any one test (see below), so reusing an email across tests would collide with an already-registered account. */
function Probe({ email }: { email: string }) {
  const { user, loading, signUp, signIn, signOut } = useAuth();
  return (
    <div>
      <p data-testid="loading">{loading ? "loading" : "ready"}</p>
      <p data-testid="user-id">{user?.id ?? "none"}</p>
      <p data-testid="user-email">{user?.email ?? "none"}</p>
      <button onClick={() => void signUp(email, "wachtwoord123")}>signup</button>
      <button onClick={() => void signIn(email, "wachtwoord123")}>signin</button>
      <button onClick={() => void signOut()}>signout</button>
    </div>
  );
}

beforeEach(() => {
  // Each test starts from a clean cookie jar - supabase-mock.ts's
  // in-memory user registry persists across tests in the same process
  // (globalThis-backed, by design), but the session itself should not.
  document.cookie = "tsg-mock-session=; path=/; max-age=0";
});

describe("useAuth - context state tracks supabase-mock.ts's own session", () => {
  it("starts with loading true, then settles to no session", async () => {
    render(
      <AuthProvider>
        <Probe email="loading-check@example.com" />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user-id")).toHaveTextContent("none");
  });

  it("signUp() through the context matches supabase-mock.getSession() read directly", async () => {
    render(
      <AuthProvider>
        <Probe email="signup-check@example.com" />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));

    await act(async () => {
      screen.getByRole("button", { name: "signup" }).click();
    });

    await waitFor(() => expect(screen.getByTestId("user-email")).not.toHaveTextContent("none"));

    const contextEmail = screen.getByTestId("user-email").textContent;
    const contextId = screen.getByTestId("user-id").textContent;

    // Bypasses the context entirely - reads the mock's own session
    // straight from the cookie, the same way middleware.ts eventually
    // will, independent of anything the React tree did.
    const directSession = await mockAuth.getSession();

    expect(directSession).not.toBeNull();
    expect(contextEmail).toBe(directSession!.email);
    expect(contextId).toBe(directSession!.id);
  });

  it("signOut() through the context clears the session both in the context and in the mock directly", async () => {
    render(
      <AuthProvider>
        <Probe email="signout-check@example.com" />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));

    await act(async () => {
      screen.getByRole("button", { name: "signup" }).click();
    });
    await waitFor(() => expect(screen.getByTestId("user-email")).not.toHaveTextContent("none"));

    await act(async () => {
      screen.getByRole("button", { name: "signout" }).click();
    });

    await waitFor(() => expect(screen.getByTestId("user-email")).toHaveTextContent("none"));
    expect(await mockAuth.getSession()).toBeNull();
  });

  it("signIn() after signOut() re-establishes the same account's session", async () => {
    const email = "signin-after-signout@example.com";
    render(
      <AuthProvider>
        <Probe email={email} />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));

    await act(async () => {
      screen.getByRole("button", { name: "signup" }).click();
    });
    await waitFor(() => expect(screen.getByTestId("user-email")).not.toHaveTextContent("none"));
    const originalId = screen.getByTestId("user-id").textContent;

    await act(async () => {
      screen.getByRole("button", { name: "signout" }).click();
    });
    await waitFor(() => expect(screen.getByTestId("user-email")).toHaveTextContent("none"));

    await act(async () => {
      screen.getByRole("button", { name: "signin" }).click();
    });
    await waitFor(() => expect(screen.getByTestId("user-email")).toHaveTextContent(email));

    expect(screen.getByTestId("user-id")).toHaveTextContent(originalId!);
    const directSession = await mockAuth.getSession();
    expect(directSession?.id).toBe(originalId);
  });
});

describe("useAuth - called outside AuthProvider", () => {
  it("throws, per this task's own requirement", () => {
    function Bare() {
      useAuth();
      return null;
    }
    expect(() => renderToStaticMarkup(<Bare />)).toThrow(
      "useAuth must be used inside an AuthProvider",
    );
  });
});
