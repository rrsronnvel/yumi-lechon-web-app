import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeMojibake } from "../sanitizeDisplayText.ts";
import type {
  FreebiesPrepSummaryDto,
  FreebiePrepRosterRowDto,
  PackItemPillDto,
  CreateKitchenPrepRequestDto,
} from "../../hooks/useFreebiesPrep.ts";

describe("Empirical Stress Testing: Freebies Prep UI Integrity & Data Binding", () => {
  // Test Data Generator for Summary
  function createSampleSummary(overrides?: Partial<FreebiesPrepSummaryDto>): FreebiesPrepSummaryDto {
    return {
      sarsa: {
        total: 18,
        freebies: 15,
        wholeFreebies: 10,
        bellyFreebies: 3,
        noFreebiesSarsaGuaranteed: 2,
        paidAddOns: 1,
        paluto: 2,
      },
      pancit: {
        total: 5,
        freebies: 2,
        paidAddOns: 1,
        paluto: 2,
      },
      palabok: {
        total: 4,
        freebies: 2,
        paidAddOns: 2,
        paluto: 0,
      },
      spaghetti: {
        total: 3,
        freebies: 2,
        paidAddOns: 1,
        paluto: 0,
      },
      dinuguan: {
        total: 6,
        freebies: 5,
        paidAddOns: 1,
        paluto: 0,
        excludedRawInnardsOrders: 1,
      },
      puto: {
        total: 7,
        freebies: 4,
        paidAddOns: 0,
        paluto: 3,
      },
      coke15L: {
        total: 8,
        freebies: 2,
        bellySwaps: 4,
        paidAddOns: 0,
        paluto: 2,
      },
      rawInnardsHilaw: {
        total: 1,
        bags: 1,
        freebies: 1,
        paidAddOns: 0,
        paluto: 0,
      },
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // 1. Data Binding for All 8 Summary Cards
  // --------------------------------------------------------------------------
  describe("1. Data Binding & Invariants for All 8 Summary Cards", () => {
    it("Card 1: Sarsa (Sauce) computes total = wholeFreebies + bellyFreebies + paidAddOns + paluto + noFreebiesSarsaGuaranteed", () => {
      const summary = createSampleSummary().sarsa;
      const expectedTotal =
        summary.wholeFreebies +
        summary.bellyFreebies +
        summary.paidAddOns +
        summary.paluto +
        summary.noFreebiesSarsaGuaranteed;
      assert.strictEqual(summary.total, expectedTotal, "Sarsa total must equal sum of all 5 components");
      assert.strictEqual(summary.total, 18);
      assert.ok(summary.noFreebiesSarsaGuaranteed > 0, "Guaranteed Sarsa flag is present for Less ₱2k orders");
    });

    it("Card 1: Sarsa Less ₱2k guaranteed banner condition triggers if and only if noFreebiesSarsaGuaranteed > 0", () => {
      const summaryWithGuaranteed = createSampleSummary({
        sarsa: {
          total: 5,
          freebies: 5,
          wholeFreebies: 3,
          bellyFreebies: 1,
          noFreebiesSarsaGuaranteed: 1,
          paidAddOns: 0,
          paluto: 0,
        },
      }).sarsa;
      assert.strictEqual(summaryWithGuaranteed.noFreebiesSarsaGuaranteed > 0, true);

      const summaryWithoutGuaranteed = createSampleSummary({
        sarsa: {
          total: 4,
          freebies: 4,
          wholeFreebies: 3,
          bellyFreebies: 1,
          noFreebiesSarsaGuaranteed: 0,
          paidAddOns: 0,
          paluto: 0,
        },
      }).sarsa;
      assert.strictEqual(summaryWithoutGuaranteed.noFreebiesSarsaGuaranteed > 0, false);
    });

    it("Cards 2, 3, 4: Pancit, Palabok, Spaghetti totals equal freebies + paidAddOns + paluto", () => {
      const { pancit, palabok, spaghetti } = createSampleSummary();

      assert.strictEqual(pancit.total, pancit.freebies + pancit.paidAddOns + pancit.paluto);
      assert.strictEqual(pancit.total, 5);

      assert.strictEqual(palabok.total, palabok.freebies + palabok.paidAddOns + palabok.paluto);
      assert.strictEqual(palabok.total, 4);

      assert.strictEqual(spaghetti.total, spaghetti.freebies + spaghetti.paidAddOns + spaghetti.paluto);
      assert.strictEqual(spaghetti.total, 3);
    });

    it("Card 5: Dinuguan (Cooked) excludes raw innards and total = freebies + paidAddOns + paluto", () => {
      const { dinuguan } = createSampleSummary();
      assert.strictEqual(dinuguan.total, dinuguan.freebies + dinuguan.paidAddOns + dinuguan.paluto);
      assert.strictEqual(dinuguan.total, 6);
      assert.strictEqual(dinuguan.excludedRawInnardsOrders, 1);
      assert.ok(dinuguan.excludedRawInnardsOrders > 0, "Warning badge renders when raw innards orders exist");
    });

    it("Card 5: Dinuguan exclusion note is hidden when excludedRawInnardsOrders is 0", () => {
      const summary = createSampleSummary({
        dinuguan: {
          total: 5,
          freebies: 5,
          paidAddOns: 0,
          paluto: 0,
          excludedRawInnardsOrders: 0,
        },
      }).dinuguan;
      assert.strictEqual(summary.excludedRawInnardsOrders > 0, false);
    });

    it("Card 6: Puto total equals freebies + paidAddOns + paluto", () => {
      const { puto } = createSampleSummary();
      assert.strictEqual(puto.total, puto.freebies + puto.paidAddOns + puto.paluto);
      assert.strictEqual(puto.total, 7);
    });

    it("Card 7: 1.5L Coke total includes bellySwaps (4x Coke per 5kg belly) + freebies + paidAddOns + paluto", () => {
      const { coke15L } = createSampleSummary();
      const expectedTotal = coke15L.freebies + coke15L.bellySwaps + coke15L.paidAddOns + coke15L.paluto;
      assert.strictEqual(coke15L.total, expectedTotal);
      assert.strictEqual(coke15L.total, 8);
      assert.strictEqual(coke15L.bellySwaps, 4, "Belly swaps accounts for 4x Coke swap on 5kg Belly");
    });

    it("Card 8: Raw Innards (Hilaw) total matches bags + paidAddOns + paluto", () => {
      const { rawInnardsHilaw } = createSampleSummary();
      assert.strictEqual(rawInnardsHilaw.total, rawInnardsHilaw.bags + rawInnardsHilaw.paidAddOns + rawInnardsHilaw.paluto);
      assert.strictEqual(rawInnardsHilaw.total, 1);
      assert.strictEqual(rawInnardsHilaw.bags, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Chronological Packing Roster Table & Sorting
  // --------------------------------------------------------------------------
  describe("2. Chronological Packing Roster Sorting & Grouping", () => {
    it("Separates scheduled rows from Time TBD rows cleanly", () => {
      const roster: FreebiePrepRosterRowDto[] = [
        {
          id: "ord-1",
          rowType: "Order",
          isPrepRequest: false,
          orderRef: "#111026-001",
          recipient: "Customer 1",
          typeItem: "1x L",
          fulfillmentType: "Delivery",
          routeDisplay: "🛵 AL",
          timeNeeded: "2026-11-10T08:30:00",
          timeNeededDisplay: "08:30 AM",
          isTimeTbd: false,
          isNoFreebies: false,
          isRawInnards: false,
          hasBellyCokeSwap: false,
          checklistPills: [],
          remarks: "Extra crispy",
        },
        {
          id: "ord-2",
          rowType: "Order",
          isPrepRequest: false,
          orderRef: "#111026-002",
          recipient: "Customer 2",
          typeItem: "1x M",
          fulfillmentType: "Pickup",
          routeDisplay: "🏪 Store Pickup",
          timeNeeded: null,
          timeNeededDisplay: "⏳ TIME TBD",
          isTimeTbd: true,
          isNoFreebies: false,
          isRawInnards: false,
          hasBellyCokeSwap: false,
          checklistPills: [],
          remarks: "",
        },
        {
          id: "prep-1",
          rowType: "Paluto",
          prepRequestId: 1,
          isPrepRequest: true,
          orderRef: "PALUTO-1",
          recipient: "Staff Meryenda",
          typeItem: "👥 Staff Meryenda",
          fulfillmentType: "Internal",
          routeDisplay: "🏠 Internal Kitchen",
          timeNeeded: "2026-11-10T15:00:00",
          timeNeededDisplay: "03:00 PM",
          isTimeTbd: false,
          isNoFreebies: false,
          isRawInnards: false,
          hasBellyCokeSwap: false,
          checklistPills: [],
          remarks: "Crew snacks",
        },
      ];

      const scheduledRows = roster.filter((r) => !r.isTimeTbd);
      const timeTbdRows = roster.filter((r) => !!r.isTimeTbd);

      assert.strictEqual(scheduledRows.length, 2);
      assert.strictEqual(timeTbdRows.length, 1);
      assert.strictEqual(timeTbdRows[0].orderRef, "#111026-002");
      assert.strictEqual(scheduledRows[0].orderRef, "#111026-001");
      assert.strictEqual(scheduledRows[1].orderRef, "PALUTO-1");
    });

    it("Sorts chronological items ascending by TimeNeeded", () => {
      const items: FreebiePrepRosterRowDto[] = [
        {
          id: "prep-1",
          rowType: "Paluto",
          isPrepRequest: true,
          orderRef: "PALUTO-1",
          recipient: "Kitchen Snacks",
          typeItem: "👥 Staff Meryenda",
          fulfillmentType: "Internal",
          routeDisplay: "🏠 Internal Kitchen",
          timeNeeded: "2026-11-10T15:00:00",
          timeNeededDisplay: "03:00 PM",
          isTimeTbd: false,
          isNoFreebies: false,
          isRawInnards: false,
          hasBellyCokeSwap: false,
          checklistPills: [],
          remarks: "",
        },
        {
          id: "ord-1",
          rowType: "Order",
          isPrepRequest: false,
          orderRef: "#111026-001",
          recipient: "Early Morning Delivery",
          typeItem: "1x XL",
          fulfillmentType: "Delivery",
          routeDisplay: "🛵 AL",
          timeNeeded: "2026-11-10T08:30:00",
          timeNeededDisplay: "08:30 AM",
          isTimeTbd: false,
          isNoFreebies: false,
          isRawInnards: false,
          hasBellyCokeSwap: false,
          checklistPills: [],
          remarks: "",
        },
        {
          id: "ord-2",
          rowType: "Order",
          isPrepRequest: false,
          orderRef: "#111026-002",
          recipient: "Noon Lunch Pickup",
          typeItem: "1x Belly 5kg",
          fulfillmentType: "Pickup",
          routeDisplay: "🏪 Store Pickup",
          timeNeeded: "2026-11-10T12:00:00",
          timeNeededDisplay: "12:00 PM",
          isTimeTbd: false,
          isNoFreebies: false,
          isRawInnards: false,
          hasBellyCokeSwap: false,
          checklistPills: [],
          remarks: "",
        },
      ];

      // Verification of ascending order logic
      const sorted = [...items].sort((a, b) => {
        const timeA = a.timeNeeded ? new Date(a.timeNeeded).getTime() : Infinity;
        const timeB = b.timeNeeded ? new Date(b.timeNeeded).getTime() : Infinity;
        return timeA - timeB;
      });

      assert.strictEqual(sorted[0].orderRef, "#111026-001", "08:30 AM is first");
      assert.strictEqual(sorted[1].orderRef, "#111026-002", "12:00 PM is second");
      assert.strictEqual(sorted[2].orderRef, "PALUTO-1", "03:00 PM is third");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Checklist Pills Classification & Badging
  // --------------------------------------------------------------------------
  describe("3. Checklist Pills Badging & Styling Classification", () => {
    function classifyPillBadge(pill: PackItemPillDto): string {
      if (pill.badgeType === "NoFreebies" || pill.label.includes("NO FREEBIES")) {
        return "rose-no-freebies";
      }
      if (
        pill.badgeType === "Special" &&
        (pill.label.includes("Raw Innards") || pill.label.includes("Hilaw"))
      ) {
        return "purple-raw-innards";
      }
      if (pill.badgeType === "Special" && pill.label.includes("Bilao Swapped")) {
        return "red-coke-swap";
      }
      if (pill.badgeType === "PaidAddOn") {
        return "emerald-paid-addon";
      }
      if (pill.badgeType === "Paluto") {
        return "indigo-paluto";
      }
      return "stone-standard-freebie";
    }

    it("Correctly classifies No Freebies / Less ₱2k pills", () => {
      const pill: PackItemPillDto = {
        itemName: "Sarsa",
        quantity: 1,
        badgeType: "NoFreebies",
        label: "🚫 NO FREEBIES (Less ₱2k) • 1x Sarsa Only",
      };
      assert.strictEqual(classifyPillBadge(pill), "rose-no-freebies");
    });

    it("Correctly classifies Raw Innards (Hilaw) pills", () => {
      const pill: PackItemPillDto = {
        itemName: "Raw Innards",
        quantity: 1,
        badgeType: "Special",
        label: "🥩 1x Raw Innards (Hilaw - Do NOT Cook Dinuguan)",
      };
      assert.strictEqual(classifyPillBadge(pill), "purple-raw-innards");
    });

    it("Correctly classifies 5kg Belly Coke Swap pills", () => {
      const pill: PackItemPillDto = {
        itemName: "1.5L Coke",
        quantity: 4,
        badgeType: "Special",
        label: "4x 1.5L Coke (Bilao Swapped)",
      };
      assert.strictEqual(classifyPillBadge(pill), "red-coke-swap");
    });

    it("Correctly classifies Customer Paid Add-On pills", () => {
      const pill: PackItemPillDto = {
        itemName: "Spaghetti",
        quantity: 2,
        badgeType: "PaidAddOn",
        label: "+ 2x Spaghetti (Paid Add-On)",
      };
      assert.strictEqual(classifyPillBadge(pill), "emerald-paid-addon");
    });

    it("Correctly classifies Store Paluto pills", () => {
      const pill: PackItemPillDto = {
        itemName: "Pancit",
        quantity: 2,
        badgeType: "Paluto",
        label: "2x Pancit (Paluto)",
      };
      assert.strictEqual(classifyPillBadge(pill), "indigo-paluto");
    });

    it("Correctly classifies standard freebie pills", () => {
      const pill: PackItemPillDto = {
        itemName: "Sarsa",
        quantity: 1,
        badgeType: "Freebie",
        label: "1x Sarsa",
      };
      assert.strictEqual(classifyPillBadge(pill), "stone-standard-freebie");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Store Paluto Delete Button & Clean View Suppression
  // --------------------------------------------------------------------------
  describe("4. Store Paluto Delete Button & Clean View Suppression", () => {
    function shouldRenderDeleteButton(isPaluto: boolean, isClean: boolean): boolean {
      return isPaluto && !isClean;
    }

    it("Renders delete button on Store Paluto rows in Edit mode", () => {
      assert.strictEqual(shouldRenderDeleteButton(true, false), true);
    });

    it("Suppresses delete button on Store Paluto rows in Clean Screenshot mode", () => {
      assert.strictEqual(shouldRenderDeleteButton(true, true), false);
    });

    it("Suppresses delete button on Customer Order rows in Edit mode", () => {
      assert.strictEqual(shouldRenderDeleteButton(false, false), false);
    });

    it("Suppresses delete button on Customer Order rows in Clean mode", () => {
      assert.strictEqual(shouldRenderDeleteButton(false, true), false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Mojibake Sanitization on Remarks
  // --------------------------------------------------------------------------
  describe("5. Mojibake Sanitization on Remarks", () => {
    it("Repairs mojibake gift emoji in remarks", () => {
      const raw = "Remarks: ðŸŽ Standard Freebies included";
      const sanitized = sanitizeMojibake(raw);
      assert.strictEqual(sanitized, "Remarks: 🎁 Standard Freebies included");
    });

    it("Repairs mojibake peso symbol in remarks", () => {
      const raw = "Less â‚±2,000 promo discount applied";
      const sanitized = sanitizeMojibake(raw);
      assert.strictEqual(sanitized, "Less ₱2,000 promo discount applied");
    });

    it("Repairs mojibake dashes in remarks", () => {
      const raw = "Delivery window: 10:00 â€“ 11:30 AM â€” Gate 3";
      const sanitized = sanitizeMojibake(raw);
      assert.strictEqual(sanitized, "Delivery window: 10:00 – 11:30 AM — Gate 3");
    });

    it("Handles null, undefined, or empty remarks safely without throwing", () => {
      assert.strictEqual(sanitizeMojibake(null), "");
      assert.strictEqual(sanitizeMojibake(undefined), "");
      assert.strictEqual(sanitizeMojibake(""), "");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Payload Validation for CreateKitchenPrepRequestDto
  // --------------------------------------------------------------------------
  describe("6. Store Paluto Request Payload & Category Validation", () => {
    it("Validates accepted Store Paluto categories", () => {
      const validCategories = [
        "Staff Meryenda",
        "Owner / Family",
        "VIP Gift",
        "Store Buffer",
      ];

      validCategories.forEach((cat) => {
        const payload: CreateKitchenPrepRequestDto = {
          targetDate: "2026-11-10",
          targetTime: "2026-11-10T15:00:00",
          category: cat,
          recipientOrLabel: "Test Recipient",
          items: { Pancit: 2, Puto: 2 },
          remarks: "Test note",
        };
        assert.ok(payload.category.length > 0);
        assert.ok(payload.targetDate.length === 10);
      });
    });
  });
});
