import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseMessengerTextToDraft,
  extractSingleLineNumber,
  parseSingleLinePrice,
} from "../messengerTextParser.ts";
import {
  calculateBellySlotsUsed,
  canIncrementBellyFreebie,
  createDefaultBellyCokeSwap,
  createPromoPackageCounts,
  getPromoSlotsUsed,
  hydrateBellyFreebiesFromOverrides,
  parsePromoCustomization,
} from "../freebiesHelper.ts";

describe("December promo custom allocation helpers", () => {
  it("prefills all ten item channels and preserves a zero-cost seven-slot swap", () => {
    const defaults = createPromoPackageCounts({
      Sarsa: 1,
      Pancit: 1,
      Spaghetti: 1,
      Puto: 1,
      "Fried Chicken": 1,
      Shanghai: 1,
      Bopis: 1,
    }, 1);
    const swapped = { ...defaults, Spaghetti: 0, Pancit: 2 };
    assert.strictEqual(getPromoSlotsUsed(defaults), 7);
    assert.strictEqual(getPromoSlotsUsed(swapped), 7);
    const parsed = parsePromoCustomization(JSON.stringify({
      promoCustomized: true,
      promoCounts: swapped,
    }));
    assert.strictEqual(parsed.customized, true);
    assert.strictEqual(parsed.counts.Pancit, 2);
    assert.strictEqual(parsed.counts.Spaghetti, 0);
    assert.strictEqual(parsed.counts.Shanghai, 1);
  });
});

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
    name: "Sarsa",
    basePrice: 50,
    isActive: true,
    minimumWeightKg: 0,
    maximumWeightKg: 0,
  },
  {
    id: 4,
    name: "Belly 5kg",
    basePrice: 4200,
    isActive: true,
    minimumWeightKg: 5,
    maximumWeightKg: 5,
  },
  {
    id: 5,
    name: "Belly 4kg",
    basePrice: 3700,
    isActive: true,
    minimumWeightKg: 4,
    maximumWeightKg: 4,
  },
];

