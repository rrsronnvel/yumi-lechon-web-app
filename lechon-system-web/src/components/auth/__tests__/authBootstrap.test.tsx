import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InternalAxiosRequestConfig } from "axios";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import apiClient from "@/services/apiClient";
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "@/services/authSession";

const { loadProtectedLayout, loadDashboard } = vi.hoisted(() => ({
  loadProtectedLayout: vi.fn(),
  loadDashboard: vi.fn(),
}));

vi.mock("@/components/ui/RootLayout", async () => {
  loadProtectedLayout();
  const { Outlet } = await import("react-router-dom");
  return { default: () => <main data-testid="app-shell"><Outlet /></main> };
});

vi.mock("@/pages/DashboardPage", () => {
  loadDashboard();
  return { default: () => <h1>Authenticated Dashboard</h1> };
});

const jwt = (exp: number) => {
  const encode = (content: string) => btoa(content).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return [encode('{"alg":"HS256"}'), encode(JSON.stringify({ exp })), encode("test signature")].join(".");
};

describe("Web auth bootstrap", () => {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({ config, status: 200, statusText: "OK", headers: {}, data: {} }));
  const originalAdapter = apiClient.defaults.adapter;
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    localStorage.clear();
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ username: "staff", fullName: "Staff", role: "Cashier" }));
    window.history.replaceState({}, "", "/");
    adapter.mockClear();
    apiClient.defaults.adapter = adapter;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    apiClient.defaults.adapter = originalAdapter;
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
    });
  }

  it.each([
    ["no token", (): null => null],
    ["an expired JWT", (): string => jwt(Math.floor(Date.now() / 1000) - 60)],
    ["a malformed JWT", (): string => "bad.token.value"],
  ] as const)("redirects / straight to sign-in with %s", async (_label, getToken) => {
    const token = getToken();
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);

    await render();

    expect(window.location.pathname).toBe("/login");
    expect(container.textContent).toContain("Shift Sign-In");
    expect(container.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(loadProtectedLayout).not.toHaveBeenCalled();
    expect(loadDashboard).not.toHaveBeenCalled();
    expect(adapter).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it("blocks stray authenticated requests locally while allowing public QR and login requests", async () => {
    await expect(apiClient.get("/dashboard/tasks/pending-confirmations")).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).not.toHaveBeenCalled();
    await apiClient.post("/auth/login", {});
    await apiClient.get("/logistics/settlements/qr-session/qa-token");
    await apiClient.post("/logistics/settlements/qr-session/qa-token/owner-approve", {});
    expect(adapter).toHaveBeenCalledTimes(3);
  });

  it("loads the authenticated dashboard with an unexpired shift session", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, jwt(Math.floor(Date.now() / 1000) + 3600));

    await render();
    await vi.waitFor(() => expect(container.textContent).toContain("Authenticated Dashboard"));

    expect(window.location.pathname).toBe("/");
    expect(loadProtectedLayout).toHaveBeenCalledOnce();
    expect(loadDashboard).toHaveBeenCalledOnce();
  });
});
