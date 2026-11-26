import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InternalAxiosRequestConfig } from "axios";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/context/AuthContext";
import type { RoastingScheduleItem } from "@/hooks/useSchedules";
import apiClient from "@/services/apiClient";
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "@/services/authSession";
import { KitchenViewTab } from "../KitchenViewTab";
import { RiderViewTab } from "../RiderViewTab";

const unassigned: RoastingScheduleItem = {
  id: 21, orderId: 101, orderItemId: 42, orderReference: "112826-001", customerName: "Saturday dispatch",
  fulfillment: 1, riderName: "Unassigned", quantity: 1, unitIndex: 1, unitTotal: 1, size: "M", minimumWeightKg: 15,
  targetDeliveryTime: "2026-11-28T14:00:00", riderDepartureTime: "2026-11-28T13:00:00",
  tahiStartTime: "2026-11-28T09:30:00", salangStartTime: "2026-11-28T10:30:00", packagingStartTime: "2026-11-28T12:30:00",
};

function choose(select: HTMLSelectElement, label: string) {
  const option = [...select.options].find((entry) => entry.text === label);
  if (!option) throw new Error(`Rider option ${label} is missing.`);
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Daily Dispatch Planner rider assignment", () => {
  const originalAdapter = apiClient.defaults.adapter;
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let rows: RoastingScheduleItem[];
  let writes: { method: string; url: string; body: unknown }[];

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    notifyManager.setNotifyFunction((callback) => { act(callback); });
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 })).replace(/=+$/, "");
    localStorage.setItem(TOKEN_STORAGE_KEY, `eyJhbGciOiJIUzI1NiJ9.${payload}.dGVzdA`);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ username: "cashier", fullName: "Cashier", role: "Cashier" }));

    rows = [{ ...unassigned }];
    writes = [];
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const { method, url } = config;
      let data: unknown = [];
      if (url === "/schedules/daily-sheets") {
        data = { targetDate: config.params?.date, items: rows };
      } else if (url === "/riders") {
        data = [
          { id: 1, fullName: "Adrianne", isActive: true },
          { id: 2, fullName: "Randy", isActive: true },
          { id: 3, fullName: "Retired Rider", isActive: false },
        ];
      } else if (method === "put" && url === "/orders/101/riders") {
        const body = JSON.parse(config.data) as { riderName: string };
        writes.push({ method, url, body });
        rows = rows.map((row) => ({ ...row, riderName: body.riderName || "Unassigned" }));
        data = { id: 101, assignedRiderName: body.riderName || null };
      } else if (method === "patch" && url === "/schedules/21") {
        const body = JSON.parse(config.data) as { assignedRiderName: string };
        writes.push({ method, url, body });
        rows = rows.map((row) => ({ ...row, assignedRiderName: row.id === 21 ? body.assignedRiderName : null }));
        data = rows[0];
      } else if (url === "/orders/101") {
        data = { id: 101, orderReference: "112826-001", orderItems: [{ quantity: 1, itemCategory: { name: "M", minimumWeightKg: 15 } }] };
      }
      return { config, status: 200, statusText: "OK", headers: {}, data };
    };

    container = document.body.appendChild(document.createElement("div"));
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    localStorage.clear();
    apiClient.defaults.adapter = originalAdapter;
    notifyManager.setNotifyFunction((callback) => callback());
    vi.unstubAllGlobals();
  });

  async function render(Tab: typeof KitchenViewTab | typeof RiderViewTab, date = "2026-11-28") {
    await act(async () => root.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><Tab selectedDate={date} canEdit={false} canAssignRiders /></AuthProvider>
      </QueryClientProvider>,
    ));
  }

  function waitFor(check: () => void) {
    return vi.waitFor(async () => {
      await act(async () => {});
      check();
    });
  }

  it.each([
    ["Kitchen", KitchenViewTab],
    ["Rider", RiderViewTab],
  ] as const)("saves an unassigned order from the %s cell without a dialog or a second confirmation", async (_view, Tab) => {
    await render(Tab);
    await waitFor(() => expect(container.querySelector("select")?.options).toHaveLength(4));
    const select = container.querySelector("select")!;

    expect(select.closest("tr")?.textContent).toContain("#112826-001");
    expect([...select.options].map((entry) => entry.text)).toEqual(["Unassigned", "Adrianne", "Randy", "⚙️ Split / Custom Rider..."]);
    expect(container.querySelector('button[aria-label*="Split"]')).toBeNull();

    await act(async () => choose(select, "Randy"));
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(writes).toEqual([{ method: "put", url: "/orders/101/riders", body: { riderName: "Randy" } }]);
    expect(select.selectedOptions[0].text).toBe("Randy");
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => choose(select, "Unassigned"));
    await waitFor(() => expect(select.selectedOptions[0].text).toBe("Unassigned"));
    expect(writes[1]).toEqual({ method: "put", url: "/orders/101/riders", body: { riderName: "" } });
  });

  it("shows only the lead and backup choices on an existing split head and saves a head override", async () => {
    rows = [1, 2, 3].map((unitIndex) => ({
      ...unassigned, id: 20 + unitIndex, orderReference: "112626-903", riderName: "Adrianne", supportRiderName: "Randy",
      unitIndex, unitTotal: 3, quantity: 3, assignedRiderName: unitIndex === 3 ? "Randy" : null,
    }));
    await render(KitchenViewTab, "2026-11-26");
    await waitFor(() => expect(container.querySelectorAll("select")).toHaveLength(3));
    const select = container.querySelector('select[aria-label$="head 1"]') as HTMLSelectElement;
    expect([...select.options].map((entry) => entry.text)).toEqual(["Adrianne (Lead)", "Randy (Backup)", "⚙️ Edit Order Riders / Split..."]);
    expect(select.closest("td")?.querySelector("button")?.textContent).toBe("Edit Split");
    await act(async () => choose(select, "Randy (Backup)"));
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(writes).toEqual([{ method: "patch", url: "/schedules/21", body: { assignedRiderName: "Randy" } }]);
    expect(select.selectedOptions[0].text).toBe("Randy (Backup)");
  });

  it("opens the full rider dialog from the custom choice with split settings collapsed for a normal order", async () => {
    await render(KitchenViewTab);
    await waitFor(() => expect(container.querySelector("select")?.options).toHaveLength(4));
    await act(async () => choose(container.querySelector("select")!, "⚙️ Split / Custom Rider..."));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Assign / Change Rider"));
    const dialog = document.querySelector('[role="dialog"]')!;
    await waitFor(() => expect(dialog.querySelector('button[aria-expanded="false"]')?.textContent).toBe("+ Split Moto Rider"));
    expect(dialog.textContent).not.toContain("Backup Rider (Collects ₱0)");
    expect(writes).toHaveLength(0);
  });
});
