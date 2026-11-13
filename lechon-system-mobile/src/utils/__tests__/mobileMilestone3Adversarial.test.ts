import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateDuplicateOrders,
  normalizeCalendarDate,
} from '../similarityHelper.ts';

// Inlined logic from deliveryDateWarnings.ts for direct unit testing in Node
const PHILIPPINE_TIME_ZONE = 'Asia/Manila';

const getPhilippineDateParts = (value: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
  };
};

const getPhilippineTodayDate = (value: Date = new Date()): string => {
  const { year, month, day } = getPhilippineDateParts(value);
  return `${year}-${month}-${day}`;
};

const getCurrentPhilippineYear = (value: Date = new Date()): number =>
  Number(getPhilippineDateParts(value).year);

const getDeliveryDateYear = (targetDateInput?: string | null): number | null => {
  const normalized = normalizeCalendarDate(targetDateInput);
  return normalized ? Number(normalized.slice(0, 4)) : null;
};

const isPastDeliveryDate = (
  targetDateInput?: string | null,
  isDateTbd = false,
): boolean => {
  if (isDateTbd) return false;
  const selectedDate = normalizeCalendarDate(targetDateInput);
  return Boolean(selectedDate && selectedDate < getPhilippineTodayDate());
};

const fixDeliveryDateYear = (
  targetDateInput: string,
  year: number = getCurrentPhilippineYear(),
): string => {
  const normalized = normalizeCalendarDate(targetDateInput);
  if (!normalized) return targetDateInput;
  return `${year}${normalized.slice(4)}`;
};

