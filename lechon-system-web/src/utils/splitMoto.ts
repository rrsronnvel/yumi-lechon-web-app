export interface SplitMotoAssignment {
  supportRiderName?: string | null;
  supportRiderFee?: number | null;
  supportRiderHeads?: number | null;
  supportRiderExpenseLogged?: boolean;
}

export interface RiderAssignmentOrder extends SplitMotoAssignment {
  id: number;
  orderReference?: string;
  assignedRiderName?: string | null;
  deliveryFee?: number | null;
  orderItems?: {
    quantity: number;
    fulfilledCategoryName?: string | null;
    fulfilledMinimumWeightKg?: number | null;
    itemCategory?: { name?: string; minimumWeightKg?: number } | null;
  }[];
}

export const peso = (amount: number | null | undefined) =>
  `₱${Number(amount ?? 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

export const namedRider = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.toLowerCase() === "unassigned" ? "" : trimmed;
};

export const sameRider = (first?: string | null, second?: string | null) =>
  namedRider(first).toLowerCase() === namedRider(second).toLowerCase();

export const countWholeHeads = (items: RiderAssignmentOrder["orderItems"]) =>
  (items ?? []).reduce((total, { quantity, itemCategory, fulfilledMinimumWeightKg, fulfilledCategoryName }) =>
    (fulfilledMinimumWeightKg ?? itemCategory?.minimumWeightKg ?? 0) > 0 && !/belly/i.test(fulfilledCategoryName ?? itemCategory?.name ?? "")
      ? total + quantity : total, 0);

export const defaultBackupHeads = (wholeHeads: number) => Math.max(1, wholeHeads - 2);

export function getHeadRider(row: SplitMotoAssignment & { assignedRiderName?: string | null; riderName?: string }) {
  const lead = namedRider(row.riderName);
  const explicit = namedRider(row.assignedRiderName);
  const name = explicit || lead;
  const role = name && sameRider(name, row.supportRiderName) ? "Backup"
    : name && sameRider(name, lead) ? "Lead"
    : undefined;
  return { name, role };
}

export function backupRiderLabel(assignment: SplitMotoAssignment, style: "compact" | "settlement" = "compact") {
  const name = namedRider(assignment.supportRiderName);
  if (!name) return null;
  const fee = peso(assignment.supportRiderFee);
  return style === "settlement" ? `🛵 + Backup: ${name} (Store Fee ${fee})` : `+ ${name} • Backup • Store Fee ${fee}`;
}

export const canLogSupportRiderExpense = (assignment: SplitMotoAssignment) =>
  Boolean(namedRider(assignment.supportRiderName) && Number(assignment.supportRiderFee) > 0 && !assignment.supportRiderExpenseLogged);