describe("R2 Messenger Parser Single-Line Numeric Extraction", () => {
  it("AC 1: Total Balance with 16,825 followed by Promo yields 16825 (900 mismatch against 17725)", () => {
    const text = [
      "Name: Juan Dela Cruz",
      "Order / Size: 1 Large",
      "Total Balance : 16,825",
      "",
      "Promo (Freebies or Less 2k) : 7 Freebies",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, 16825);
    assert.strictEqual(draft.quotedBalanceDue, 16825);
    assert.strictEqual(draft.freebiesOptOut, false);
    assert.strictEqual(draft.discount, null);

    // Mismatch verification against 1 Large (17,725)
    const cartTotal = 17725;
    const mismatch = cartTotal - (draft.parsedTotalBalance ?? 0);
    assert.strictEqual(mismatch, 900);
  });

  it("AC 2: Total Balance empty followed by Promo yields null (0 discount, no mismatch banner)", () => {
    const text = [
      "Name: Juan Dela Cruz",
      "Order / Size: 1 Large",
      "Total Balance : ",
      "",
      "Promo (Freebies or Less 2k) : 7 Freebies",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, null);
    assert.strictEqual(draft.quotedBalanceDue, null);
    assert.strictEqual(draft.freebiesOptOut, false);
    assert.strictEqual(draft.discount, null);
  });

  it("AC 3: Single-line numeric fields never concatenate numbers across newlines", () => {
    const text = [
      "Name: Maria Santos",
      "Down Payment (DP) : 1,000",
      "Ref 500",
      "Delivery Charge : 350",
      "Rider Tip 50",
      "Delivery Distance (KM) : 12km",
      "Route #4",
      "Price : 17,725",
      "Add-on: 500",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.downpayment, 1000);
    assert.strictEqual(draft.deliveryFee, 350);
    assert.strictEqual(draft.distanceKm, 12);
    assert.strictEqual(draft.quotedItemsTotal, 17725);
  });

  it("AC 4: Parenthetical hints stripped on single line", () => {
    const text = [
      "Name: Pedro Penduko",
      "Total Balance : 16,825 (For Admin)",
      "Down Payment (DP) : 1,000 (GCash Ref #9876)",
      "Delivery Distance (KM) : 15km (Approx)",
      "Delivery Charge : 350 (Paid)",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, 16825);
    assert.strictEqual(draft.downpayment, 1000);
    assert.strictEqual(draft.downpaymentMethod, "GCash");
    assert.strictEqual(draft.distanceKm, 15);
    assert.strictEqual(draft.deliveryFee, 350);
  });

  it("AC 5: Parenthetical-only lines return null", () => {
    const text = [
      "Name: Ana Ramos",
      "Total Balance : (For Admin)",
      "Down Payment (DP) : (GCash/Maya/Bank)",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, null);
    assert.strictEqual(draft.downpayment, null);
  });

  it("AC 6: Promo with Less 2k triggers freebiesOptOut and 2000 discount", () => {
    const text = [
      "Name: Jose Rizal",
      "Order / Size: 1 Large",
      "Total Balance : 15,725",
      "Promo (Freebies or Less 2k) : Less 2k",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.freebiesOptOut, true);
    assert.strictEqual(draft.discount, 2000);
    assert.strictEqual(draft.parsedTotalBalance, 15725);
  });

  it("AC 7: Price addition expressions evaluate correctly", () => {
    assert.strictEqual(parseSingleLinePrice("15,000 + 2,725"), 17725);
    assert.strictEqual(
      parseSingleLinePrice("15,000 + 2,725 (For Admin)"),
      17725,
    );
    assert.strictEqual(parseSingleLinePrice("17,725"), 17725);
    assert.strictEqual(parseSingleLinePrice(""), null);
    assert.strictEqual(extractSingleLineNumber(""), null);
    assert.strictEqual(extractSingleLineNumber("None"), null);
  });

  it("AC 8: Special Request (Optional) does not bleed into Freebies", () => {
    const text = [
      "Name: Juan Dela Cruz",
      "Order / Size: 1 Large",
      "Promo (Freebies or Less 2k) : 7 Freebies",
      "Special Request (Optional) : Extra crispy skin",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.freebiesOptOut, false);
    assert.strictEqual(
      (draft.remarks ?? "").toLowerCase().includes("extra crispy skin"),
      true,
    );
  });

  it("AC 9: Richard Hernandez template parses selected promo, paid DP, address, and range start", () => {
    const text = [
      "Name : Richard Hernandez",
      "Order / Size : large",
      "Price: 11,500",
      "Selected Promo (Freebies or Less ₱2K) : Less 2k",
      "Delivery Address : 8232 konsehales st. Brgy.8 Carmona Cavite",
      "Date & Time Nov 09/5pm to 6pm",
      "Down Payment (DP) :5000(paid)",
      "Total Balance :6,500",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.discount, 2000);
    assert.strictEqual(draft.downpayment, 5000);
    assert.strictEqual(draft.parsedTotalBalance, 6500);
    assert.strictEqual(
      draft.deliveryAddress,
      "8232 konsehales st. Brgy.8 Carmona Cavite",
    );
    assert.strictEqual(draft.targetDeliveryTime, "2026-11-09T17:00:00");
  });
});

