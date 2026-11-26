export interface SupportRiderPlan {
  supportRiderName?: string | null;
  supportRiderFee?: number | null;
  supportRiderHeads?: number | null;
  supportRiderExpenseLogged?: boolean;
}

interface RiderAssignmentInput {
  leadName: string;
  splitEnabled: boolean;
  backupName: string;
  backupHeads: string;
  backupFee: string;
  wholeLechonQty: number;
}

interface RiderRoastCategory {
  name: string;
  minimumWeightKg: number;
}

export const wholeLechonHeadCount = (items: readonly {
  quantity: number;
  itemCategory?: RiderRoastCategory | null;
  fulfilledItemCategory?: RiderRoastCategory | null;
}[] = []) => items.reduce((count, item) => {
  const category = item.fulfilledItemCategory ?? item.itemCategory;
  return category && category.minimumWeightKg > 0 && !/belly/i.test(category.name)
    ? count + item.quantity : count;
}, 0);

export const defaultBackupHeads = (wholeLechonQty: number) => Math.max(1, wholeLechonQty - 2);

export function buildRiderAssignment(input: RiderAssignmentInput) {
  const riderName = input.leadName.trim();
  if (!riderName) return { error: 'Select a lead rider or enter a rider name.' } as const;
  if (!input.splitEnabled) return { payload: { riderName, supportRiderName: null } } as const;
  if (input.wholeLechonQty <= 2) return { error: 'Split-moto delivery requires more than two whole lechon heads.' } as const;

  const supportRiderName = input.backupName.trim();
  if (!supportRiderName) return { error: 'Select a backup moto rider.' } as const;
  if (riderName.toLowerCase() === supportRiderName.toLowerCase()) {
    return { error: 'Choose different riders for lead and backup.' } as const;
  }

  const supportRiderHeads = Number(input.backupHeads);
  const supportRiderFee = Number(input.backupFee);
  if (!Number.isInteger(supportRiderHeads) || supportRiderHeads < 1 || supportRiderHeads >= input.wholeLechonQty) {
    return { error: `Enter 1–${input.wholeLechonQty - 1} whole lechon heads for the backup rider.` } as const;
  }
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(input.backupFee.trim()) || !Number.isFinite(supportRiderFee)) {
    return { error: 'Enter a valid store fee of ₱0 or more.' } as const;
  }

  return { payload: { riderName, supportRiderName, supportRiderHeads, supportRiderFee } } as const;
}

export const describeSupportRider = (plan: SupportRiderPlan): string | null => plan.supportRiderName
  ? `🛵 + Backup: ${plan.supportRiderName} (Store Fee ₱${Number(plan.supportRiderFee ?? 0).toLocaleString('en-PH')})`
  : null;

export const supportRiderExpenseLabel = (plan: SupportRiderPlan): string | null =>
  plan.supportRiderName && Number(plan.supportRiderFee ?? 0) > 0 && !plan.supportRiderExpenseLogged
    ? `Auto-log ₱${Number(plan.supportRiderFee).toLocaleString('en-PH')} store-shouldered fee for ${plan.supportRiderName} to Expenses Ledger`
    : null;
