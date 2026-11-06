import { describe, it } from "node:test";
import assert from "node:assert";
import {
  FREEBIE_ITEMS,
  createDefaultBellyCounts,
  normalizeFreebiesConfig,
  formatFreebiesSummary,
  getBellySignature,
} from "../freebiesHelper.ts";
import type { BellyFreebieSource, FreebiesConfig } from "../freebiesHelper.ts";
import { parseMessengerTextToDraft } from "../messengerTextParser.ts";

const MOCK_CATEGORIES = [
  {
    id: 1,
    name: "Large",
    basePrice: 17725,
    isActive: true,
    minimumWeightKg: 25,
    maximumWeightKg: 27,
  },
  {
    id: 2,
    name: "Belly 3kg",
    basePrice: 3200,
    isActive: true,
    minimumWeightKg: 3,
    maximumWeightKg: 3,
  },
  {
    id: 3,
    name: "Belly 5kg",
    basePrice: 4200,
    isActive: true,
    minimumWeightKg: 5,
    maximumWeightKg: 5,
  },
  {
    id: 4,
    name: "Belly 2kg",
    basePrice: 2400,
    isActive: true,
    minimumWeightKg: 2,
    maximumWeightKg: 2,
  },
  {
    id: 5,
    name: "Belly 4kg",
    basePrice: 3500,
    isActive: true,
    minimumWeightKg: 4,
    maximumWeightKg: 4,
  },
  {
    id: 10,
    name: "Sarsa",
    basePrice: 50,
    isActive: true,
    minimumWeightKg: 0,
    maximumWeightKg: 0,
  },
];