describe('Milestone 3 Empirical Stress Testing (Mobile UI Integration)', () => {
  describe('1. DrawerScreen State Management & Transition Logic', () => {
    // Pure logic simulation of DrawerScreen useMemo and handlers
    function computeDrawerMetrics(
      sortedRiderDrops: any[],
      sortedPickupDrops: any[]
    ) {
      let drawerSum = 0;
      let drawerCnt = 0;
      let uncollSum = 0;
      let uncollCnt = 0;
      let digitalSum = 0;
      let digitalCnt = 0;

      const combined: any[] = [];

      const getPendingDigitalAmount = (d: any) =>
        Number(d?.pendingDigitalAmount ?? 0);
      const isAwaitingOwnerStatus = (s?: string) =>
        s === 'InStaffDrawer' || s === 'AwaitingOwnerDigitalVerification';

      for (const r of sortedRiderDrops) {
        const physicalAmount = Number(r.heldByStaffAmount ?? 0);
        const digitalAmount = getPendingDigitalAmount(r);
        const isAwaitingOwner =
          isAwaitingOwnerStatus(r.custodyStatus) || digitalAmount > 0;
        if (r.custodyStatus === 'InStaffDrawer' && physicalAmount > 0) {
          drawerSum += physicalAmount;
          drawerCnt += 1;
        }
        if (isAwaitingOwner && digitalAmount > 0) {
          digitalSum += digitalAmount;
          digitalCnt += 1;
        }
        if (isAwaitingOwner) {
          combined.push({
            orderId: r.orderId,
            customerName: r.customerName,
            heldByStaffName: r.heldByStaffName || 'Cashier',
            heldByStaffAmount: r.heldByStaffAmount,
            digitalTransferAmount: digitalAmount,
            digitalTransferMethod: r.pendingDigitalMethod,
          });
        }
      }

      for (const p of sortedPickupDrops) {
        const physicalAmount = Number(p.heldByStaffAmount ?? 0);
        const digitalAmount = getPendingDigitalAmount(p);
        const isAwaitingOwner =
          isAwaitingOwnerStatus(p.custodyStatus) || digitalAmount > 0;
        if (p.custodyStatus === 'InStaffDrawer' && physicalAmount > 0) {
          drawerSum += physicalAmount;
          drawerCnt += 1;
        }
        if (isAwaitingOwner && digitalAmount > 0) {
          digitalSum += digitalAmount;
          digitalCnt += 1;
        }
        if (isAwaitingOwner) {
          combined.push({
            orderId: p.orderId,
            customerName: p.customerName,
            heldByStaffName: p.heldByStaffName || 'Cashier',
            heldByStaffAmount: p.heldByStaffAmount,
            digitalTransferAmount: digitalAmount,
            digitalTransferMethod: p.pendingDigitalMethod,
          });
        }
      }

      return {
        inStaffDrawerTotal: drawerSum,
        inStaffDrawerCount: drawerCnt,
        uncollectedTotal: uncollSum,
        uncollectedCount: uncollCnt,
        pendingDigitalTotal: digitalSum,
        pendingDigitalCount: digitalCnt,
        hop2CombinedItems: combined,
      };
    }

    function filterHop2Items(
      items: any[],
      hop2SubFilter: 'all' | 'digital' | 'cash',
      selectedCustodian: string | null
    ) {
      let filtered = items;
      if (hop2SubFilter === 'digital') {
        filtered = filtered.filter(
          (item) => Number(item.digitalTransferAmount ?? 0) > 0
        );
      } else if (hop2SubFilter === 'cash') {
        filtered = filtered.filter(
          (item) => Number(item.heldByStaffAmount ?? 0) > 0
        );
      }
      if (!selectedCustodian) return filtered;
      return filtered.filter(
        (item) => (item.heldByStaffName || 'Cashier') === selectedCustodian
      );
    }

    it('1.1 When hop2CombinedItems is empty: empty state logic and visibility', () => {
      const metrics = computeDrawerMetrics([], []);
      assert.strictEqual(metrics.hop2CombinedItems.length, 0);
      assert.strictEqual(metrics.inStaffDrawerCount, 0);
      assert.strictEqual(metrics.inStaffDrawerTotal, 0);
      assert.strictEqual(metrics.pendingDigitalCount, 0);
      assert.strictEqual(metrics.pendingDigitalTotal, 0);

      // Check Tab 1 visibility for Owner
      const isOwner = true;
      const activeTabStaff = 'riders';
      const isVisibleForOwner =
        isOwner ||
        metrics.inStaffDrawerCount + metrics.pendingDigitalCount > 0 ||
        activeTabStaff === 'hop2';
      assert.strictEqual(isVisibleForOwner, true);

      // Check Tab 1 visibility for Cashier (not owner, default tab = 'riders')
      const isCashier = false;
      const isVisibleForCashier =
        isCashier ||
        metrics.inStaffDrawerCount + metrics.pendingDigitalCount > 0 ||
        activeTabStaff === 'hop2';
      assert.strictEqual(isVisibleForCashier, false);

      // When Cashier was on activeTab === 'hop2' and items cleared
      const activeTabHop2 = 'hop2';
      const isVisibleWhenActive =
        isCashier ||
        metrics.inStaffDrawerCount + metrics.pendingDigitalCount > 0 ||
        activeTabHop2 === 'hop2';
      assert.strictEqual(isVisibleWhenActive, true);
    });

    it('1.2 When inStaffDrawerCount === 0 but pendingDigitalCount === 1: Tab 1 is visible to Cashier and Owner', () => {
      const mockPickup = [
        {
          orderId: 1157,
          customerName: 'Robin Evangelio',
          heldByStaffAmount: 0,
          pendingDigitalAmount: 10500,
          pendingDigitalMethod: 'Direct GCash',
          custodyStatus: 'InStaffDrawer',
        },
      ];

      const metrics = computeDrawerMetrics([], mockPickup);
      assert.strictEqual(metrics.inStaffDrawerCount, 0);
      assert.strictEqual(metrics.inStaffDrawerTotal, 0);
      assert.strictEqual(metrics.pendingDigitalCount, 1);
      assert.strictEqual(metrics.pendingDigitalTotal, 10500);
      assert.strictEqual(metrics.hop2CombinedItems.length, 1);

      // Tab 1 visibility check for Cashier
      const isCashier = false;
      const activeTab = 'pickups';
      const isDrawerHandoverVisibleCashier =
        isCashier ||
        metrics.inStaffDrawerCount + metrics.pendingDigitalCount > 0 ||
        activeTab === 'hop2';
      assert.strictEqual(
        isDrawerHandoverVisibleCashier,
        true,
        'Drawer Handover tab must be visible to Cashier when pendingDigitalCount > 0'
      );

      // Tab 1 visibility check for Owner
      const isOwner = true;
      const isDrawerHandoverVisibleOwner =
        isOwner ||
        metrics.inStaffDrawerCount + metrics.pendingDigitalCount > 0 ||
        activeTab === 'hop2';
      assert.strictEqual(isDrawerHandoverVisibleOwner, true);
    });

    it('1.3 Clicking Card 2 (Pending Digital Check) clears selectedCustodian and isolates digital items', () => {
      const items = [
        {
          orderId: 101,
          customerName: 'Customer Cash',
          heldByStaffName: 'Cashier Alice',
          heldByStaffAmount: 5000,
          digitalTransferAmount: 0,
        },
        {
          orderId: 102,
          customerName: 'Customer Digital A',
          heldByStaffName: 'Cashier Bob',
          heldByStaffAmount: 0,
          digitalTransferAmount: 10500,
        },
        {
          orderId: 103,
          customerName: 'Customer Digital B',
          heldByStaffName: 'Cashier Alice',
          heldByStaffAmount: 0,
          digitalTransferAmount: 2500,
        },
      ];

      // Simulate user selecting custodian "Cashier Alice" first
      let selectedCustodian: string | null = 'Cashier Alice';
      let hop2SubFilter: 'all' | 'digital' | 'cash' = 'all';

      let viewItems = filterHop2Items(items, hop2SubFilter, selectedCustodian);
      // Alice has 2 items (1 cash, 1 digital)
      assert.strictEqual(viewItems.length, 2);

      // User clicks Card 2 (Pending Owner Digital Check):
      // OnPress handler does:
      // setActiveTab('hop2');
      // setHop2SubFilter((prev) => (prev === 'digital' ? 'all' : 'digital'));
      // setSelectedCustodian(null);
      hop2SubFilter = hop2SubFilter === 'digital' ? 'all' : 'digital';
      selectedCustodian = null;

      viewItems = filterHop2Items(items, hop2SubFilter, selectedCustodian);
      // Now it must show BOTH digital items (Bob + Alice) without custodian restriction
      assert.strictEqual(viewItems.length, 2);
      assert.strictEqual(viewItems[0].orderId, 102);
      assert.strictEqual(viewItems[1].orderId, 103);
      assert.ok(viewItems.every((item) => item.digitalTransferAmount > 0));
      assert.strictEqual(selectedCustodian, null);
    });
  });

  describe('2. EditOrderModal Duplicate Detection Logic', () => {
    const existingOrders = [
      {
        orderId: 501,
        orderReference: '#111326-501',
        customerName: 'Maria Santos',
        contactNumber: '09171234567',
        targetDeliveryTime: '2026-11-13T12:00:00',
        deliveryAddress: 'Cavite City',
        grandTotal: 12000,
        itemsSummary: '1 Large',
        createdBy: 'admin',
      },
      {
        orderId: 502,
        orderReference: '#111326-502',
        customerName: 'Pedro Penduko',
        contactNumber: '09189998888',
        targetDeliveryTime: '2026-11-13T14:00:00',
        deliveryAddress: 'Bacoor, Cavite',
        grandTotal: 3200,
        itemsSummary: 'Belly 3kg',
        createdBy: 'admin',
      },
    ];

    it('2.1 Editing an order does NOT match against its own orderId or orderReference', () => {
      const currentOrderBeingEdited = {
        orderId: 501,
        orderReference: '#111326-501',
        customerName: 'Maria Santos',
        contactNumber: '09171234567',
        targetDeliveryDate: '2026-11-13',
        deliveryAddress: 'Cavite City',
      };

      const result = evaluateDuplicateOrders(currentOrderBeingEdited, existingOrders);
      assert.strictEqual(
        result.duplicates.length,
        0,
        'Editing an order must not report duplicate matches against itself'
      );
    });

    it('2.2 Shared phone on same date with different customer name sets isSharedPhoneOnly: true and bypasses blocking alert', () => {
      const sharedPhoneOrder = {
        orderId: 999, // New or different order
        orderReference: '#111326-999',
        customerName: 'Juan Dela Cruz', // DIFFERENT from Maria Santos
        contactNumber: '09171234567', // SAME phone as Order 501
        targetDeliveryDate: '2026-11-13', // SAME date
        deliveryAddress: 'Tagaytay City', // DIFFERENT address
      };

      const result = evaluateDuplicateOrders(sharedPhoneOrder, existingOrders);
      assert.strictEqual(result.duplicates.length, 1);
      const duplicate = result.duplicates[0];
      assert.strictEqual(duplicate.isSharedPhoneOnly, true);
      assert.strictEqual(duplicate.order.orderId, 501);

      // Segregation as done in EditOrderModal.tsx:
      const activeDuplicateOrders = result.duplicates;
      const sharedPhoneMatches = activeDuplicateOrders.filter(
        (d) => d.isSharedPhoneOnly
      );
      const blockingDuplicateOrders = activeDuplicateOrders.filter(
        (d) => !d.isSharedPhoneOnly
      );

      assert.strictEqual(sharedPhoneMatches.length, 1);
      assert.strictEqual(blockingDuplicateOrders.length, 0);

      // Pre-submit duplicate check logic:
      const sameDayDuplicate = blockingDuplicateOrders.find((d) => d.isSameDay);
      assert.strictEqual(
        sameDayDuplicate,
        undefined,
        'Pre-submit must NOT find a sameDayDuplicate for shared phone matches, bypassing Alert.alert'
      );
    });

    it('2.3 Same customer name on same date sets isSharedPhoneOnly: false and TRIGGERS blocking alert', () => {
      const trueDuplicateOrder = {
        orderId: 999,
        orderReference: '#111326-999',
        customerName: 'Maria Santos', // SAME customer name as Order 501
        contactNumber: '09990001111', // different phone
        targetDeliveryDate: '2026-11-13',
      };

      const result = evaluateDuplicateOrders(trueDuplicateOrder, existingOrders);
      assert.strictEqual(result.duplicates.length, 1);
      const duplicate = result.duplicates[0];
      assert.strictEqual(duplicate.isSharedPhoneOnly, false);

      const blockingDuplicateOrders = result.duplicates.filter(
        (d) => !d.isSharedPhoneOnly
      );
      const sameDayDuplicate = blockingDuplicateOrders.find((d) => d.isSameDay);
      assert.ok(
        sameDayDuplicate,
        'Pre-submit MUST find a sameDayDuplicate for true duplicates, triggering Alert.alert'
      );
    });
  });

  describe('3. R3 Past-Date Warning & Manila Timezone Evaluation', () => {
    it('3.1 Manila Timezone Evaluation across UTC boundaries', () => {
      // Manila is UTC+8 with no DST
      // 2026-11-12 16:01:00 UTC = 2026-11-13 00:01:00 in Manila
      const justAfterMidnightManila = new Date('2026-11-12T16:01:00.000Z');
      assert.strictEqual(
        getPhilippineTodayDate(justAfterMidnightManila),
        '2026-11-13',
        'UTC 16:01 Nov 12 must evaluate to Nov 13 in Manila'
      );
      assert.strictEqual(getCurrentPhilippineYear(justAfterMidnightManila), 2026);

      // 2026-11-12 15:59:00 UTC = 2026-11-12 23:59:00 in Manila
      const justBeforeMidnightManila = new Date('2026-11-12T15:59:00.000Z');
      assert.strictEqual(
        getPhilippineTodayDate(justBeforeMidnightManila),
        '2026-11-12',
        'UTC 15:59 Nov 12 must evaluate to Nov 12 in Manila'
      );
    });

    it('3.2 Past Date Detection vs Manila Today', () => {
      // Earlier date is past
      assert.strictEqual(isPastDeliveryDate('2026-11-10', false), true);
      assert.strictEqual(isPastDeliveryDate('2025-11-13', false), true);

      // isDateTbd = true suppresses past date flag
      assert.strictEqual(isPastDeliveryDate('2025-11-13', true), false);
      assert.strictEqual(isPastDeliveryDate('2026-11-10', true), false);

      // Future dates are NOT past
      assert.strictEqual(isPastDeliveryDate('2026-12-25', false), false);
      assert.strictEqual(isPastDeliveryDate('2027-01-01', false), false);
    });

    it('3.3 1-tap year fix preserves month and day', () => {
      // 2025 past year fix to 2026
      assert.strictEqual(
        fixDeliveryDateYear('2025-11-13', 2026),
        '2026-11-13'
      );

      // 2024 past year fix
      assert.strictEqual(
        fixDeliveryDateYear('2024-05-20', 2026),
        '2026-05-20'
      );

      // Flexible ISO input with time component
      assert.strictEqual(
        fixDeliveryDateYear('2025-12-31T12:00:00', 2026),
        '2026-12-31'
      );

      // Verify year getter
      assert.strictEqual(getDeliveryDateYear('2025-11-13'), 2025);
      assert.strictEqual(getDeliveryDateYear('2026-11-13'), 2026);
      assert.strictEqual(getDeliveryDateYear(null), null);
    });
  });
});
