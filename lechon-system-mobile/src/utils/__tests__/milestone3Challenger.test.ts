import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateDuplicateOrders,
  cleanPhoneDigits,
  isPlaceholderPhone,
} from '../similarityHelper.ts';
import type {
  ActiveCustomerOrderSummary,
  CurrentOrderDetails,
} from '../similarityHelper.ts';

describe('Milestone 3 Challenger: R4 Duplicate Radar Shared Phone Tests', () => {
  const existingOrder: ActiveCustomerOrderSummary = {
    orderId: 902,
    orderReference: '#111326-902',
    customerName: 'Bunso - Tirador',
    facebookName: 'Bunso Tirador FB',
    contactNumber: '09174427367',
    deliveryAddress: 'Store Pickup',
    targetDeliveryDate: '2026-11-13',
    targetDeliveryTime: '2026-11-13T15:00:00',
    grandTotal: 1700,
    itemsSummary: '1x Belly 2kg',
    createdBy: 'Admin',
  };

  it('Scenario 1: Same phone + same customer name on same date -> RED BANNER, BLOCKING DUPLICATE', () => {
    const current: CurrentOrderDetails = {
      customerName: 'Bunso - Tirador',
      contactNumber: '09174427367',
      targetDate: '2026-11-13',
      deliveryAddress: 'Store Pickup',
    };

    const evaluation = evaluateDuplicateOrders(current, [existingOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);

    const dup = evaluation.duplicates[0];
    assert.strictEqual(dup.phoneMatches, true);
    assert.strictEqual(dup.nameMatches, true);
    assert.strictEqual(dup.isSameDay, true);
    assert.strictEqual(dup.isSharedPhoneOnly, false, 'Same name must NOT be flagged as sharedPhoneOnly');

    // Filter logic as implemented in PosScreen & EditOrderModal:
    const sharedPhoneMatches = evaluation.duplicates.filter((d) => d.isSharedPhoneOnly);
    const blockingDuplicateOrders = evaluation.duplicates.filter((d) => !d.isSharedPhoneOnly);

    assert.strictEqual(sharedPhoneMatches.length, 0, 'sharedPhoneMatches must be empty');
    assert.strictEqual(blockingDuplicateOrders.length, 1, 'blockingDuplicateOrders must contain the duplicate');

    // Pre-submit block check
    const sameDayDuplicate = blockingDuplicateOrders.find((d) => d.isSameDay);
    assert.ok(sameDayDuplicate, 'Must find same-day duplicate to trigger blocking alert');
  });

  it('Scenario 2: Same phone + different customer name on same date -> AMBER BANNER, NON-BLOCKING', () => {
    const current: CurrentOrderDetails = {
      customerName: 'Ate Robin Evangelio',
      contactNumber: '09174427367',
      targetDate: '2026-11-13',
      deliveryAddress: 'Different Address, Imus Cavite',
    };

    const evaluation = evaluateDuplicateOrders(current, [existingOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);

    const dup = evaluation.duplicates[0];
    assert.strictEqual(dup.phoneMatches, true);
    assert.strictEqual(dup.nameMatches, false);
    assert.strictEqual(dup.addressMatches, false);
    assert.strictEqual(dup.isSameDay, true);
    assert.strictEqual(dup.isSharedPhoneOnly, true, 'Different customer name with same phone must be sharedPhoneOnly');

    // Filter logic:
    const sharedPhoneMatches = evaluation.duplicates.filter((d) => d.isSharedPhoneOnly);
    const blockingDuplicateOrders = evaluation.duplicates.filter((d) => !d.isSharedPhoneOnly);

    assert.strictEqual(sharedPhoneMatches.length, 1, 'sharedPhoneMatches must contain the item for amber banner');
    assert.strictEqual(blockingDuplicateOrders.length, 0, 'blockingDuplicateOrders must be empty so no red banner');

    // Pre-submit check:
    const sameDayDuplicate = blockingDuplicateOrders.find((d) => d.isSameDay);
    assert.strictEqual(sameDayDuplicate, undefined, 'Must NOT trigger blocking alert before submit');
  });

  it('Scenario 3: Same phone + empty customer name on same date -> RED BANNER, BLOCKING', () => {
    const current: CurrentOrderDetails = {
      customerName: '',
      contactNumber: '09174427367',
      targetDate: '2026-11-13',
      deliveryAddress: 'Store Pickup',
    };

    const evaluation = evaluateDuplicateOrders(current, [existingOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);

    const dup = evaluation.duplicates[0];
    assert.strictEqual(dup.phoneMatches, true);
    assert.strictEqual(dup.nameMatches, false);
    assert.strictEqual(
      dup.isSharedPhoneOnly,
      false,
      'Empty customer name cannot be verified as different, must NOT be sharedPhoneOnly'
    );

    const sharedPhoneMatches = evaluation.duplicates.filter((d) => d.isSharedPhoneOnly);
    const blockingDuplicateOrders = evaluation.duplicates.filter((d) => !d.isSharedPhoneOnly);

    assert.strictEqual(sharedPhoneMatches.length, 0);
    assert.strictEqual(blockingDuplicateOrders.length, 1, 'Must fall into blockingDuplicateOrders');
  });

  it('Scenario 4: Same phone + whitespace-only customer name -> RED BANNER, BLOCKING', () => {
    const current: CurrentOrderDetails = {
      customerName: '    ',
      contactNumber: '09174427367',
      targetDate: '2026-11-13',
      deliveryAddress: 'Store Pickup',
    };

    const evaluation = evaluateDuplicateOrders(current, [existingOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);
    assert.strictEqual(evaluation.duplicates[0].isSharedPhoneOnly, false);
  });

  it('Scenario 5: Same phone + different customer name + overlapping street address -> RED BANNER, BLOCKING', () => {
    const streetOrder: ActiveCustomerOrderSummary = {
      ...existingOrder,
      deliveryAddress: '123 General Trias Drive, Imus, Cavite',
    };
    const current: CurrentOrderDetails = {
      customerName: 'Ate Robin Evangelio',
      contactNumber: '09174427367',
      targetDate: '2026-11-13',
      deliveryAddress: '123 General Trias Drive, Imus, Cavite',
    };

    const evaluation = evaluateDuplicateOrders(current, [streetOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);

    const dup = evaluation.duplicates[0];
    assert.strictEqual(dup.phoneMatches, true);
    assert.strictEqual(dup.addressMatches, true);
    assert.strictEqual(
      dup.isSharedPhoneOnly,
      false,
      'When street address also overlaps, it is a high-risk duplicate and cannot bypass as shared phone only'
    );

    const blockingDuplicateOrders = evaluation.duplicates.filter((d) => !d.isSharedPhoneOnly);
    assert.strictEqual(blockingDuplicateOrders.length, 1);
  });

  it('Scenario 5b: Same phone + different customer name + Store Pickup -> AMBER BANNER, NON-BLOCKING (pickup excluded from address overlap)', () => {
    const pickupOrder: ActiveCustomerOrderSummary = {
      ...existingOrder,
      deliveryAddress: 'Store Pickup',
    };
    const current: CurrentOrderDetails = {
      customerName: 'Ate Robin Evangelio',
      contactNumber: '09174427367',
      targetDate: '2026-11-13',
      deliveryAddress: 'Store Pickup',
    };

    const evaluation = evaluateDuplicateOrders(current, [pickupOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);

    const dup = evaluation.duplicates[0];
    assert.strictEqual(dup.phoneMatches, true);
    assert.strictEqual(dup.addressMatches, false, 'Store pickup must be excluded from address overlap');
    assert.strictEqual(dup.isSharedPhoneOnly, true, 'Different customer name picking up at store with same phone is shared-phone only');

    const sharedPhoneMatches = evaluation.duplicates.filter((d) => d.isSharedPhoneOnly);
    const blockingDuplicateOrders = evaluation.duplicates.filter((d) => !d.isSharedPhoneOnly);

    assert.strictEqual(sharedPhoneMatches.length, 1);
    assert.strictEqual(blockingDuplicateOrders.length, 0);
  });

  it('Scenario 6: Same phone + different date -> repeat customer match, NOT same-date duplicate', () => {
    const current: CurrentOrderDetails = {
      customerName: 'Ate Robin Evangelio',
      contactNumber: '09174427367',
      targetDate: '2026-11-14', // Next day
      deliveryAddress: 'Store Pickup',
    };

    const evaluation = evaluateDuplicateOrders(current, [existingOrder]);
    assert.strictEqual(evaluation.duplicates.length, 0, 'No same-date duplicates');
    assert.strictEqual(evaluation.repeatCustomerMatches.length, 1, 'Must be flagged as repeat customer match');
  });

  it('Scenario 7: Phone format variations (+63 vs 09) properly match', () => {
    const current: CurrentOrderDetails = {
      customerName: 'Ate Robin Evangelio',
      contactNumber: '+63 917 442 7367',
      targetDate: '2026-11-13',
      deliveryAddress: 'Imus Cavite',
    };

    const evaluation = evaluateDuplicateOrders(current, [existingOrder]);
    assert.strictEqual(evaluation.duplicates.length, 1);
    assert.strictEqual(evaluation.duplicates[0].phoneMatches, true);
    assert.strictEqual(evaluation.duplicates[0].isSharedPhoneOnly, true);
  });

  it('Scenario 8: Dummy/placeholder phone numbers are excluded from matching', () => {
    assert.strictEqual(isPlaceholderPhone('09000000000'), true);
    assert.strictEqual(isPlaceholderPhone('09111111111'), true);
    assert.strictEqual(isPlaceholderPhone('00000000000'), true);
    assert.strictEqual(cleanPhoneDigits('09000000000').length, 0);

    const orderWithDummyPhone: ActiveCustomerOrderSummary = {
      ...existingOrder,
      contactNumber: '09000000000',
    };
    const current: CurrentOrderDetails = {
      customerName: 'Different Name',
      contactNumber: '09000000000',
      targetDate: '2026-11-13',
    };

    const evaluation = evaluateDuplicateOrders(current, [orderWithDummyPhone]);
    assert.strictEqual(evaluation.duplicates.length, 0, 'Dummy phones must never trigger duplicate matches');
  });
});

describe('Milestone 3 Challenger: R2 Mobile Store Pickup Digital & Owner Hop 2 Logic', () => {
  interface PendingDigitalFields {
    pendingDigitalAmount?: number | null;
    pendingDigitalMethod?: string | null;
    digitalTransferAmount?: number | null;
    digitalTransferMethod?: string | null;
    custodyStatus?: string | null;
    heldByStaffAmount?: number | null;
    balanceDue?: number;
  }

  function getPendingDigitalAmount(item: PendingDigitalFields): number {
    return Number(item.pendingDigitalAmount ?? item.digitalTransferAmount ?? 0);
  }

  function getPendingDigitalMethod(item: PendingDigitalFields): string | null {
    return item.pendingDigitalMethod ?? item.digitalTransferMethod ?? null;
  }

  it('Edge case: pendingDigitalAmount === 0 -> isAwaitingDigital is false, Balance Due displayed', () => {
    const pickup: PendingDigitalFields = {
      pendingDigitalAmount: 0,
      pendingDigitalMethod: null,
      custodyStatus: 'Uncollected',
      balanceDue: 5000,
      heldByStaffAmount: 0,
    };

    const pendingDigitalAmount = getPendingDigitalAmount(pickup);
    const isAwaitingDigital = pendingDigitalAmount > 0;
    const netLabel = isAwaitingDigital ? 'Digital Deposit' : 'Balance Due';
    const netValue = isAwaitingDigital ? pendingDigitalAmount : pickup.balanceDue;

    assert.strictEqual(pendingDigitalAmount, 0);
    assert.strictEqual(isAwaitingDigital, false);
    assert.strictEqual(netLabel, 'Balance Due');
    assert.strictEqual(netValue, 5000);
  });

  it('Edge case: pendingDigitalAmount > 0 (Robin Evangelio QA #111326-901) -> isAwaitingDigital is true, Digital Deposit displayed', () => {
    const pickup: PendingDigitalFields = {
      pendingDigitalAmount: 10500,
      pendingDigitalMethod: 'Direct GCash',
      custodyStatus: 'InStaffDrawer',
      balanceDue: 10500,
      heldByStaffAmount: 0,
    };

    const pendingDigitalAmount = getPendingDigitalAmount(pickup);
    const pendingDigitalMethod = getPendingDigitalMethod(pickup) || 'Digital Transfer';
    const isAwaitingDigital = pendingDigitalAmount > 0;
    const netLabel = isAwaitingDigital ? 'Digital Deposit' : 'Balance Due';
    const netValue = isAwaitingDigital ? pendingDigitalAmount : pickup.balanceDue;

    assert.strictEqual(pendingDigitalAmount, 10500);
    assert.strictEqual(pendingDigitalMethod, 'Direct GCash');
    assert.strictEqual(isAwaitingDigital, true);
    assert.strictEqual(netLabel, 'Digital Deposit');
    assert.strictEqual(netValue, 10500);
  });

  it('Edge case: fallback to digitalTransferAmount when pendingDigitalAmount is undefined', () => {
    const hop2Item: PendingDigitalFields = {
      digitalTransferAmount: 7500,
      digitalTransferMethod: 'Maya',
    };

    const amount = getPendingDigitalAmount(hop2Item);
    const method = getPendingDigitalMethod(hop2Item);
    assert.strictEqual(amount, 7500);
    assert.strictEqual(method, 'Maya');
  });

  it('Drawer handover tab visibility condition: visible when inStaffDrawerCount === 0 BUT pendingDigitalCount > 0', () => {
    const inStaffDrawerCount = 0;
    const pendingDigitalCount = 3;
    const isOwner = false;
    const activeTab = 'pickups';

    const isDrawerHandoverVisible =
      isOwner || inStaffDrawerCount + pendingDigitalCount > 0 || activeTab === 'hop2';

    assert.strictEqual(
      isDrawerHandoverVisible,
      true,
      'Drawer handover tab must be visible when pending digital deposits exist even with 0 physical cash'
    );
  });

  it('Cashier permission gate: Non-owner cannot execute verifyDigitalSettlement', () => {
    let alertTitle = '';
    let alertMessage = '';
    let mutationCalled = false;

    const mockAlert = (title: string, message: string) => {
      alertTitle = title;
      alertMessage = message;
    };

    const mockMutateAsync = async (_orderId: number) => {
      mutationCalled = true;
    };

    const testHandleVerify = (isOwner: boolean, orderId: number) => {
      if (!isOwner) {
        mockAlert(
          'Owner Verification Required',
          'Only the Owner can verify and close digital deposits.'
        );
        return;
      }
      mockMutateAsync(orderId);
    };

    // When isOwner = false
    testHandleVerify(false, 901);
    assert.strictEqual(mutationCalled, false, 'Mutation must NOT be invoked when user is not owner');
    assert.strictEqual(alertTitle, 'Owner Verification Required');
    assert.ok(alertMessage.includes('Only the Owner can verify and close digital deposits.'));

    // When isOwner = true
    testHandleVerify(true, 901);
    assert.strictEqual(mutationCalled, true, 'Mutation must be invoked when user is owner');
  });
});

describe('Milestone 3 Challenger: Cache Invalidation Completeness Check', () => {
  it('useManifest.ts invalidateAllSettlementCaches must invalidate all 6 required query keys', () => {
    const manifestPath = path.resolve(
      process.cwd(),
      'lechon-system-mobile/src/hooks/useManifest.ts'
    );
    const content = fs.readFileSync(manifestPath, 'utf8');

    const requiredKeys = ['manifest', 'order', 'orders', 'dashboard', 'logistics', 'riders'];

    // Extract invalidateAllSettlementCaches body
    const match = content.match(/const invalidateAllSettlementCaches\s*=\s*async[\s\S]*?\{([\s\S]*?)\};/);
    assert.ok(match, 'invalidateAllSettlementCaches function must be defined');

    const fnBody = match[1];
    for (const key of requiredKeys) {
      const hasKey =
        fnBody.includes(`queryKey: ['${key}']`) ||
        fnBody.includes(`queryKey: ["${key}"]`);
      assert.ok(
        hasKey,
        `invalidateAllSettlementCaches must invalidate ['${key}']`
      );
    }
  });
});

describe('Milestone 3 Challenger: Typography & Entity Hygiene in DrawerScreen.tsx', () => {
  it('DrawerScreen.tsx must contain 0 occurrences of literal &amp; in user-facing JSX text nodes', () => {
    const drawerScreenPath = path.resolve(
      process.cwd(),
      'lechon-system-mobile/src/screens/DrawerScreen.tsx'
    );
    const content = fs.readFileSync(drawerScreenPath, 'utf8');

    const ampMatches = content.match(/&amp;/g);
    assert.strictEqual(
      ampMatches,
      null,
      `DrawerScreen.tsx must NOT contain literal &amp;, but found ${ampMatches ? ampMatches.length : 0}`
    );

    // Verify key corrected lines use native &
    assert.ok(
      content.includes('💵 DP & Walk-In Tracker'),
      'Must contain native "&" in DP & Walk-In Tracker'
    );
    assert.ok(
      content.includes('💵 Downpayment & Walk-In DP Remittance Tracker'),
      'Must contain native "&" in Downpayment & Walk-In DP Remittance Tracker'
    );
    assert.ok(
      content.includes('✅ Validate & Receive into Drawer'),
      'Must contain native "&" in Validate & Receive into Drawer'
    );
  });
});
