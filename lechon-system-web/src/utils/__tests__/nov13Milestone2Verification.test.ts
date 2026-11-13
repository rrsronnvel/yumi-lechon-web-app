import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getPendingDigitalAmount,
  getPendingDigitalMethod,
  computeCustodyMetrics,
  PendingSettlementDrop,
  PendingPickupSettlement,
} from "../../hooks/useManifest.ts";
import {
  isPastDeliveryDate,
  getCurrentPhilippineYear,
  replaceDeliveryDateYear,
  setDeliveryDateToPhilippineToday,
  shiftRelatedScheduleWithTargetDate,
  getPhilippineDateString,
} from "../dateNormalizer.ts";
import { evaluateDuplicateOrders } from "../similarityHelper.ts";
import { isWalkInOrder } from "../walkIn.ts";

describe("Milestone 2 Verification — Pending Digital Extractors & Custody Metrics", () => {
  it("1. getPendingDigitalAmount prefers pendingDigitalAmount and falls back to digitalTransferAmount", () => {
    assert.strictEqual(
      getPendingDigitalAmount({ pendingDigitalAmount: 10500 }),
      10500,
    );
    assert.strictEqual(
      getPendingDigitalAmount({ digitalTransferAmount: 3500 }),
      3500,
    );
    assert.strictEqual(
      getPendingDigitalAmount({
        pendingDigitalAmount: 10500,
        digitalTransferAmount: 3500,
      }),
      10500,
    );
    assert.strictEqual(getPendingDigitalAmount({}), 0);
    assert.strictEqual(
      getPendingDigitalAmount({ pendingDigitalAmount: null }),
      0,
    );
  });

  it("2. getPendingDigitalMethod extracts payment method with fallback", () => {
    assert.strictEqual(
      getPendingDigitalMethod({ pendingDigitalMethod: "Direct GCash" }),
      "Direct GCash",
    );
    assert.strictEqual(
      getPendingDigitalMethod({ digitalTransferMethod: "Maya" }),
      "Maya",
    );
    assert.strictEqual(
      getPendingDigitalMethod({}),
      "Digital Transfer",
    );
  });

  it("3. computeCustodyMetrics correctly handles Robin Evangelio (#111326-901) zero-cash digital pickup", () => {
    const drops: PendingSettlementDrop[] = [
      {
        id: 1,
        orderId: 101,
        orderReference: "#111326-001",
        riderName: "AL",
        customerName: "Alice Cash",
        isTrustedCustomer: false,
        deliveryAddress: "Cavite",
        totalCollected: 5000,
        riderDeliveryFee: 300,
        netRemittance: 4700,
        settlementCustodyStatus: "InStaffDrawer",
        heldByStaffName: "Aaron",
        heldByStaffAmount: 4700,
      },
    ];

    const pickups: PendingPickupSettlement[] = [
      // Robin Evangelio QA scenario: Direct GCash 10,500, zero cash held by staff
      {
        orderId: 901,
        orderReference: "#111326-901",
        customerName: "Robin Evangelio",
        contactNumber: "09171234567",
        targetDeliveryTime: "2026-11-13T17:00:00",
        grandTotal: 12700,
        downpayment: 2200,
        balanceDue: 10500,
        isPaidInFull: false,
        isTrustedCustomer: false,
        settlementCustodyStatus: "InStaffDrawer",
        heldByStaffName: "Aaron",
        heldByStaffAmount: 0,
        pendingDigitalAmount: 10500,
        pendingDigitalMethod: "Direct GCash",
      },
    ];

    const metrics = computeCustodyMetrics(drops, pickups);

    // Physical cash in drawer should only include the 4700 from Alice Cash (pickup has 0 held cash)
    assert.strictEqual(metrics.inDrawerTotal, 4700);
    assert.strictEqual(metrics.inDrawerCount, 1);

    // Pending digital check should include Robin Evangelio's 10,500
    assert.strictEqual(metrics.pendingDigitalTotal, 10500);
    assert.strictEqual(metrics.pendingDigitalCount, 1);
  });

  it("4. computeCustodyMetrics excludes Settled items from both Drawer and Pending Digital", () => {
    const pickups: PendingPickupSettlement[] = [
      {
        orderId: 901,
        orderReference: "#111326-901",
        customerName: "Robin Evangelio",
        contactNumber: "09171234567",
        targetDeliveryTime: "2026-11-13T17:00:00",
        grandTotal: 12700,
        downpayment: 2200,
        balanceDue: 10500,
        isPaidInFull: true,
        isTrustedCustomer: false,
        settlementCustodyStatus: "Settled",
        pendingDigitalAmount: 10500,
        pendingDigitalMethod: "Direct GCash",
      },
    ];

    const metrics = computeCustodyMetrics([], pickups);
    assert.strictEqual(metrics.pendingDigitalTotal, 0);
    assert.strictEqual(metrics.pendingDigitalCount, 0);
    assert.strictEqual(metrics.inDrawerTotal, 0);
    assert.strictEqual(metrics.inDrawerCount, 0);
  });
});

