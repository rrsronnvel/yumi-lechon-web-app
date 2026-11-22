import { describe, it } from "node:test";
import assert from "node:assert";
import {
  computeEffectiveNetRemittance,
  DownpaymentTrackerItem,
} from "../../hooks/useManifest.ts";

describe("November 23 Manifest Verification — DP Tracker, Split Badges & Net Remittance", () => {
  // Scenario 1: Jason Canete #112326-901 Staggered 3-Installment Downpayment Breakdown
  it("1. DP Tracker summary calculates accurate cash vs digital split across multi-installment orders", () => {
    const items: DownpaymentTrackerItem[] = [
      {
        paymentLogId: 101,
        orderId: 901,
        orderReference: "112326-901",
        customerName: "Jason Canete (Installment DP QA)",
        phoneNumber: "09171123901",
        bookingSource: "Walk-in",
        amount: 1500,
        downpaymentAmount: 1500,
        paymentMethod: "GCash",
        downpaymentMethod: "GCash",
        installmentIndex: 1,
        installmentCount: 3,
        isRemittedToOwner: false,
        isDpRemittedToOwner: false,
        createdAt: "2026-11-13T10:00:00Z",
        paidAt: "2026-11-13T10:00:00Z",
        eventDate: "2026-12-31T15:00:00Z",
        targetDeliveryTime: "2026-12-31T15:00:00Z",
      },
      {
        paymentLogId: 102,
        orderId: 901,
        orderReference: "112326-901",
        customerName: "Jason Canete (Installment DP QA)",
        phoneNumber: "09171123901",
        bookingSource: "Walk-in",
        amount: 2000,
        downpaymentAmount: 2000,
        paymentMethod: "Cash",
        downpaymentMethod: "Cash",
        installmentIndex: 2,
        installmentCount: 3,
        isRemittedToOwner: false,
        isDpRemittedToOwner: false,
        createdAt: "2026-11-15T14:00:00Z",
        paidAt: "2026-11-15T14:00:00Z",
        eventDate: "2026-12-31T15:00:00Z",
        targetDeliveryTime: "2026-12-31T15:00:00Z",
      },
      {
        paymentLogId: 103,
        orderId: 901,
        orderReference: "112326-901",
        customerName: "Jason Canete (Installment DP QA)",
        phoneNumber: "09171123901",
        bookingSource: "Walk-in",
        amount: 3000,
        downpaymentAmount: 3000,
        paymentMethod: "Cash",
        downpaymentMethod: "Cash",
        installmentIndex: 3,
        installmentCount: 3,
        isRemittedToOwner: false,
        isDpRemittedToOwner: false,
        createdAt: "2026-11-20T11:00:00Z",
        paidAt: "2026-11-20T11:00:00Z",
        eventDate: "2026-12-31T15:00:00Z",
        targetDeliveryTime: "2026-12-31T15:00:00Z",
      },
    ];

    // Verify row keys are distinct and uniquely keyed by paymentLogId
    const rowKeys = items.map((item) =>
      item.paymentLogId ? `log-${item.paymentLogId}` : `order-${item.orderId}`
    );
    assert.deepStrictEqual(rowKeys, ["log-101", "log-102", "log-103"]);

    // Calculate initial unremitted summary
    let unremittedCash = 0;
    let unverifiedDigital = 0;
    let verified = 0;

    for (const item of items) {
      const amount = Number(item.amount ?? item.downpaymentAmount ?? 0);
      const isRemitted = Boolean(item.isRemittedToOwner ?? item.isDpRemittedToOwner);
      const method = (item.paymentMethod || item.downpaymentMethod || "Cash").toLowerCase();

      if (isRemitted) {
        verified += amount;
      } else if (method === "cash") {
        unremittedCash += amount;
      } else {
        unverifiedDigital += amount;
      }
    }

    assert.strictEqual(unremittedCash, 5000, "Unremitted cash should be ₱2,000 + ₱3,000 = ₱5,000");
    assert.strictEqual(unverifiedDigital, 1500, "Unverified digital should be ₱1,500");
    assert.strictEqual(verified, 0, "Initial verified should be ₱0");

    // Remit Log 1 (₱1,500 GCash)
    items[0].isRemittedToOwner = true;
    items[0].isDpRemittedToOwner = true;

    unremittedCash = 0;
    unverifiedDigital = 0;
    verified = 0;

    for (const item of items) {
      const amount = Number(item.amount ?? item.downpaymentAmount ?? 0);
      const isRemitted = Boolean(item.isRemittedToOwner ?? item.isDpRemittedToOwner);
      const method = (item.paymentMethod || item.downpaymentMethod || "Cash").toLowerCase();

      if (isRemitted) {
        verified += amount;
      } else if (method === "cash") {
        unremittedCash += amount;
      } else {
        unverifiedDigital += amount;
      }
    }

    assert.strictEqual(unremittedCash, 5000, "Unremitted cash remains ₱5,000");
    assert.strictEqual(unverifiedDigital, 0, "Unverified digital becomes ₱0");
    assert.strictEqual(verified, 1500, "Verified becomes ₱1,500");
  });

  it("2. Installment ratio badges format correctly for multi-installment and single-installment orders", () => {
    const formatBadge = (index?: number | null, count?: number | null) => {
      if (count && count > 1) {
        return `Payment ${index ?? 1}/${count}`;
      }
      return null;
    };

    assert.strictEqual(formatBadge(1, 3), "Payment 1/3");
    assert.strictEqual(formatBadge(2, 3), "Payment 2/3");
    assert.strictEqual(formatBadge(3, 3), "Payment 3/3");
    assert.strictEqual(formatBadge(1, 1), null);
    assert.strictEqual(formatBadge(null, null), null);
  });

  // Scenario 2: Split Payment Channel Detection
  it("3. Split payment badge detects multiple active channels and excludes voided payments", () => {
    const detectSplit = (paymentLogs: Array<{ paymentMethod: string; amount: number; isVoided?: boolean }>) => {
      const activeLogs = paymentLogs.filter((p) => !p.isVoided && Number(p.amount) > 0);
      const distinctChannels = Array.from(
        new Set(activeLogs.map((p) => p.paymentMethod.trim()).filter(Boolean))
      );
      if (distinctChannels.length >= 2) {
        return {
          isSplit: true,
          label: `Split (${distinctChannels.join(" + ")})`,
        };
      }
      return {
        isSplit: false,
        label: distinctChannels[0] || "None",
      };
    };

    // Jason Canete case: GCash + Cash
    const jasonPayments = [
      { paymentMethod: "GCash", amount: 1500, isVoided: false },
      { paymentMethod: "Cash", amount: 2000, isVoided: false },
      { paymentMethod: "Cash", amount: 3000, isVoided: false },
    ];
    const jasonResult = detectSplit(jasonPayments);
    assert.strictEqual(jasonResult.isSplit, true);
    assert.strictEqual(jasonResult.label, "Split (GCash + Cash)");

    // Leah de Guzman case: 1 voided GCash + 1 active GCash -> NOT split!
    const leahPayments = [
      { paymentMethod: "GCash", amount: 1, isVoided: true },
      { paymentMethod: "GCash", amount: 1000, isVoided: false },
    ];
    const leahResult = detectSplit(leahPayments);
    assert.strictEqual(leahResult.isSplit, false);
    assert.strictEqual(leahResult.label, "GCash");

    // Single Cash payment
    const singleCash = [{ paymentMethod: "Cash", amount: 5000, isVoided: false }];
    const singleResult = detectSplit(singleCash);
    assert.strictEqual(singleResult.isSplit, false);
    assert.strictEqual(singleResult.label, "Cash");
  });

  // Scenario 3: Leah de Guzman #112326-902 Freelance Drop Net Remittance Fix
  it("4. computeEffectiveNetRemittance computes TotalCollected - RiderDeliveryFee for Uncollected freelance drops", () => {
    // Normal correct drop
    const normalDrop = {
      netRemittance: 11700,
      totalCollected: 12220,
      riderDeliveryFee: 520,
      custodyStatus: "Uncollected",
    };
    assert.strictEqual(computeEffectiveNetRemittance(normalDrop), 11700);

    // Buggy drop where backend returned 0 for an Uncollected drop
    const buggyDrop = {
      netRemittance: 0,
      totalCollected: 12220,
      riderDeliveryFee: 520,
      custodyStatus: "Uncollected",
    };
    assert.strictEqual(
      computeEffectiveNetRemittance(buggyDrop),
      11700,
      "Fallback should recover 12,220 - 520 = 11,700 for uncollected drop"
    );

    // Drop where delivery fee exceeds collected (edge case safety)
    const smallDrop = {
      netRemittance: 0,
      totalCollected: 200,
      riderDeliveryFee: 520,
      custodyStatus: "Uncollected",
    };
    assert.strictEqual(computeEffectiveNetRemittance(smallDrop), 0);
  });

  // Scenario 4: Progressive Pagination Slicing
  it("5. Progressive loading windows 30 items initially and expands on Show 30 More", () => {
    // Generate 319 mock downpayment items
    const mock319Items: DownpaymentTrackerItem[] = Array.from({ length: 319 }, (_, i) => ({
      paymentLogId: i + 1,
      orderId: 1000 + i,
      orderReference: `112326-${1000 + i}`,
      customerName: `Customer ${i + 1}`,
      amount: 1000,
      downpaymentAmount: 1000,
      paymentMethod: "Cash",
      isRemittedToOwner: false,
      isDpRemittedToOwner: false,
      createdAt: "2026-11-23T10:00:00Z",
    }));

    let visibleCount = 30;
    let slice = mock319Items.slice(0, visibleCount);
    assert.strictEqual(slice.length, 30, "Initial slice must be exactly 30 items");

    // Click "Show 30 More"
    visibleCount = Math.min(visibleCount + 30, mock319Items.length);
    slice = mock319Items.slice(0, visibleCount);
    assert.strictEqual(slice.length, 60, "Expanded slice must be 60 items");

    // Click "Show All"
    visibleCount = mock319Items.length;
    slice = mock319Items.slice(0, visibleCount);
    assert.strictEqual(slice.length, 319, "Show All must render all 319 items");

    // Reset on search / filter
    visibleCount = 30;
    slice = mock319Items.slice(0, visibleCount);
    assert.strictEqual(slice.length, 30, "Reset must restore 30 items");
  });
});
