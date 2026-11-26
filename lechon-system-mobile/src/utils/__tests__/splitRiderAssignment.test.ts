import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRiderAssignment, defaultBackupHeads, describeSupportRider, supportRiderExpenseLabel, wholeLechonHeadCount } from '../riderAssignment.ts';

describe('Mobile split motorcycle riders', () => {
  const fixture = {
    leadName: ' Adrianne ', splitEnabled: true, backupName: 'Randy', backupHeads: '1', backupFee: '500', wholeLechonQty: 3,
  };

  it('counts only whole roast heads and proposes backup heads beyond the lead’s first two', () => {
    const count = wholeLechonHeadCount([
      { quantity: 3, itemCategory: { name: 'M', minimumWeightKg: 23 } },
      { quantity: 4, itemCategory: { name: 'Belly 3kg', minimumWeightKg: 3 } },
      { quantity: 2, itemCategory: { name: 'Sarsa', minimumWeightKg: 0 } },
    ]);
    assert.equal(count, 3);
    assert.equal(defaultBackupHeads(count), 1);
    assert.equal(defaultBackupHeads(5), 3);
    assert.equal(defaultBackupHeads(2), 1);
  });

  it('preserves a separate fee and head count and clears only the backup on unsplit', () => {
    assert.deepEqual(buildRiderAssignment(fixture), {
      payload: { riderName: 'Adrianne', supportRiderName: 'Randy', supportRiderHeads: 1, supportRiderFee: 500 },
    });
    assert.deepEqual(buildRiderAssignment({ ...fixture, splitEnabled: false }), {
      payload: { riderName: 'Adrianne', supportRiderName: null },
    });
  });

  it('validates distinct riders, whole head allocation, and an exact peso amount', () => {
    assert.ok('error' in buildRiderAssignment({ ...fixture, backupName: 'adrianne' }));
    assert.ok('error' in buildRiderAssignment({ ...fixture, wholeLechonQty: 2 }));
    assert.ok('error' in buildRiderAssignment({ ...fixture, backupHeads: '3' }));
    assert.ok('error' in buildRiderAssignment({ ...fixture, backupFee: '-1' }));
    assert.ok('error' in buildRiderAssignment({ ...fixture, backupFee: '100.001' }));
    assert.ok('payload' in buildRiderAssignment({ ...fixture, backupFee: '500.25' }));
    assert.ok('payload' in buildRiderAssignment({ ...fixture, backupFee: '0' }));
  });

  it('labels the separately payable backup and offers expense logging only while owed', () => {
    const plan = { supportRiderName: 'Randy', supportRiderFee: 500, supportRiderHeads: 1 };
    assert.equal(describeSupportRider(plan), '🛵 + Backup: Randy (Store Fee ₱500)');
    assert.equal(supportRiderExpenseLabel(plan), 'Auto-log ₱500 store-shouldered fee for Randy to Expenses Ledger');
    assert.equal(supportRiderExpenseLabel({ ...plan, supportRiderFee: 0 }), null);
    assert.equal(supportRiderExpenseLabel({ ...plan, supportRiderExpenseLogged: true }), null);
    assert.equal(describeSupportRider({}), null);
  });
});