describe("Milestone 2 Verification — Past-Date / Wrong-Year Warning & Quick Fixes", () => {
  const currentPhYear = getCurrentPhilippineYear();
  const todayStr = getPhilippineDateString();

  it("1. isPastDeliveryDate detects past calendar date and ignores TBD", () => {
    assert.strictEqual(isPastDeliveryDate("2020-01-01", false), true);
    assert.strictEqual(isPastDeliveryDate("2020-01-01", true), false); // isDateTbd suppressed
    assert.strictEqual(isPastDeliveryDate(todayStr, false), false);
    assert.strictEqual(isPastDeliveryDate("2099-12-31", false), false);
    assert.strictEqual(isPastDeliveryDate("", false), false);
    assert.strictEqual(isPastDeliveryDate(null, false), false);
  });

  it("2. replaceDeliveryDateYear updates year while preserving month, day, and time", () => {
    const fixed = replaceDeliveryDateYear("2025-11-13T14:30:00", currentPhYear);
    assert.strictEqual(fixed, `${currentPhYear}-11-13T14:30:00`);
  });

  it("3. setDeliveryDateToPhilippineToday replaces date with today while preserving time", () => {
    const fixed = setDeliveryDateToPhilippineToday("2025-05-20T18:45:00");
    assert.strictEqual(fixed, `${todayStr}T18:45:00`);
  });

  it("4. shiftRelatedScheduleWithTargetDate shifts independent courier departure preserving day delta", () => {
    // Staff entered Lalamove courier departure for the evening before (2025-11-12T20:00)
    // Customer serving time was 2025-11-13T11:00.
    // Staff quick-fixes target date to 2026-11-13T11:00 (+365 days).
    const shifted = shiftRelatedScheduleWithTargetDate(
      "2025-11-12T20:00",
      "2025-11-13T11:00",
      "2026-11-13T11:00",
    );
    assert.strictEqual(shifted, "2026-11-12T20:00");
  });
});

describe("Milestone 2 Verification — POS Duplicate Order Radar & Shared Phone Notice", () => {
  const todayStr = getPhilippineDateString();

  const existingOrders = [
    {
      orderId: 902,
      orderReference: "111326-902",
      customerName: "Bunso - Tirador",
      contactNumber: "09174427367",
      targetDeliveryTime: `${todayStr}T15:00:00`,
      itemsSummary: "1x Belly 2kg",
      grandTotal: 1700,
      createdBy: "Staff",
    },
  ];

  it("1. Same date + same phone + DIFFERENT customer name triggers isSharedPhoneDifferentName (amber notice)", () => {
    const evalResult = evaluateDuplicateOrders(
      {
        customerName: "Sarah Dela Cruz",
        contactNumber: "09174427367",
        targetDate: `${todayStr}T17:00:00`,
      },
      existingOrders,
    );

    assert.strictEqual(evalResult.duplicates.length, 1);
    const dup = evalResult.duplicates[0];
    assert.strictEqual(dup.isSharedPhoneDifferentName, true);
    assert.strictEqual(dup.hasNameMatch, false);
    assert.strictEqual(dup.matchedPhone, "09174427367");
  });

  it("2. Same date + same phone + SAME customer name triggers red duplicate warning", () => {
    const evalResult = evaluateDuplicateOrders(
      {
        customerName: "Bunso - Tirador",
        contactNumber: "09174427367",
        targetDate: `${todayStr}T15:00:00`,
      },
      existingOrders,
    );

    assert.strictEqual(evalResult.duplicates.length, 1);
    const dup = evalResult.duplicates[0];
    assert.strictEqual(dup.isSharedPhoneDifferentName, false);
    assert.strictEqual(dup.hasNameMatch, true);
  });

  it("3. Same date + different phone + same customer name triggers red duplicate warning", () => {
    const evalResult = evaluateDuplicateOrders(
      {
        customerName: "Bunso Tirador",
        contactNumber: "09181112233",
        targetDate: `${todayStr}T15:00:00`,
      },
      existingOrders,
    );

    assert.strictEqual(evalResult.duplicates.length, 1);
    const dup = evalResult.duplicates[0];
    assert.strictEqual(dup.isSharedPhoneDifferentName, false);
    assert.strictEqual(dup.hasNameMatch, true);
  });

  it("4. Different date with shared phone triggers repeat customer match, NOT same-date duplicate", () => {
    const evalResult = evaluateDuplicateOrders(
      {
        customerName: "Sarah Dela Cruz",
        contactNumber: "09174427367",
        targetDate: "2026-12-25T12:00:00",
      },
      existingOrders,
    );

    assert.strictEqual(evalResult.duplicates.length, 0);
    assert.strictEqual(evalResult.repeatCustomerMatches.length, 1);
  });
});

