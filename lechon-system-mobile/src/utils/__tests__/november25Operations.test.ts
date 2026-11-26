import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatManifestFreebiesSummary } from '../freebiesHelper.ts';
import { formatBatchAnchor, getCapacityMessage, getKitchenTiming, isCapacityBlocked, type CapacityEvaluation } from '../kitchenCapacity.ts';
import { isTentativeEvent, sortManifestItemsByDateAscending } from '../manifestDates.ts';

describe('Mobile paid draft tracker', () => {
  it('keeps paid drafts visible after scheduled orders, even when a draft has a date', () => {
    const paidDraft = {
      orderReference: '112626-902',
      isDraft: true,
      eventDate: '2026-11-25T10:00:00',
      amount: 1000,
      paymentMethod: 'Cash',
      isRemittedToOwner: false,
    };
    const scheduled = { orderReference: '112626-901', eventDate: '2026-11-26T16:00:00' };
    const tbd = { orderReference: 'TBD', isDateTbd: true };

    assert.deepEqual(sortManifestItemsByDateAscending([tbd, paidDraft, scheduled]), [scheduled, paidDraft, tbd]);
    assert.equal(isTentativeEvent(paidDraft), true);
    assert.equal(isTentativeEvent(tbd), true);
    assert.equal(isTentativeEvent(scheduled), false);
  });
});

describe('Mobile December promo summary', () => {
  it('lists all included dishes from the saved allocation', () => {
    const result = formatManifestFreebiesSummary({
      summary: '🎁 7 Whole Lechon Freebies • 🎁 Belly Freebies: 1x Sarsa, 1x 1.5L Coke',
      promoCode: 'DEC_OPT1_PANCIT_DINUGUAN',
      promoLabel: 'Option 1 – Pancit + Dinuguan (Customized)',
      configJson: JSON.stringify({
        promoCustomized: true,
        promoCounts: { Pancit: 1, 'Fried Chicken': 1, Shanghai: 1, Bopis: 1 },
      }),
      includedItems: { Dinuguan: 1 },
      wholePigCount: 1,
    });

    assert.match(result ?? '', /1x Fried Chicken/);
    assert.match(result ?? '', /1x Shanghai/);
    assert.match(result ?? '', /1x Bopis/);
    assert.doesNotMatch(result ?? '', /1x Dinuguan/);
    assert.match(result ?? '', /Belly Freebies: 1x Sarsa, 1x 1.5L Coke/);
  });

  it('uses the full preset for legacy coded orders with no saved promo counts', () => {
    const result = formatManifestFreebiesSummary({
      promoCode: 'DEC_OPT1_PANCIT_DINUGUAN',
      includedItems: { Pancit: 1, 'Fried Chicken': 1, Shanghai: 1, Dinuguan: 1 },
      wholePigCount: 2,
    });

    assert.match(result ?? '', /2x Fried Chicken/);
    assert.match(result ?? '', /2x Shanghai/);
    assert.match(result ?? '', /2x Dinuguan/);
    assert.doesNotMatch(result ?? '', /Bopis/);
  });
});

describe('Mobile booking capacity', () => {
  const squeezedBooking: CapacityEvaluation = {
    branchCode: 'CARMONA', batchCode: 'PEAK_B2', currentPits: 13, incomingPits: 1,
    projectedPits: 15, maxPits: 14, remainingAfter: 0, status: 'Overbooked',
    canFitWithOwnerSqueeze: true, squeezedProjectedPits: 14, suggestedNextSlot: null,
    requiresOwnerOverride: true,
  };

  it('blocks staff and unapproved owners and allows an explicitly approved owner', () => {
    assert.equal(isCapacityBlocked(squeezedBooking, false, false), true);
    assert.equal(isCapacityBlocked(squeezedBooking, false, true), true);
    assert.equal(isCapacityBlocked(squeezedBooking, true, false), true);
    assert.equal(isCapacityBlocked(squeezedBooking, true, true), false);
    assert.match(getCapacityMessage(squeezedBooking, false), /14\/14 pits.*ask Owner/);
    assert.match(getCapacityMessage(squeezedBooking, true), /15\/14 pits projected/);
  });

  it('allows a booking that fills the last pit', () => {
    const booking: CapacityEvaluation = {
      ...squeezedBooking, projectedPits: 14, status: 'Full', requiresOwnerOverride: false,
    };
    assert.equal(isCapacityBlocked(booking, false, false), false);
    assert.equal(getCapacityMessage(booking, false), '🚫 FULL (14/14 pits)');
    assert.equal(getCapacityMessage({ ...booking, projectedPits: 13, status: 'LastSlot' }, false), '🔥 LAST 1 SLOT LEFT (13/14 pits)');
  });

  it('uses the exact local departure time including midnight rollovers', () => {
    assert.deepEqual(getKitchenTiming('2026-12-24', '00:30', '23:00', 1), {
      targetTime: '2026-12-24T00:30:00', riderDepartureTime: '2026-12-23T23:00:00',
    });
    assert.deepEqual(getKitchenTiming('2026-12-24', '10:00', '09:30', 0), {
      targetTime: '2026-12-24T10:00:00', riderDepartureTime: '2026-12-24T10:00:00',
    });
    assert.deepEqual(getKitchenTiming('2026-12-24', '00:30', null, 1), {
      targetTime: '2026-12-24T00:30:00', riderDepartureTime: '2026-12-23T23:30:00',
    });
    assert.deepEqual(getKitchenTiming('2026-12-24', '10:00', null, 2), {
      targetTime: '2026-12-24T10:00:00', riderDepartureTime: '2026-12-24T10:00:00',
    });
    assert.equal(getKitchenTiming('2026-02-30', '10:00', null, 0), null);
    assert.equal(formatBatchAnchor('10:00:00'), '10 AM');
    assert.equal(formatBatchAnchor('14:30:00'), '2:30 PM');
  });
});
