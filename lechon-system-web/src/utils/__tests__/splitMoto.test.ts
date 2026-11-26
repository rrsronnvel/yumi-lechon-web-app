import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RoastingScheduleItem } from "../../hooks/useSchedules";
import { computeEffectiveNetRemittance } from "../../hooks/useManifest";
import { groupRiderRoster } from "../dispatchRoster";
import { backupRiderLabel, canLogSupportRiderExpense, countWholeHeads, defaultBackupHeads, getHeadRider } from "../splitMoto";

const split = { supportRiderName: "Randy", supportRiderFee: 500, supportRiderHeads: 1 };

describe("split motorcycle assignment", () => {
  it("counts whole heads only and defaults a backup to the heads beyond the lead's first two", () => {
    assert.equal(countWholeHeads([
      { quantity: 3, itemCategory: { name: "M", minimumWeightKg: 18 } },
      { quantity: 7, itemCategory: { name: "Belly 3kg", minimumWeightKg: 3 } },
      { quantity: 2, itemCategory: { name: "Pancit", minimumWeightKg: 0 } },
    ]), 3);
    assert.equal(defaultBackupHeads(3), 1);
    assert.equal(defaultBackupHeads(12), 10);
  });

  it("shows the actual per-head rider without assigning backup custody or duplicating cash", () => {
    const first: RoastingScheduleItem = {
      id: 1, orderId: 903, orderItemId: 11, orderReference: "112626-903",
      size: "M", minimumWeightKg: 18, riderName: "Adrianne", unitIndex: 1, unitTotal: 3, quantity: 3,
      tahiStartTime: "2026-11-26T11:30", salangStartTime: "2026-11-26T12:30",
      packagingStartTime: "2026-11-26T15:30", targetDeliveryTime: "2026-11-26T16:00",
      deliveryFee: 500, totalToCollect: 33600, ...split,
    };
    const rows = [first, { ...first, id: 2, unitIndex: 2 }, { ...first, id: 3, unitIndex: 3, assignedRiderName: "Randy" }];
    assert.deepEqual(rows.map(getHeadRider), [
      { name: "Adrianne", role: "Lead" }, { name: "Adrianne", role: "Lead" }, { name: "Randy", role: "Backup" },
    ]);
    const riderRows = groupRiderRoster(rows);
    assert.equal(riderRows.length, 1);
    assert.equal(riderRows[0].wholeLechonQty, 3);
    const mixedRows = groupRiderRoster([
      ...rows,
      { ...first, id: 4, orderItemId: 12, size: "Belly 3kg", isBelly: true, minimumWeightKg: 3, quantity: 5, unitTotal: 1 },
      { ...first, id: 5, orderItemId: 13, size: "L", quantity: 1, unitTotal: 1 },
    ]);
    assert.equal(mixedRows[0].wholeLechonQty, 4);
    assert.equal(riderRows[0].totalToCollect, 33600);
    assert.equal(riderRows[0].deliveryFee, 500);
    assert.equal(riderRows[0].riderName, "Adrianne");
    assert.equal(backupRiderLabel(riderRows[0]), "+ Randy • Backup • Store Fee ₱500");
    assert.equal(computeEffectiveNetRemittance({
      totalCollected: 33600, riderDeliveryFee: 500, netRemittance: 33100,
    }), 33100);
  });

  it("shows a positive pending support expense once and keeps it separate from the cash split", () => {
    assert.equal(backupRiderLabel(split, "settlement"), "🛵 + Backup: Randy (Store Fee ₱500)");
    assert.equal(canLogSupportRiderExpense(split), true);
    assert.equal(canLogSupportRiderExpense({ ...split, supportRiderExpenseLogged: true }), false);
    assert.equal(canLogSupportRiderExpense({ ...split, supportRiderFee: 0 }), false);
    assert.equal(canLogSupportRiderExpense({ ...split, supportRiderName: "" }), false);
  });
});