describe("Milestone 2 Verification — Walk-In Order Detection & Downpayment Tracker Filtering", () => {
  it("1. isWalkInOrder detects canonical bookingSource and (WI) customer name suffix", () => {
    assert.strictEqual(
      isWalkInOrder({ source: "Walk-in", customerName: "Johnmark Salipande" }),
      true,
    );
    assert.strictEqual(
      isWalkInOrder({ source: "Facebook", customerName: "Johnmark Salipande (WI)" }),
      true,
    );
    assert.strictEqual(
      isWalkInOrder({ source: "Online", customerName: "Johnmark Salipande" }),
      false,
    );
  });
});

describe("Milestone 2 Verification — Mutation Resolution & Downpayment Reducer Stress", () => {
  // Test mutation logic from useVerifyDigitalSettlementMutation
  function resolveTargetOrderId(hookOrderId?: number, mutationOrderId?: number): number {
    const targetOrderId = mutationOrderId ?? hookOrderId;
    if (!targetOrderId) {
      throw new Error("Order ID is required for digital settlement verification.");
    }
    return targetOrderId;
  }

  it("1. resolveTargetOrderId properly respects precedence: mutationOrderId > hookOrderId", () => {
    assert.strictEqual(resolveTargetOrderId(100, 200), 200);
    assert.strictEqual(resolveTargetOrderId(100, undefined), 100);
    assert.strictEqual(resolveTargetOrderId(undefined, 200), 200);
  });

  it("2. resolveTargetOrderId throws when orderId is missing or falsy (0, undefined, null)", () => {
    assert.throws(
      () => resolveTargetOrderId(undefined, undefined),
      /Order ID is required/,
    );
    assert.throws(
      () => resolveTargetOrderId(0, undefined),
      /Order ID is required/,
    );
  });

  it("3. Downpayment tracker summary handles empty items list safely", () => {
    const isCashMethod = (m?: string | null) => (m || "").trim().toLowerCase() === "cash";
    const isDigitalMethod = (m?: string | null) => {
      const norm = (m || "").trim().toLowerCase().replace(/[\s-]+/g, "");
      return ["gcash", "directgcash", "manualgcash", "maya", "banktransfer"].includes(norm);
    };

    const items: any[] = [];
    const summary = items.reduce(
      (totals, item) => {
        const amount = Number(item.downpaymentAmount || 0);
        if (item.isDpRemittedToOwner) {
          totals.verified += amount;
        } else if (isCashMethod(item.downpaymentMethod)) {
          totals.unremittedCash += amount;
          totals.unremittedCashCount += 1;
          totals.unremittedCount += 1;
        } else if (isDigitalMethod(item.downpaymentMethod)) {
          totals.unverifiedDigital += amount;
          totals.unremittedCount += 1;
        } else {
          totals.unremittedCount += 1;
        }
        return totals;
      },
      {
        unremittedCash: 0,
        unverifiedDigital: 0,
        verified: 0,
        unremittedCashCount: 0,
        unremittedCount: 0,
      },
    );

    assert.deepStrictEqual(summary, {
      unremittedCash: 0,
      unverifiedDigital: 0,
      verified: 0,
      unremittedCashCount: 0,
      unremittedCount: 0,
    });
  });

  it("4. Downpayment tracker summary correctly aggregates mixed cash and digital downpayments", () => {
    const isCashMethod = (m?: string | null) => (m || "").trim().toLowerCase() === "cash";
    const isDigitalMethod = (m?: string | null) => {
      const norm = (m || "").trim().toLowerCase().replace(/[\s-]+/g, "");
      return ["gcash", "directgcash", "manualgcash", "maya", "banktransfer"].includes(norm);
    };

    const items = [
      { orderId: 1, downpaymentAmount: 4000, downpaymentMethod: "Cash", isDpRemittedToOwner: false },
      { orderId: 2, downpaymentAmount: 2200, downpaymentMethod: "GCash", isDpRemittedToOwner: false },
      { orderId: 3, downpaymentAmount: 5000, downpaymentMethod: "Direct GCash", isDpRemittedToOwner: true },
      { orderId: 4, downpaymentAmount: 1000, downpaymentMethod: "Bank Transfer", isDpRemittedToOwner: false },
      { orderId: 5, downpaymentAmount: 3000, downpaymentMethod: "Cash", isDpRemittedToOwner: true },
    ];

    const summary = items.reduce(
      (totals, item) => {
        const amount = Number(item.downpaymentAmount || 0);
        if (item.isDpRemittedToOwner) {
          totals.verified += amount;
        } else if (isCashMethod(item.downpaymentMethod)) {
          totals.unremittedCash += amount;
          totals.unremittedCashCount += 1;
          totals.unremittedCount += 1;
        } else if (isDigitalMethod(item.downpaymentMethod)) {
          totals.unverifiedDigital += amount;
          totals.unremittedCount += 1;
        } else {
          totals.unremittedCount += 1;
        }
        return totals;
      },
      {
        unremittedCash: 0,
        unverifiedDigital: 0,
        verified: 0,
        unremittedCashCount: 0,
        unremittedCount: 0,
      },
    );

    assert.strictEqual(summary.unremittedCash, 4000);
    assert.strictEqual(summary.unremittedCashCount, 1);
    assert.strictEqual(summary.unverifiedDigital, 3200); // 2200 GCash + 1000 Bank Transfer
    assert.strictEqual(summary.verified, 8000); // 5000 + 3000
    assert.strictEqual(summary.unremittedCount, 3); // items 1, 2, 4
  });
});

