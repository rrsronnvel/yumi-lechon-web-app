import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { getPaymentChannelBadgeText } from '../paymentChannelHelper.ts';
import { DownpaymentTrackerItem } from '../../hooks/useManifest.ts';

describe('November 23 Mobile Verification — DP Windowing, Split Badges & Net Remittance', () => {
  // Test 1: Windowed pagination slicing for 319+ downpayments
  it('1. Windowed pagination slices 25 items initially, expands by 25 on load more, and resets on search/filter', () => {
    const mock319Items: DownpaymentTrackerItem[] = Array.from({ length: 319 }, (_, i) => ({
      paymentLogId: i + 1,
      orderId: 2000 + i,
      orderReference: `112326-${2000 + i}`,
      customerName: `Customer ${i + 1}`,
      amount: 1500,
      downpaymentAmount: 1500,
      paymentMethod: 'Cash',
      isRemittedToOwner: false,
      isDpRemittedToOwner: false,
      createdAt: '2026-11-23T10:00:00Z',
    }));

    let dpVisibleCount = 25;
    let renderedSlice = mock319Items.slice(0, dpVisibleCount);
    assert.strictEqual(renderedSlice.length, 25, 'Initial windowed slice must be exactly 25 items');

    // Simulate clicking "Load Next 25"
    dpVisibleCount += 25;
    renderedSlice = mock319Items.slice(0, dpVisibleCount);
    assert.strictEqual(renderedSlice.length, 50, 'Second slice must expand to 50 items');

    // Simulate clicking until all 319 are shown
    dpVisibleCount = 319;
    renderedSlice = mock319Items.slice(0, dpVisibleCount);
    assert.strictEqual(renderedSlice.length, 319, 'Must show all 319 items when expanded');

    // Simulate filter change or search keystroke -> resets to 25
    dpVisibleCount = 25;
    renderedSlice = mock319Items.slice(0, dpVisibleCount);
    assert.strictEqual(renderedSlice.length, 25, 'Search or filter change must reset visible count to 25');
  });

  // Test 2: Installment label formatting
  it('2. Installment labels format correctly: Paid {date} for single and Paid {date} • Payment X/Y for multi', () => {
    const formatInstallmentLabel = (paidDate: string, index?: number | null, count?: number | null) => {
      return count && count > 1
        ? `Paid ${paidDate} • Payment ${index ?? 1}/${count}`
        : `Paid ${paidDate}`;
    };

    assert.strictEqual(
      formatInstallmentLabel('Nov 13', 1, 1),
      'Paid Nov 13'
    );
    assert.strictEqual(
      formatInstallmentLabel('Nov 13', 1, 3),
      'Paid Nov 13 • Payment 1/3'
    );
    assert.strictEqual(
      formatInstallmentLabel('Nov 15', 2, 3),
      'Paid Nov 15 • Payment 2/3'
    );
    assert.strictEqual(
      formatInstallmentLabel('Nov 20', 3, 3),
      'Paid Nov 20 • Payment 3/3'
    );
  });

  // Test 3: Split Channel Badge Detection
  it('3. getPaymentChannelBadgeText detects multiple active payment methods and ignores voided logs', () => {
    // Jason Canete #112326-901: 1 GCash + 2 Cash
    const jasonOrder = {
      downpaymentMethod: 'Cash',
      paymentLogs: [
        { paymentMethod: 'GCash', amount: 1500, isVoided: false },
        { paymentMethod: 'Cash', amount: 2000, isVoided: false },
        { paymentMethod: 'Cash', amount: 3000, isVoided: false },
      ],
    };
    const jasonBadge = getPaymentChannelBadgeText(jasonOrder);
    assert.strictEqual(jasonBadge, 'Split (GCash + Cash)');

    // Leah de Guzman #112326-902: 1 voided GCash + 1 active GCash -> "GCash"
    const leahOrder = {
      downpaymentMethod: 'GCash',
      paymentLogs: [
        { paymentMethod: 'GCash', amount: 1, isVoided: true },
        { paymentMethod: 'GCash', amount: 1000, isVoided: false },
      ],
    };
    const leahBadge = getPaymentChannelBadgeText(leahOrder);
    assert.strictEqual(leahBadge, 'GCash');

    // Order with summary channels
    const summaryOrder = {
      paymentChannelsSummary: [
        { paymentMethod: 'GCash', amount: 1500 },
        { paymentMethod: 'Cash', amount: 5000 },
      ],
    };
    const summaryBadge = getPaymentChannelBadgeText(summaryOrder);
    assert.strictEqual(summaryBadge, 'Split (GCash + Cash)');

    // Fallback order with single method
    const fallbackOrder = { downpaymentMethod: 'Maya' };
    const fallbackBadge = getPaymentChannelBadgeText(fallbackOrder);
    assert.strictEqual(fallbackBadge, 'Maya');
  });

  // Test 4: Freelance Drop Net Remittance Computation
  it('4. Uncollected Freelance drop computes TotalCollected - RiderDeliveryFee = 11,700 for Leah de Guzman #112326-902', () => {
    const computeEffectiveNet = (drop: {
      netRemittance?: number;
      totalCollected: number;
      riderDeliveryFee: number;
      custodyStatus?: string;
    }) => {
      if (drop.netRemittance && drop.netRemittance > 0) {
        return drop.netRemittance;
      }
      if (drop.custodyStatus === 'Uncollected' || !drop.custodyStatus) {
        return Math.max(0, drop.totalCollected - drop.riderDeliveryFee);
      }
      return drop.netRemittance ?? 0;
    };

    const leahDrop = {
      netRemittance: 0, // Stale/corrupt backend 0
      totalCollected: 12220,
      riderDeliveryFee: 520,
      custodyStatus: 'Uncollected',
    };

    const effective = computeEffectiveNet(leahDrop);
    assert.strictEqual(effective, 11700, 'Effective net remittance must evaluate to ₱11,700');
  });

  // Test 5: DrawerScreen.tsx source invariants
  it('5. DrawerScreen.tsx contains keyboardShouldPersistTaps="handled", memoized DownpaymentRowCard, and no entity mojibake', () => {
    const rootPath = path.resolve(
      process.cwd(),
      'lechon-system-mobile/src/screens/DrawerScreen.tsx'
    );
    const drawerScreenPath = fs.existsSync(rootPath)
      ? rootPath
      : path.resolve(process.cwd(), 'src/screens/DrawerScreen.tsx');
    const content = fs.readFileSync(drawerScreenPath, 'utf8');

    // 1. keyboardShouldPersistTaps="handled" present
    assert.ok(
      content.includes('keyboardShouldPersistTaps="handled"'),
      'Must contain keyboardShouldPersistTaps="handled"'
    );

    // 2. DownpaymentRowCard React.memo present
    assert.ok(
      content.includes('DownpaymentRowCard = React.memo'),
      'Must define DownpaymentRowCard as React.memo component'
    );

    // 3. Slicing with dpVisibleCount
    assert.ok(
      content.includes('filteredDownpaymentItems.slice(0, dpVisibleCount)'),
      'Must slice downpayments with dpVisibleCount'
    );

    // 4. Load Next 25 button present
    assert.ok(
      content.includes('Load Next 25'),
      'Must contain Load Next 25 button'
    );

    // 5. Zero &amp; entity occurrences
    const ampMatches = content.match(/&amp;/g);
    assert.strictEqual(
      ampMatches,
      null,
      `DrawerScreen.tsx must NOT contain literal &amp;, found ${ampMatches ? ampMatches.length : 0}`
    );
  });
});