describe("December promo package and Belly Liver Sauce Only parsing", () => {
  const parseDecemberPromo = (promo: string, date = "12/05/2026 10:00 AM", order = "1 Large") =>
    parseMessengerTextToDraft(
      [
        "Name: December QA",
        `Date & Time: ${date}`,
        `Order / Size: ${order}`,
        `Selected December Promo: ${promo}`,
      ].join("\n"),
      MOCK_CATEGORIES,
    );

  const optionCases = [
    ["Option 1 – Pancit + Dinuguan", "DEC_OPT1_PANCIT_DINUGUAN"],
    ["Option 1 – Pancit + Bopis", "DEC_OPT1_PANCIT_BOPIS"],
    ["Option 1 – Palabok + Dinuguan", "DEC_OPT1_PALABOK_DINUGUAN"],
    ["Option 1 – Palabok + Bopis", "DEC_OPT1_PALABOK_BOPIS"],
    ["Option 2 – Chicken + Dinuguan", "DEC_OPT2_CHICKEN_DINUGUAN"],
    ["Option 2 – Chicken + Bopis", "DEC_OPT2_CHICKEN_BOPIS"],
    ["Option 2 – Shanghai + Dinuguan", "DEC_OPT2_SHANGHAI_DINUGUAN"],
    ["Option 2 – Shanghai + Bopis", "DEC_OPT2_SHANGHAI_BOPIS"],
  ] as const;

  for (const [label, code] of optionCases) {
    it(`maps ${label} to ${code}`, () => {
      const draft = parseDecemberPromo(label);
      assert.strictEqual(draft.promoPackageCode, code);
      assert.strictEqual(draft.promoPackageLabel, label);
    });
  }

  it("maps Option 3 and scales the ₱2,000 discount per Whole Lechon", () => {
    const draft = parseDecemberPromo("Option 3 – ₱2,000 Cash Discount", "12/05/2026 3:00 PM", "2 Large");
    assert.strictEqual(draft.promoPackageCode, "DEC_OPT3_LESS_2K");
    assert.strictEqual(draft.freebiesOptOut, true);
    assert.strictEqual(draft.discount, 4000);
  });

  it("maps Less 2k on a December regular date to Option 3", () => {
    const draft = parseDecemberPromo("Less 2k");
    assert.strictEqual(draft.promoPackageCode, "DEC_OPT3_LESS_2K");
  });

  it("maps Dec 24 Bopis and defaults the other peak choice to Dinuguan", () => {
    assert.strictEqual(
      parseDecemberPromo("Bopis", "12/24/2026 4:00 PM").promoPackageCode,
      "DEC_PEAK_BOPIS",
    );
    assert.strictEqual(
      parseDecemberPromo("Peak Holiday Freebies", "12/31/2026 11:00 AM").promoPackageCode,
      "DEC_PEAK_DINUGUAN",
    );
  });

  it("auto-allocates both Belly slots to Sarsa for w/LIVER SAUCE ONLY", () => {
    const draft = parseMessengerTextToDraft(
      [
        "Name: Belly QA",
        "Date & Time: 12/05/2026 10:00 AM",
        "Order / Size: 2x 3kg Lechon Belly",
        "Remarks: w/LIVER SAUCE ONLY",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(draft.customizeBellyFreebies, true);
    assert.strictEqual(draft.bellyFreebiesAutoSwap, true);
    assert.strictEqual(draft.bellyFreebieOverrides?.Sarsa, 4);
    assert.strictEqual(draft.bellyFreebieOverrides?.Pancit, 0);
    assert.strictEqual(draft.bellyFreebieOverrides?.Dinuguan, 0);
    assert.strictEqual(draft.bellyFreebieOverrides?.Puto, 0);
  });

  const bellyPhrases = [
    "w/LIVER SAUCE ONLY",
    "liver sauce only",
    "sarsa only",
    "palit sarsa",
    "replace pancit with sarsa",
  ];
  for (const phrase of bellyPhrases) {
    it(`auto-allocates Belly slots to Sarsa for phrase: "${phrase}"`, () => {
      const draft = parseMessengerTextToDraft(
        [
          "Name: Belly QA",
          "Date & Time: 12/05/2026 10:00 AM",
          "Order / Size: 1 Belly 3kg",
          `Remarks: ${phrase}`,
        ].join("\n"),
        MOCK_CATEGORIES,
      );
      assert.strictEqual(draft.customizeBellyFreebies, true);
      assert.strictEqual(draft.bellyFreebiesAutoSwap, true);
      assert.strictEqual(draft.bellyFreebieOverrides?.Sarsa, 2);
      assert.strictEqual(draft.bellyFreebieOverrides?.Pancit, 0);
      assert.strictEqual(draft.bellyFreebieOverrides?.Dinuguan, 0);
      assert.strictEqual(draft.bellyFreebieOverrides?.Puto, 0);
      const hydratedAfterCartSync = hydrateBellyFreebiesFromOverrides(
        draft.bellyFreebieOverrides ?? {},
        [{ kg: 3, quantity: 1 }],
        draft.freebiesCustomizationNote ?? "",
      );
      assert.strictEqual(hydratedAfterCartSync.Sarsa, 2);
      assert.strictEqual(hydratedAfterCartSync.Dinuguan, 0);
      assert.strictEqual(
        calculateBellySlotsUsed(hydratedAfterCartSync, [{ kg: 3, quantity: 1 }]).slotsUsed,
        2,
      );
    });
  }

  it("scales belly Sarsa overrides for multi-belly orders (2 bellies -> 4, 3 bellies -> 6)", () => {
    const draft2 = parseMessengerTextToDraft(
      [
        "Name: Belly Multi 2",
        "Date & Time: 12/05/2026 10:00 AM",
        "Order / Size: 2x Belly 3kg",
        "Remarks: sarsa only",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(draft2.bellyFreebieOverrides?.Sarsa, 4);
    assert.strictEqual(draft2.bellyFreebieOverrides?.Pancit, 0);

    const draft3 = parseMessengerTextToDraft(
      [
        "Name: Belly Multi 3",
        "Date & Time: 12/05/2026 10:00 AM",
        "Order / Size: 3x Belly 4kg",
        "Remarks: liver sauce only",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(draft3.bellyFreebieOverrides?.Sarsa, 6);
    assert.strictEqual(draft3.bellyFreebieOverrides?.Pancit, 0);
  });

  it("isolates Belly Liver Sauce Only overrides from Whole Lechon in mixed order", () => {
    const draft = parseMessengerTextToDraft(
      [
        "Name: Mixed Order QA",
        "Date & Time: 12/05/2026 10:00 AM",
        "Order / Size: 1 Large, 1 Belly 3kg",
        "Selected December Promo: Option 1 – Pancit + Dinuguan",
        "Remarks: w/LIVER SAUCE ONLY",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(draft.items.length, 2);
    // Whole Lechon promo is preserved and unaffected
    assert.strictEqual(draft.promoPackageCode, "DEC_OPT1_PANCIT_DINUGUAN");
    assert.strictEqual(draft.promoPackageLabel, "Option 1 – Pancit + Dinuguan");
    // Belly auto-swap triggers
    assert.strictEqual(draft.customizeBellyFreebies, true);
    assert.strictEqual(draft.bellyFreebiesAutoSwap, true);
    assert.strictEqual(draft.bellyFreebieOverrides?.Sarsa, 2);
    assert.strictEqual(draft.bellyFreebieOverrides?.Pancit, 0);
  });

  const headerVariants = [
    "Selected Promo:",
    "December Promo:",
    "Selected December Promo:",
  ];
  for (const header of headerVariants) {
    it(`parses December promo using header "${header}"`, () => {
      const draft = parseMessengerTextToDraft(
        [
          "Name: Header QA",
          "Date & Time: 12/05/2026 10:00 AM",
          "Order / Size: 1 Large",
          `${header} Option 2 – Shanghai + Bopis`,
        ].join("\n"),
        MOCK_CATEGORIES,
      );
      assert.strictEqual(draft.promoPackageCode, "DEC_OPT2_SHANGHAI_BOPIS");
      assert.strictEqual(draft.promoPackageLabel, "Option 2 – Shanghai + Bopis");
    });
  }

  it("correctly matches Dec 24 and Dec 31 peak date choices (Bopis vs Dinuguan)", () => {
    // Dec 24 with Bopis
    const d24Bopis = parseMessengerTextToDraft(
      [
        "Name: Peak 24 Bopis",
        "Date & Time: 12/24/2026 4:00 PM",
        "Order / Size: 1 Large",
        "Selected Promo: Dec 24/31 – Bopis",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(d24Bopis.promoPackageCode, "DEC_PEAK_BOPIS");

    // Dec 24 default Dinuguan
    const d24Dinuguan = parseMessengerTextToDraft(
      [
        "Name: Peak 24 Dinuguan",
        "Date & Time: 12/24/2026 11:00 AM",
        "Order / Size: 1 Large",
        "Selected Promo: Peak Holiday Freebies",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(d24Dinuguan.promoPackageCode, "DEC_PEAK_DINUGUAN");

    // Dec 31 with Bopis
    const d31Bopis = parseMessengerTextToDraft(
      [
        "Name: Peak 31 Bopis",
        "Date & Time: 12/31/2026 5:00 PM",
        "Order / Size: 1 Large",
        "December Promo: Dec 24/31 – Bopis",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(d31Bopis.promoPackageCode, "DEC_PEAK_BOPIS");

    // Dec 31 default Dinuguan
    const d31Dinuguan = parseMessengerTextToDraft(
      [
        "Name: Peak 31 Dinuguan",
        "Date & Time: 12/31/2026 10:00 AM",
        "Order / Size: 1 Large",
        "Selected December Promo: Dec 24/31 – Dinuguan",
      ].join("\n"),
      MOCK_CATEGORIES,
    );
    assert.strictEqual(d31Dinuguan.promoPackageCode, "DEC_PEAK_DINUGUAN");
  });
});

describe("Feature 2: Lechon Belly Freebie 2/2 Slot Rules & 5kg Bilao -> 4x Coke Swap", () => {
  it("AC 9: 5kg Belly Bilao -> 4x 1.5L Coke counts as 2/2 slots (5 physical items)", () => {
    const bellyItems = [{ kg: 5, quantity: 1 }];
    const counts = { Sarsa: 1, "1.5L Coke": 4, Pancit: 0, Palabok: 0, Spaghetti: 0, Dinuguan: 0, Puto: 0 };
    const calc = calculateBellySlotsUsed(counts, bellyItems);

    assert.strictEqual(calc.slotsUsed, 2);
    assert.strictEqual(calc.totalSlotsAllowed, 2);
    assert.strictEqual(calc.belly5kgCount, 1);
    assert.strictEqual(calc.bilaoSelectedCount, 0);
    assert.strictEqual(calc.swappableBilaoSlotsForCoke, 1);
    assert.strictEqual(calc.cokeSlots, 1);

    // Cannot add a 5th coke (would exceed slots)
    assert.strictEqual(canIncrementBellyFreebie("1.5L Coke", counts, bellyItems), false);
    // Cannot add another Sarsa
    assert.strictEqual(canIncrementBellyFreebie("Sarsa", counts, bellyItems), false);
  });

  it("AC 10: 5kg Belly with 3 Cokes can still increment to 4th Coke without exceeding slot", () => {
    const bellyItems = [{ kg: 5, quantity: 1 }];
    const counts = { Sarsa: 1, "1.5L Coke": 3, Pancit: 0, Palabok: 0, Spaghetti: 0, Dinuguan: 0, Puto: 0 };
    const calc = calculateBellySlotsUsed(counts, bellyItems);

    assert.strictEqual(calc.slotsUsed, 2);
    // Even though slotsUsed === 2, adding 1 Coke stays at ceil(4/4) = 1 slot, so canIncrement is true!
    assert.strictEqual(canIncrementBellyFreebie("1.5L Coke", counts, bellyItems), true);
    // But cannot add non-coke item
    assert.strictEqual(canIncrementBellyFreebie("Sarsa", counts, bellyItems), false);
  });

  it("AC 11: 4kg Belly does not have Bilao swap, capping 1.5L Coke at 1 item", () => {
    const bellyItems = [{ kg: 4, quantity: 1 }];
    const counts = { Sarsa: 1, "1.5L Coke": 1, Pancit: 0, Palabok: 0, Spaghetti: 0, Dinuguan: 0, Puto: 0 };
    const calc = calculateBellySlotsUsed(counts, bellyItems);

    assert.strictEqual(calc.slotsUsed, 2);
    assert.strictEqual(calc.totalSlotsAllowed, 2);
    assert.strictEqual(calc.belly5kgCount, 0);
    assert.strictEqual(calc.swappableBilaoSlotsForCoke, 0);
    // Cannot add second coke (1 slot per coke on 4kg belly)
    assert.strictEqual(canIncrementBellyFreebie("1.5L Coke", counts, bellyItems), false);
  });

  it("AC 12: Sam Sam 5kg Belly template with '4PCS 1.5COKE AND LIVER SAUCE' hydrates to 1 Sarsa + 4 Coke (2/2 slots)", () => {
    const text = [
      "Name: Sam Sam",
      "Order / Size: 5kg Letchon belly",
      "FREEBIES: ✅4PCS 1.5COKE AND LIVER SAUCE ❗️",
      "Total Balance : 3,200",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.items.length, 1);
    assert.strictEqual(draft.items[0].itemCategoryId, 4); // Belly 5kg

    assert.ok(draft.freebieOverrides);
    assert.strictEqual(draft.freebieOverrides["1.5L Coke"], 4);
    assert.strictEqual(draft.freebieOverrides["Sarsa"], 1);

    const bellyItems = [{ kg: 5, quantity: 1 }];
    const hydrated = hydrateBellyFreebiesFromOverrides(
      draft.freebieOverrides,
      bellyItems,
      draft.freebiesCustomizationNote ?? "",
    );

    assert.strictEqual(hydrated.Sarsa, 1);
    assert.strictEqual(hydrated["1.5L Coke"], 4);
    assert.strictEqual(hydrated.Pancit, 0);

    const calc = calculateBellySlotsUsed(hydrated, bellyItems);
    assert.strictEqual(calc.slotsUsed, 2);
    assert.strictEqual(calc.totalSlotsAllowed, 2);
  });

  it("AC 13: Quick swap preset createDefaultBellyCokeSwap assigns 1 Sarsa + 4 Coke per 5kg belly", () => {
    const bellyItems = [
      { kg: 5, quantity: 1 },
      { kg: 3, quantity: 1 },
    ];
    const preset = createDefaultBellyCokeSwap(bellyItems);
    assert.strictEqual(preset["1.5L Coke"], 4);
    assert.strictEqual(preset.Sarsa, 2); // 1 for 5kg, 1 for 3kg
    assert.strictEqual(preset.Dinuguan, 1); // for 3kg
    assert.strictEqual(preset.Pancit, 0);

    const calc = calculateBellySlotsUsed(preset, bellyItems);
    assert.strictEqual(calc.slotsUsed, 4);
    assert.strictEqual(calc.totalSlotsAllowed, 4);
  });
});