describe("Milestone 2 Verification — Shift Related Schedule Boundary Cases", () => {
  it("1. Shift across month boundary (Oct 31 -> Nov 1) calculates exact date", () => {
    const shifted = shiftRelatedScheduleWithTargetDate(
      "2026-10-30T18:00",
      "2026-10-31T12:00",
      "2026-11-01T12:00",
    );
    assert.strictEqual(shifted, "2026-10-31T18:00");
  });

  it("2. Shift across year boundary (Dec 31 -> Jan 1) calculates exact date", () => {
    const shifted = shiftRelatedScheduleWithTargetDate(
      "2025-12-30T18:00",
      "2025-12-31T12:00",
      "2026-01-01T12:00",
    );
    assert.strictEqual(shifted, "2025-12-31T18:00");
  });

  it("3. Shift backward in time (negative delta) shifts schedule backward", () => {
    const shifted = shiftRelatedScheduleWithTargetDate(
      "2026-11-14T10:00",
      "2026-11-15T12:00",
      "2026-11-13T12:00",
    );
    assert.strictEqual(shifted, "2026-11-12T10:00");
  });

  it("4. Invalid date strings return original string unchanged", () => {
    assert.strictEqual(
      shiftRelatedScheduleWithTargetDate("invalid", "2026-11-13", "2026-11-14"),
      "invalid",
    );
    assert.strictEqual(
      shiftRelatedScheduleWithTargetDate("2026-11-13T10:00", "bad", "2026-11-14"),
      "2026-11-13T10:00",
    );
  });
});