describe("Adversarial Stress Suite (Mobile): Belly Freebies 2/2 Quota Cap & Normalization", () => {
  it("Stress 1: createDefaultBellyCounts & normalizeFreebiesConfig with 0 bellies (quota = 0)", () => {
    const bellyItems: BellyFreebieSource[] = [];
    const defaults = createDefaultBellyCounts(bellyItems);
    for (const item of FREEBIE_ITEMS) {
      assert.strictEqual(defaults[item], 0);
    }

    const config: FreebiesConfig = {
      optOut: false,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      bellyCounts: { Sarsa: 3, Pancit: 2 },
      bellySignature: getBellySignature(bellyItems),
    };

    const normalized = normalizeFreebiesConfig(config, 0, bellyItems);
    const totalBellyFreebies = FREEBIE_ITEMS.reduce(
      (sum, item) => sum + (normalized.bellyCounts?.[item] ?? 0),
      0
    );
    assert.strictEqual(totalBellyFreebies, 0, "0 bellies must yield 0 freebies");
  });

  it("Stress 2: 1 belly (quota = 2): default distribution and sum", () => {
    const bellyItems: BellyFreebieSource[] = [{ kg: 3, quantity: 1 }];
    const defaults = createDefaultBellyCounts(bellyItems);
    assert.strictEqual(defaults.Sarsa, 1);
    assert.strictEqual(defaults.Dinuguan, 1);
    const sumDefaults = FREEBIE_ITEMS.reduce((sum, item) => sum + (defaults[item] ?? 0), 0);
    assert.strictEqual(sumDefaults, 2, "1 belly default sum must be exactly 2");

    const belly5 = [{ kg: 5, quantity: 1 }];
    const defaults5 = createDefaultBellyCounts(belly5);
    assert.strictEqual(defaults5.Sarsa, 1);
    assert.strictEqual(defaults5.Pancit, 1);
    const sumDefaults5 = FREEBIE_ITEMS.reduce((sum, item) => sum + (defaults5[item] ?? 0), 0);
    assert.strictEqual(sumDefaults5, 2, "1x 5kg belly default sum must be exactly 2");
  });

  it("Stress 3: 2 bellies (quota = 4) and 5 bellies (quota = 10)", () => {
    const twoBellies: BellyFreebieSource[] = [
      { kg: 3, quantity: 1 },
      { kg: 5, quantity: 1 },
    ];
    const def2 = createDefaultBellyCounts(twoBellies);
    const sum2 = FREEBIE_ITEMS.reduce((sum, item) => sum + (def2[item] ?? 0), 0);
    assert.strictEqual(sum2, 4, "2 bellies default sum must be 4");

    const fiveBellies: BellyFreebieSource[] = [
      { kg: 2, quantity: 2 },
      { kg: 5, quantity: 3 },
    ];
    const def5 = createDefaultBellyCounts(fiveBellies);
    const sum5 = FREEBIE_ITEMS.reduce((sum, item) => sum + (def5[item] ?? 0), 0);
    assert.strictEqual(sum5, 10, "5 bellies default sum must be 10");
  });

  it("Stress 4: Attempting to set 5 freebies for 1 belly: clamped strictly to 2", () => {
    const bellyItems: BellyFreebieSource[] = [{ kg: 3, quantity: 1 }];
    const signature = getBellySignature(bellyItems);

    const maliciousConfig: FreebiesConfig = {
      optOut: false,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      bellyCounts: {
        Sarsa: 3,
        Dinuguan: 2,
        Pancit: 5,
        Palabok: 4,
        Spaghetti: 2,
      },
      bellySignature: signature,
    };

    const normalized = normalizeFreebiesConfig(maliciousConfig, 0, bellyItems);
    const sum = FREEBIE_ITEMS.reduce(
      (total, item) => total + (normalized.bellyCounts?.[item] ?? 0),
      0
    );
    assert.strictEqual(sum, 2, "Excess freebies must be strictly clamped to 2");
    assert.strictEqual(normalized.bellyCounts?.Sarsa, 2);
    assert.strictEqual(normalized.bellyCounts?.Dinuguan, 0);
    assert.strictEqual(normalized.bellyCounts?.Pancit, 0);
  });

  it("Stress 5: Negative, non-integer, or NaN counts in bellyCounts sanitized safely", () => {
    const bellyItems: BellyFreebieSource[] = [{ kg: 4, quantity: 1 }];
    const signature = getBellySignature(bellyItems);

    const corruptConfig: FreebiesConfig = {
      optOut: false,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      bellyCounts: {
        Sarsa: -5,
        Puto: 1.9,
        Pancit: NaN,
        Dinuguan: 1,
      },
      bellySignature: signature,
    };

    const normalized = normalizeFreebiesConfig(corruptConfig, 0, bellyItems);
    const sum = FREEBIE_ITEMS.reduce(
      (total, item) => total + (normalized.bellyCounts?.[item] ?? 0),
      0
    );
    assert.ok(sum <= 2, "Sum must not exceed quota 2");
    assert.strictEqual(normalized.bellyCounts?.Sarsa, 0, "Negative count must sanitize to 0");
    assert.strictEqual(normalized.bellyCounts?.Puto, 1, "Float 1.9 must floor to 1");
    assert.strictEqual(normalized.bellyCounts?.Dinuguan, 1, "Dinuguan gets remaining 1");
  });

  it("Stress 6: Signature mismatch re-initializes bellyCounts to clean defaults", () => {
    const oldBellyItems: BellyFreebieSource[] = [{ kg: 3, quantity: 1 }];
    const newBellyItems: BellyFreebieSource[] = [{ kg: 5, quantity: 2 }];

    const config: FreebiesConfig = {
      optOut: false,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      bellyCounts: { Sarsa: 2 },
      bellySignature: getBellySignature(oldBellyItems),
    };

    const normalized = normalizeFreebiesConfig(config, 0, newBellyItems);
    assert.strictEqual(normalized.bellySignature, getBellySignature(newBellyItems));
    assert.strictEqual(normalized.bellyCounts?.Sarsa, 2);
    assert.strictEqual(normalized.bellyCounts?.Pancit, 2);
    const sum = FREEBIE_ITEMS.reduce(
      (total, item) => total + (normalized.bellyCounts?.[item] ?? 0),
      0
    );
    assert.strictEqual(sum, 4);
  });

  it("Stress 7: Messenger text parsing with 1 belly and excessive overrides capped to 2*bellyQty", () => {
    const text = [
      "Name: Juan Belly Fan",
      "Order / Size: 1 Belly 5kg",
      "FREEBIES: 4 Sarsa, 3 Pancit, 2 Coke",
      "Down Payment (DP) : 1,000",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.items?.length, 1);
    assert.strictEqual(draft.items[0].itemCategoryId, 3); // Belly 5kg

    const totalBellyQty = 1;
    const maxBellyQuota = totalBellyQty * 2;
    const overrides = draft.freebieOverrides || {};
    let remaining = maxBellyQuota;
    const cappedCounts: Record<string, number> = Object.fromEntries(
      FREEBIE_ITEMS.map((item) => [item, 0])
    );
    for (const item of FREEBIE_ITEMS) {
      const desired = Number(overrides[item] || 0);
      if (desired > 0) {
        const allotted = Math.min(desired, remaining);
        cappedCounts[item] = allotted;
        remaining -= allotted;
      }
    }
    const hydratedSum = FREEBIE_ITEMS.reduce((sum, item) => sum + (cappedCounts[item] ?? 0), 0);
    assert.strictEqual(hydratedSum, 2, "Hydrated freebie sum must be strictly capped to 2");
    assert.strictEqual(cappedCounts.Sarsa, 2);
    assert.strictEqual(cappedCounts.Pancit, 0);
  });

  it("Stress 8: Special Request (Optional) following FREEBIES does NOT bleed into freebies or swap notes", () => {
    const text = [
      "Name: Maria Makiling",
      "Order / Size: 1 Belly 3kg",
      "FREEBIES: Sarsa and Dinuguan",
      "Special Request (Optional) : liver sauce only, extra crispy skin",
      "Total Balance : 3,200",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.items?.length, 1);
    assert.strictEqual(draft.items[0].itemCategoryId, 2); // Belly 3kg

    assert.ok(
      (draft.remarks ?? "").toLowerCase().includes("liver sauce only"),
      `Remarks must capture culinary special request. Actual remarks: "${draft.remarks}"`
    );
    assert.ok(
      (draft.remarks ?? "").toLowerCase().includes("extra crispy skin"),
      `Remarks must capture extra crispy skin. Actual remarks: "${draft.remarks}"`
    );

    const overrides = draft.freebieOverrides || {};
    for (const key of Object.keys(overrides)) {
      assert.ok(
        FREEBIE_ITEMS.includes(key as any),
        `Unexpected non-freebie key in overrides: ${key}`
      );
    }
  });

  it("Stress 9: formatFreebiesSummary correctly reflects belly freebie counts and custom note", () => {
    const bellyItems: BellyFreebieSource[] = [{ kg: 5, quantity: 1 }];
    const config: FreebiesConfig = {
      optOut: false,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      bellyCounts: { Sarsa: 1, Pancit: 1 },
      bellyCustomizationNote: "No spicy sauce",
      bellySignature: getBellySignature(bellyItems),
    };

    const summary = formatFreebiesSummary(config, 0, 2000, bellyItems);
    assert.ok(summary !== null);
    assert.ok(summary.includes("🎁 Belly Freebies: 1x Sarsa, 1x Pancit"));
    assert.ok(summary.includes("Request: No spicy sauce"));
  });
});
