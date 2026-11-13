import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categorizeExpense, getExpenseCostType } from "../expenseCategorizer.ts";

describe("expense keyword categorizer", () => {
  const cases = [
    ["Lechon Belly Box", "Packaging"],
    ['10 pcs Platic Bilao 12"', "Packaging"],
    ["Manila Paper", "Packaging"],
    ["Live Pigs", "Meat / Main Products"],
    ["Fluid - Coke 1.5", "Ingredients & Freebies"],
    ["Toto gasoline", "Fuel"],
    ["Resort DP", "Owner / Non-Operating Outflow"],
    ["Paluwagan", "Owner / Non-Operating Outflow"],
  ] as const;

  for (const [description, expected] of cases) {
    it(`classifies ${description} as ${expected}`, () => {
      assert.equal(categorizeExpense(description), expected);
    });
  }

  it("applies packaging priority before the generic belly keyword", () => {
    assert.equal(categorizeExpense("5 Lechon Belly Boxes"), "Packaging");
  });

  it("derives the official accounting type from the category", () => {
    assert.equal(getExpenseCostType("Packaging"), "COGS");
    assert.equal(getExpenseCostType("Fuel"), "OPEX");
    assert.equal(getExpenseCostType("Owner / Non-Operating Outflow"), "NON_OP");
  });
});
