import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseMessengerTextToDraft,
  extractSingleLineNumber,
  parseSingleLinePrice,
} from "../messengerTextParser.ts";

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
];

describe("Adversarial Stress Testing: Messenger Parser Numeric & Boundaries (Mobile)", () => {
  it("1. Total Balance with 16,825 followed by Promo yields 16825 (900 mismatch against 17725)", () => {
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

    const cartTotal = 17725;
    const mismatch = cartTotal - (draft.parsedTotalBalance ?? 0);
    assert.strictEqual(mismatch, 900);
  });

  it("2. Total Balance empty followed by Promo yields null (0 discount, no mismatch banner)", () => {
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

  it("3. Single-line numeric fields with unlabelled continuation lines (no concatenation)", () => {
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

  it("4. Parenthetical hints and suffixes on single line stripped cleanly", () => {
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

  it("5. Parenthetical-only lines return null", () => {
    const text = [
      "Name: Ana Ramos",
      "Total Balance : (For Admin)",
      "Down Payment (DP) : (GCash/Maya/Bank)",
      "Delivery Charge : (TBD)",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, null);
    assert.strictEqual(draft.downpayment, null);
    assert.strictEqual(draft.deliveryFee, null);
  });

  it("6. Empty values, whitespace, and tabs return null", () => {
    assert.strictEqual(extractSingleLineNumber(""), null);
    assert.strictEqual(extractSingleLineNumber("   "), null);
    assert.strictEqual(extractSingleLineNumber("\t\t  \t"), null);
    assert.strictEqual(extractSingleLineNumber(null), null);
    assert.strictEqual(extractSingleLineNumber(undefined), null);

    const text = [
      "Name: Ghost Order",
      "Total Balance :     ",
      "Down Payment (DP) :\t\t",
      "Delivery Charge :",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, null);
    assert.strictEqual(draft.downpayment, null);
    assert.strictEqual(draft.deliveryFee, null);
  });

  it("7. Multiple spaces and tabs before and after colon handled correctly", () => {
    const text = [
      "Name     :     Juan Dela Cruz",
      "Total Balance   :   16,825",
      "Down Payment (DP)\t:\t1,000",
      "Delivery Charge\t  :\t  350",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.customerName, "Juan Dela Cruz");
    assert.strictEqual(draft.parsedTotalBalance, 16825);
    assert.strictEqual(draft.downpayment, 1000);
    assert.strictEqual(draft.deliveryFee, 350);
  });

  it("8. Multiline addresses with house numbers do NOT bleed into numeric fields", () => {
    const text = [
      "Name: Juan Dela Cruz",
      "Order / Size: 1 Large",
      "Delivery Address : Unit 402, Building 7, Phase 3",
      "123 Rizal Street, Barangay 4",
      "Imus, Cavite 4103",
      "Landmark : Near 7-Eleven",
      "Total Balance : 16,825",
      "Down Payment (DP) : 1,000",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.ok(draft.deliveryAddress?.includes("Unit 402"));
    assert.ok(draft.deliveryAddress?.includes("123 Rizal Street"));
    assert.ok(draft.deliveryAddress?.includes("Cavite 4103"));
    assert.strictEqual(draft.landmark, "Near 7-Eleven");
    assert.strictEqual(draft.parsedTotalBalance, 16825);
    assert.strictEqual(draft.downpayment, 1000);
  });

  it("9. Multiple parenthetical blocks on single line handled safely", () => {
    assert.strictEqual(extractSingleLineNumber("(For Admin) 16,825 (Cash)"), 16825);
    assert.strictEqual(extractSingleLineNumber("(Paid) 1,000 (GCash Ref 123)"), 1000);
    assert.strictEqual(extractSingleLineNumber("(Standard) 350 (Free for VIP)"), 350);
  });

  it("10. Currency symbols (₱, Php, P) and decimals extracted properly", () => {
    assert.strictEqual(extractSingleLineNumber("₱16,825"), 16825);
    assert.strictEqual(extractSingleLineNumber("Php 16,825.50"), 16825.5);
    assert.strictEqual(extractSingleLineNumber("P 16,825"), 16825);
    assert.strictEqual(extractSingleLineNumber("1,000 PHP (Paid)"), 1000);
  });

  it("11. Zero values preserved (0 !== null)", () => {
    assert.strictEqual(extractSingleLineNumber("0"), 0);
    assert.strictEqual(extractSingleLineNumber("0.00"), 0);
    assert.strictEqual(extractSingleLineNumber("₱0"), 0);

    const text = [
      "Name: Juan Zero",
      "Total Balance : 0",
      "Down Payment (DP) : 0",
      "Delivery Charge : 0",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, 0);
    assert.strictEqual(draft.downpayment, 0);
    assert.strictEqual(draft.deliveryFee, 0);
  });

  it("12. Non-numeric text values return null (not NaN or 0)", () => {
    assert.strictEqual(extractSingleLineNumber("None"), null);
    assert.strictEqual(extractSingleLineNumber("Wala pa"), null);
    assert.strictEqual(extractSingleLineNumber("TBD"), null);
    assert.strictEqual(extractSingleLineNumber("Free"), null);
    assert.strictEqual(extractSingleLineNumber("N/A"), null);
  });

  it("13. Price multi-part additions evaluated accurately", () => {
    assert.strictEqual(parseSingleLinePrice("15,000 + 2,725"), 17725);
    assert.strictEqual(parseSingleLinePrice("10,000 + 5,000 + 2,725"), 17725);
    assert.strictEqual(parseSingleLinePrice("15,000 + 2,725 (For Admin)"), 17725);
    assert.strictEqual(parseSingleLinePrice("₱15,000 + ₱2,725"), 17725);
    assert.strictEqual(parseSingleLinePrice(""), null);
    assert.strictEqual(parseSingleLinePrice("   "), null);
  });

  it("14. Unlabelled lines following empty single-line headers terminate safely", () => {
    const text = [
      "Name: Test Customer",
      "Total Balance : ",
      "500",
      "Promo (Freebies or Less 2k) : 7 Freebies",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, null);
    assert.strictEqual(draft.quotedBalanceDue, null);
  });

  it("15. Section boundaries stop on dividers and disclaimer footers", () => {
    const text = [
      "Name: Footer Test",
      "Total Balance : 16,825",
      "--------------------------------",
      "Spaghetti, Palabok must be consumed within 3-4 hours",
      "Delivery Suggestion: keep warm",
    ].join("\n");

    const draft = parseMessengerTextToDraft(text, MOCK_CATEGORIES);
    assert.strictEqual(draft.parsedTotalBalance, 16825);
    assert.ok(!draft.remarks?.includes("consumed within"));
  });
});
