import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CapacityEvaluation } from "../../hooks/useKitchenCapacity";
import type { DownpaymentTrackerItem } from "../../hooks/useManifest";
import type { RoastingScheduleItem } from "../../hooks/useSchedules";
import { countKitchenRoster, filterKitchenBranch, groupRiderRoster } from "../dispatchRoster";
import { capacityStatusText, getBatchSlotTimes, getCapacityApproval, getCapacityDepartureTime, toCapacityFormTime } from "../kitchenCapacity";
import { compareDownpaymentsByEventDate, isTentativeDownpayment } from "../downpaymentEvents";
import { getOrderPromoItems } from "../freebiesHelper";

describe("November 25 operational upgrades", () => {
  it("counts two Jumbo heads and one belly line as five roasts while collecting cash once per order", () => {
    const jumbo: RoastingScheduleItem = {
      id: 1, orderId: 901, orderItemId: 11, orderReference: "112626-901",
      size: "Jumbo", quantity: 2, unitIndex: 1, unitTotal: 2, kitchenBranch: "CARMONA",
      tahiStartTime: "2026-11-26T11:30", salangStartTime: "2026-11-26T12:30",
      packagingStartTime: "2026-11-26T15:30", targetDeliveryTime: "2026-11-26T16:00",
      deliveryFee: 430, totalToCollect: 30430,
    };
    const records = [
      jumbo,
      { ...jumbo, id: 2, unitIndex: 2, salangStartTime: "2026-11-26T12:45" },
      { ...jumbo, id: 3, orderItemId: 12, size: "Belly 3kg", quantity: 3, isBelly: true, unitTotal: 1 },
      { ...jumbo, id: 4, orderId: 903, orderItemId: 14, size: "M", kitchenBranch: "SILANG", unitTotal: 1, quantity: 1 },
    ];
    const carmona = filterKitchenBranch(records, "CARMONA");
    assert.deepEqual(countKitchenRoster(carmona), { heads: 5, orders: 1 });
    assert.deepEqual(carmona.slice(0, 2).map((row) => row.unitIndex), [1, 2]);
    const groups = groupRiderRoster(carmona);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].lines.map(({ categoryName, quantity }) => `${quantity}x ${categoryName}`), ["2x Jumbo", "3x Belly 3kg"]);
    assert.equal(groups.reduce((sum, order) => sum + (order.totalToCollect ?? 0), 0), 30430);
    assert.equal(groups.reduce((sum, order) => sum + (order.deliveryFee ?? 0), 0), 430);
  });

  it("shows the last slot and full bands and requires an explicit owner approval for a squeeze", () => {
    const lastSlot: CapacityEvaluation = {
      branchCode: "CARMONA", batchCode: "PEAK_B2", currentPits: 13,
      incomingPits: 0, projectedPits: 13, maxPits: 14, remainingAfter: 1,
      status: "LastSlot", canFitWithOwnerSqueeze: false, squeezedProjectedPits: 13,
      requiresOwnerOverride: false, suggestedNextSlot: null,
    };
    const full: CapacityEvaluation = { ...lastSlot, incomingPits: 1, projectedPits: 14, remainingAfter: 0, status: "Full" };
    const squeeze: CapacityEvaluation = { ...full, projectedPits: 15, status: "Overbooked", requiresOwnerOverride: true, canFitWithOwnerSqueeze: true, squeezedProjectedPits: 14 };
    assert.equal(capacityStatusText[lastSlot.status], "🔥 LAST 1 SLOT LEFT");
    assert.equal(capacityStatusText[full.status], "🚫 FULL");
    assert.deepEqual(getCapacityApproval(full, false, false), { approved: false, blocked: false });
    assert.deepEqual(getCapacityApproval(squeeze, false, true), { approved: false, blocked: true });
    assert.deepEqual(getCapacityApproval(squeeze, true, false), { approved: false, blocked: true });
    assert.deepEqual(getCapacityApproval(squeeze, true, true), { approved: true, blocked: false });
  });

  it("anchors a quick batch at rider departure and preserves the delivery lead time", () => {
    assert.deepEqual(getBatchSlotTimes("2026-12-24", { anchorTime: "10:00:00" },
      "2026-12-24T14:45", "2026-12-24T14:00"), {
      targetTime: "2026-12-24T10:45", riderDepartureTime: "2026-12-24T10:00",
    });
    assert.equal(toCapacityFormTime("2026-11-26", "2026-11-26T16:13:00"), "2026-11-26T16:13");
  });

  it("uses the same departure fallback for evaluation and saving", () => {
    const target = "2026-12-24T09:00";
    assert.equal(getCapacityDepartureTime(target, "", 1), "2026-12-24T08:00");
    assert.equal(getCapacityDepartureTime(target, "", 2), target);
    assert.equal(getCapacityDepartureTime(target, "2026-12-24T08:30", 1), "2026-12-24T08:30");
    assert.equal(getCapacityDepartureTime(target, "2026-12-24T08:30", 0), target);
  });

  it("places paid tentative drafts and TBD rows after dated bookings while keeping their payment data", () => {
    const confirmed: DownpaymentTrackerItem = {
      orderId: 904, orderReference: "112626-904", customerName: "Confirmed Booking",
      downpaymentAmount: 2000, eventDate: "2026-11-26T16:00", paidAt: "2026-11-25T11:00",
    };
    const draft: DownpaymentTrackerItem = {
      orderId: 902, orderReference: "112626-902", customerName: "Jessy Tayone (Draft DP QA)",
      downpaymentAmount: 1000, paymentMethod: "Cash", eventDate: "2026-11-24T16:00",
      paidAt: "2026-11-25T09:00", isRemittedToOwner: false, isDraft: true, isDateTbd: true,
    };
    const tbd = { ...confirmed, orderId: 903, isDateTbd: true };
    assert.deepEqual([draft, tbd, confirmed].sort(compareDownpaymentsByEventDate).map((row) => row.orderId), [904, 902, 903]);
    assert.equal(isTentativeDownpayment(draft), true);
    assert.equal(draft.downpaymentAmount, 1000);
    assert.equal(draft.paymentMethod, "Cash");
  });

  it("shows actual saved December freebies before the default package allocation", () => {
    const standard = JSON.stringify({ Pancit: 1, "Fried Chicken": 1, Shanghai: 1, Dinuguan: 1 });
    assert.deepEqual(getOrderPromoItems(null, standard, 2), ["2x Pancit", "2x Fried Chicken", "2x Shanghai", "2x Dinuguan"]);
    const recorded = JSON.stringify({ promoCustomized: true, promoCounts: { "Fried Chicken": 1, Shanghai: 1, Bopis: 1, Dinuguan: 0 } });
    assert.deepEqual(getOrderPromoItems(recorded, standard, 1), ["1x Fried Chicken", "1x Shanghai", "1x Bopis"]);
  });
});
