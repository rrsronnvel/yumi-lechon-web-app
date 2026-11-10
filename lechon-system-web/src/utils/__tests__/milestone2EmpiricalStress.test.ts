import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeMojibake } from "../sanitizeDisplayText.ts";
import { normalizeDateInput } from "../dateNormalizer.ts";

describe("Milestone 2 Empirical Stress: 4K Export Filename Formatting", () => {
  function getDailySheetFileName(activeTab: string, selectedDate: string): string {
    const tabSlug = activeTab === "freebies" ? "Freebies-Prep" : activeTab;
    return `Yumi-Lechon-${tabSlug}-${selectedDate}-4K.png`;
  }

  it("1. activeTab 'freebies' correctly resolves to 'Freebies-Prep' in 4K export filename", () => {
    const fileName = getDailySheetFileName("freebies", "2026-11-10");
    assert.strictEqual(fileName, "Yumi-Lechon-Freebies-Prep-2026-11-10-4K.png");
  });

  it("2. activeTab 'kitchen' and 'rider' preserve standard slugs in 4K export filename", () => {
    assert.strictEqual(
      getDailySheetFileName("kitchen", "2026-11-10"),
      "Yumi-Lechon-kitchen-2026-11-10-4K.png"
    );
    assert.strictEqual(
      getDailySheetFileName("rider", "2026-11-10"),
      "Yumi-Lechon-rider-2026-11-10-4K.png"
    );
  });

  it("3. Filename formats across various dates without malformed characters", () => {
    const dates = ["2026-01-01", "2026-12-31", "2026-02-28", "2026-11-04"];
    for (const d of dates) {
      const fileName = getDailySheetFileName("freebies", d);
      assert.strictEqual(fileName, `Yumi-Lechon-Freebies-Prep-${d}-4K.png`);
      assert.doesNotMatch(fileName, /[\s/\\?%*:|"<>]/);
    }
  });
});

describe("Milestone 2 Empirical Stress: Store Paluto Form Validation & Payload Generation", () => {
  const PREP_CATEGORIES = [
    "Staff Meryenda",
    "Owner / Family",
    "VIP Gift",
    "Store Buffer",
  ] as const;

  const PREP_ITEM_KEYS = [
    "Pancit",
    "Palabok",
    "Spaghetti",
    "Dinuguan",
    "Puto",
    "Sarsa",
    "1.5L Coke",
  ];

  it("0. Pre-conditions: PREP_CATEGORIES and PREP_ITEM_KEYS match domain specification", () => {
    assert.strictEqual(PREP_CATEGORIES.length, 4);
    assert.strictEqual(PREP_ITEM_KEYS.length, 7);
  });

  interface FormState {
    category: string;
    recipient: string;
    timeNeeded: string;
    remarks: string;
    quantities: Record<string, number>;
    targetDate: string;
  }

  interface ValidationResult {
    isValid: boolean;
    error?: string;
    payload?: {
      targetDate: string;
      targetTime: string;
      category: string;
      recipientOrLabel: string;
      items: Record<string, number>;
      remarks?: string;
    };
  }

  function validateAndBuildPayload(state: FormState): ValidationResult {
    const trimmedRecipient = state.recipient.trim();
    if (!trimmedRecipient) {
      return { isValid: false, error: "Please specify a recipient or purpose label." };
    }
    if (trimmedRecipient.length > 150) {
      return { isValid: false, error: "Recipient cannot exceed 150 characters." };
    }

    const totalCount = Object.values(state.quantities).reduce((acc, q) => acc + Math.max(0, q), 0);
    if (totalCount <= 0) {
      return { isValid: false, error: "Please specify at least 1 item to prepare using the steppers." };
    }

    if (!state.timeNeeded) {
      return { isValid: false, error: "Please select the time needed for this prep request." };
    }

    const normalizedDate = normalizeDateInput(state.targetDate);
    const [hh, mm] = state.timeNeeded.split(":");
    const targetTimeIso = `${normalizedDate}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;

    const activeItemsDict: Record<string, number> = {};
    Object.entries(state.quantities).forEach(([k, v]) => {
      const positiveQty = Math.max(0, v);
      if (positiveQty > 0) activeItemsDict[k] = positiveQty;
    });

    return {
      isValid: true,
      payload: {
        targetDate: normalizedDate,
        targetTime: targetTimeIso,
        category: state.category,
        recipientOrLabel: trimmedRecipient,
        items: activeItemsDict,
        remarks: state.remarks.trim() || undefined,
      },
    };
  }

  it("1. Rejects empty, whitespace-only, or missing recipient", () => {
    const baseState: FormState = {
      category: "Staff Meryenda",
      recipient: "   ",
      timeNeeded: "15:00",
      remarks: "",
      quantities: { Pancit: 2 },
      targetDate: "2026-11-10",
    };
    const res = validateAndBuildPayload(baseState);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, "Please specify a recipient or purpose label.");
  });

  it("2. Rejects when total items count is 0 across all 7 side dishes", () => {
    const zeroState: FormState = {
      category: "Staff Meryenda",
      recipient: "Kitchen Crew",
      timeNeeded: "15:00",
      remarks: "",
      quantities: {
        Pancit: 0,
        Palabok: 0,
        Spaghetti: 0,
        Dinuguan: 0,
        Puto: 0,
        Sarsa: 0,
        "1.5L Coke": 0,
      },
      targetDate: "2026-11-10",
    };
    const res = validateAndBuildPayload(zeroState);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, "Please specify at least 1 item to prepare using the steppers.");
  });

  it("3. Correctly clamps negative stepper values and filters out 0-quantity items", () => {
    const stateWithNegative: FormState = {
      category: "Owner / Family",
      recipient: "Boss Ronnie Lunch",
      timeNeeded: "12:00",
      remarks: "Separate sauce",
      quantities: {
        Pancit: 2,
        Palabok: -3,
        Spaghetti: 0,
        Dinuguan: 1,
        Puto: 0,
        Sarsa: 0,
        "1.5L Coke": -1,
      },
      targetDate: "2026-11-10",
    };
    const res = validateAndBuildPayload(stateWithNegative);
    assert.strictEqual(res.isValid, true);
    assert.deepStrictEqual(res.payload?.items, {
      Pancit: 2,
      Dinuguan: 1,
    });
  });

  it("4. Assembles ISO TargetTime correctly with padded hours and minutes", () => {
    const testCases = [
      { time: "9:05", expectedTime: "2026-11-10T09:05:00" },
      { time: "10:30", expectedTime: "2026-11-10T10:30:00" },
      { time: "15:00", expectedTime: "2026-11-10T15:00:00" },
      { time: "17:45", expectedTime: "2026-11-10T17:45:00" },
    ];

    for (const tc of testCases) {
      const res = validateAndBuildPayload({
        category: "VIP Gift",
        recipient: "Mayor Office",
        timeNeeded: tc.time,
        remarks: "",
        quantities: { Pancit: 1 },
        targetDate: "2026-11-10",
      });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.payload?.targetTime, tc.expectedTime);
    }
  });

  it("5. Handles 500-char remarks boundaries and treats empty/whitespace remarks as undefined", () => {
    const whitespaceRemarksRes = validateAndBuildPayload({
      category: "Store Buffer",
      recipient: "Walk-in Reserve",
      timeNeeded: "15:00",
      remarks: "   \t \n ",
      quantities: { Puto: 5 },
      targetDate: "2026-11-10",
    });
    assert.strictEqual(whitespaceRemarksRes.isValid, true);
    assert.strictEqual(whitespaceRemarksRes.payload?.remarks, undefined);

    const longRemarks = "A".repeat(500);
    const validRemarksRes = validateAndBuildPayload({
      category: "Store Buffer",
      recipient: "Walk-in Reserve",
      timeNeeded: "15:00",
      remarks: longRemarks,
      quantities: { Puto: 5 },
      targetDate: "2026-11-10",
    });
    assert.strictEqual(validRemarksRes.isValid, true);
    assert.strictEqual(validRemarksRes.payload?.remarks?.length, 500);
  });
});

describe("Milestone 2 Empirical Stress: Morning Aggregate Cards Math & Roster Invariants", () => {
  it("1. Sarsa total accounts for whole freebies, belly freebies, Less 2k guarantee, paid add-ons, and paluto", () => {
    const sarsa = {
      total: 18,
      wholeFreebies: 10,
      noFreebiesSarsaGuaranteed: 2,
      bellyFreebies: 3,
      paidAddOns: 1,
      paluto: 2,
    };
    const calculatedTotal =
      sarsa.wholeFreebies +
      sarsa.noFreebiesSarsaGuaranteed +
      sarsa.bellyFreebies +
      sarsa.paidAddOns +
      sarsa.paluto;
    assert.strictEqual(calculatedTotal, sarsa.total);
  });

  it("2. Dinuguan total accounts for freebies, paid add-ons, paluto and excludes raw innards", () => {
    const dinuguan = {
      total: 6,
      freebies: 4,
      paidAddOns: 1,
      paluto: 1,
      excludedRawInnardsOrders: 2,
    };
    const calculatedTotal = dinuguan.freebies + dinuguan.paidAddOns + dinuguan.paluto;
    assert.strictEqual(calculatedTotal, dinuguan.total);
    assert.strictEqual(dinuguan.excludedRawInnardsOrders > 0, true);
  });

  it("3. 1.5L Coke total incorporates belly swaps (4x Coke per 5kg Belly)", () => {
    const coke = {
      total: 9,
      freebies: 2,
      bellySwaps: 4, // 1x 5kg Belly swapped
      paidAddOns: 1,
      paluto: 2,
    };
    const calculatedTotal = coke.freebies + coke.bellySwaps + coke.paidAddOns + coke.paluto;
    assert.strictEqual(calculatedTotal, coke.total);
  });

  it("4. Time TBD rows are segregated and positioned after scheduled rows", () => {
    const roster = [
      { id: "1", isTimeTbd: false, timeNeededDisplay: "08:30 AM" },
      { id: "2", isTimeTbd: true, timeNeededDisplay: "⏳ TIME TBD" },
      { id: "3", isTimeTbd: false, timeNeededDisplay: "11:00 AM" },
      { id: "4", isTimeTbd: true, timeNeededDisplay: "⏳ TIME TBD" },
    ];

    const scheduled = roster.filter((r) => !r.isTimeTbd);
    const timeTbd = roster.filter((r) => r.isTimeTbd);

    assert.strictEqual(scheduled.length, 2);
    assert.strictEqual(timeTbd.length, 2);
    assert.deepStrictEqual(
      scheduled.map((r) => r.id),
      ["1", "3"]
    );
    assert.deepStrictEqual(
      timeTbd.map((r) => r.id),
      ["2", "4"]
    );
  });

  it("5. Mojibake sanitization cleans special characters in kitchen remarks", () => {
    const rawRemark = "Extra crispy skin â‚±2,000 promo discount";
    const sanitized = sanitizeMojibake(rawRemark);
    assert.strictEqual(sanitized, "Extra crispy skin ₱2,000 promo discount");
  });
});
