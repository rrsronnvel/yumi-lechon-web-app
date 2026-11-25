import { useState } from "react";
import { CircleCheck, FileText, Lock, MessageSquareText, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  payrollError, useFinalizePayrollMutation, usePayrollPeriodPreview, usePayrollPeriods, usePayrollSettings,
  useSyncPayrollExpenseMutation, useUpdatePayrollItemMutation,
  type PayrollCutoff, type PayrollItem,
} from "@/hooks/usePayroll";
import { cn } from "@/lib/utils";
import { PayrollPayslip } from "./PayrollPayslip";
import { displayAuditDate, displayPeriod, money, validMoney } from "./payrollDisplay";
import { PayrollEmpty, PayrollField, PayrollQueryError, PayrollSection, payrollSelect } from "./PayrollUi";

const adjustments = (item: PayrollItem) => ({
  otherBonus: String(item.otherBonus),
  otherBonusRemarks: item.otherBonusRemarks ?? "",
  valeDeducted: String(item.valeDeducted),
  isValeDeductionManuallyOverridden: Boolean(item.isValeDeductionManuallyOverridden),
  otherDeduction: String(item.otherDeduction),
  otherDeductionRemarks: item.otherDeductionRemarks ?? "",
});

type AdjustmentFields = ReturnType<typeof adjustments>;
type AdjustmentAmount = "otherBonus" | "valeDeducted" | "otherDeduction";

export function PayrollWeeklySheet({ range, onSelectPeriod }: { range: PayrollCutoff; onSelectPeriod: (range: PayrollCutoff) => void }) {
  const preview = usePayrollPeriodPreview(range);
  const savedPeriods = usePayrollPeriods();
  const settings = usePayrollSettings();
  const update = useUpdatePayrollItemMutation();
  const finalize = useFinalizePayrollMutation();
  const syncExpense = useSyncPayrollExpenseMutation();
  const [drafts, setDrafts] = useState<Record<number, AdjustmentFields>>({});
  const [remarksId, setRemarksId] = useState<number | null>(null);
  const [slipId, setSlipId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [syncChoice, setSyncChoice] = useState<boolean | null>(null);
  const period = preview.data?.period;
  const sheetTitle = range.cycleType === "Weekly" ? "Weekly payroll" : range.cycleType === "SemiMonthly" ? "Semi-monthly payroll" : "Custom payroll";
  const items = preview.data?.items ?? [];
  const locked = period?.status === "Finalized";
  const syncToExpenses = syncChoice ?? settings.data?.syncToExpensesOnFinalize ?? true;
  const autoDeduct = settings.data?.autoDeductValeOnPayroll ?? true;
  const hasHoliday = items.some((item) => item.holidayPremiumPay > 0);
  const hasLate = items.some((item) => item.lateDeduction > 0);
  const busy = update.isPending || finalize.isPending || syncExpense.isPending;
  const totals = items.reduce((total, item) => {
    total.base += item.basePay;
    total.extra += item.overtimePay + item.roastingIncentivePay;
    total.vale += item.valeDeducted;
    total.net += item.netPay;
    return total;
  }, { base: 0, extra: 0, vale: 0, net: 0 });
  const laborExpense = totals.net + totals.vale;
  const invalidVale = items.some((item) => item.valeDeducted > item.valeBalanceBefore);
  const hasEdits = !locked && items.some((item) => drafts[item.id] !== undefined);
  const remarksItem = items.find((item) => item.id === remarksId);
  const slipItem = items.find((item) => item.id === slipId);

  function change(item: PayrollItem, values: Partial<AdjustmentFields>) {
    setDrafts((previous) => {
      const stored = adjustments(item);
      const edit = { ...stored, ...previous[item.id], ...values };
      const next = { ...previous };
      if (Object.keys(stored).every((key) => stored[key as keyof AdjustmentFields] === edit[key as keyof AdjustmentFields])) delete next[item.id];
      else next[item.id] = edit;
      return next;
    });
  }

  function saveItem(item: PayrollItem) {
    const edit = drafts[item.id];
    if (!period || !edit || locked || !validAdjustment(edit, item, autoDeduct)) return;
    update.mutate({ periodId: period.id, itemId: item.id, input: {
      otherBonus: Number(edit.otherBonus), otherBonusRemarks: edit.otherBonusRemarks,
      valeDeducted: getDeduction(edit, item, autoDeduct), otherDeduction: Number(edit.otherDeduction), otherDeductionRemarks: edit.otherDeductionRemarks,
      isValeDeductionManuallyOverridden: edit.isValeDeductionManuallyOverridden,
    } }, {
      onSuccess: () => setDrafts((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      }),
    });
  }

  return (
    <div className="grid gap-4">
      {preview.isError && <PayrollQueryError error={preview.error} retry={preview.refetch} />}
      {preview.isPending && <PayrollSection title={sheetTitle}><PayrollEmpty>Preparing the payroll…</PayrollEmpty></PayrollSection>}

      {period && <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <PayrollMetric label="Total Base Pay" value={totals.base} />
          <PayrollMetric label="Total OT & Incentives" value={totals.extra} />
          <PayrollMetric label="Total Vale Deducted" value={totals.vale} />
          <PayrollMetric label="Total Net Payroll Payout" value={totals.net} primary />
        </div>

        <PayrollSection title={sheetTitle} description={locked && period.finalizedAt
          ? `Finalized by ${period.finalizedBy} on ${displayAuditDate(period.finalizedAt)}.`
          : "Save row adjustments before finalizing the cutoff."} actions={
          <>
            <Badge className={locked ? "bg-emerald-50 text-emerald-900" : "bg-amber-100 text-amber-950"}>
              {locked && <CircleCheck />} {period.status}
            </Badge>
            {!!savedPeriods.data?.length && (
              <select aria-label="Saved payroll periods" className={cn(payrollSelect, "w-auto max-w-full")} value={period.id} disabled={busy}
                onChange={(event) => {
                  const selected = savedPeriods.data?.find((row) => row.id === Number(event.target.value));
                  if (selected) onSelectPeriod({ startDate: selected.startDate, endDate: selected.endDate, cycleType: selected.cycleType });
                }}>
                {!savedPeriods.data.some((row) => row.id === period.id) && <option value={period.id}>{displayPeriod(period)}</option>}
                {savedPeriods.data.map((row) => <option key={row.id} value={row.id}>{displayPeriod(row)} · {row.status}</option>)}
              </select>
            )}
            {!locked && (
              <Button type="button" onClick={() => { setSyncChoice(null); setConfirm(true); }} disabled={busy || hasEdits || invalidVale || preview.isFetching || !items.length}>
                <Lock /> {range.cycleType === "Weekly" ? "Finalize & Lock Week" : "Finalize & Lock Cutoff"}
              </Button>
            )}
            {locked && (period.syncedExpenseId != null ? (
              <Badge render={<Link to={`/expenses?month=${period.payDate.slice(0, 7)}&expenseId=${period.syncedExpenseId}`} />}
                className="h-8 bg-emerald-100 text-emerald-950 hover:bg-emerald-200"><CircleCheck /> Synced to Expenses (Labor)</Badge>
            ) : (
              <Button type="button" variant="outline" disabled={busy} onClick={() => syncExpense.mutate(period.id)}>
                <ReceiptText /> {syncExpense.isPending ? "Posting Labor expense…" : "Post to /expenses (Labor)"}
              </Button>
            ))}
          </>
        }>
          {!locked && invalidVale && <p role="alert" className="bg-amber-50 px-5 py-3 text-sm text-amber-950">A saved Vale deduction exceeds the current balance. Update the deduction before finalizing.</p>}
          {locked && syncExpense.isError && <p role="alert" className="bg-red-50 px-5 py-3 text-sm text-red-900">{payrollError(syncExpense.error)}</p>}
          {items.length === 0 && <PayrollEmpty>Add employees in Employees &amp; Settings to build this payroll.</PayrollEmpty>}
          {!!items.length && (
            <Table className="min-w-[1060px] [&_td:first-child]:pl-5 [&_th:first-child]:pl-5">
              <TableHeader className="bg-stone-50">
                <TableRow>{["Employee", "Days", "Base Pay", "OT", ...(hasHoliday ? ["Holiday Pay"] : []), "Incentives", "+ Bonus", ...(hasLate ? ["− Late Ded."] : []), "− Vale Deducted", "− Other Deduction", "Net Pay", "Actions"].map((heading) => <TableHead key={heading} scope="col">{heading}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <PayRow key={item.id} item={item} edit={locked ? undefined : drafts[item.id]} locked={locked} busy={busy} hasHoliday={hasHoliday} hasLate={hasLate} autoDeduct={autoDeduct}
                    onChange={(values) => change(item, values)} onSave={() => saveItem(item)}
                    onRemarks={() => setRemarksId(item.id)} onSlip={() => setSlipId(item.id)} />
                ))}
              </TableBody>
            </Table>
          )}
        </PayrollSection>

        <AlertDialog open={confirm && !locked} onOpenChange={(open) => { if (!finalize.isPending) setConfirm(open); }}>
          <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-amber-100 text-amber-950"><Lock /></AlertDialogMedia>
              <AlertDialogTitle>Finalize this payroll?</AlertDialogTitle>
              <AlertDialogDescription>
                Finalizing {displayPeriod(period)} locks the payroll amounts and adds each Vale deduction to the employee’s ledger. Any unpaid Vale carries forward.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm tabular-nums">
              <p className="font-bold text-stone-900">Total Labor Expense to sync to /expenses <span className="block text-lg text-emerald-900">{money(laborExpense)}</span></p>
              <p className="text-xs text-stone-600">Cash Payout {money(totals.net)} + Vale Settled {money(totals.vale)}</p>
            </div>
            <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={syncToExpenses} className="mt-0.5 accent-emerald-800" disabled={finalize.isPending}
              onChange={(event) => setSyncChoice(event.target.checked)} /> Post Total Labor Expense to /expenses Ledger</label>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={finalize.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction type="button" disabled={finalize.isPending || hasEdits || invalidVale} onClick={() => finalize.mutate({ periodId: period.id, syncToExpenses }, { onSuccess: () => setConfirm(false) })}>
                {finalize.isPending ? "Finalizing…" : "Finalize & lock"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {remarksItem && <PayrollRemarksEditor item={remarksItem} values={drafts[remarksItem.id] ?? adjustments(remarksItem)}
          onApply={(values) => { change(remarksItem, values); setRemarksId(null); }} onClose={() => setRemarksId(null)} />}
        {slipItem && <PayrollPayslip period={period} item={slipItem} onClose={() => setSlipId(null)} />}
      </>}
    </div>
  );
}

function PayrollMetric({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-3 sm:px-4", primary && "border-emerald-900 bg-emerald-900 text-white")}>
      <p className={cn("text-xs font-medium text-stone-600", primary && "text-emerald-100")}>{label}</p>
      <p className="mt-1 break-words text-lg font-bold tracking-tight tabular-nums sm:text-2xl">{money(value)}</p>
    </div>
  );
}

function grossPay(item: PayrollItem, otherBonus: string) {
  return item.basePay + item.overtimePay + (item.holidayPremiumPay ?? 0) + item.roastingIncentivePay + Number(otherBonus);
}

function getDeduction(fields: AdjustmentFields, item: PayrollItem, autoDeduct: boolean) {
  if (fields.isValeDeductionManuallyOverridden) return Number(fields.valeDeducted);
  if (!autoDeduct) return 0;
  const capacity = grossPay(item, fields.otherBonus) - (item.lateDeduction ?? 0) - Number(fields.otherDeduction);
  return Math.max(0, Math.min(item.valeBalanceBefore, Math.round(capacity * 100) / 100));
}

function validAdjustment(fields: AdjustmentFields, item: PayrollItem, autoDeduct: boolean) {
  return validMoney(fields.otherBonus) && validMoney(fields.otherDeduction) &&
    (!fields.isValeDeductionManuallyOverridden || validMoney(fields.valeDeducted)) && getDeduction(fields, item, autoDeduct) <= item.valeBalanceBefore;
}

function PayRow({ item, edit, locked, busy, hasHoliday, hasLate, autoDeduct, onChange, onSave, onRemarks, onSlip }: {
  item: PayrollItem;
  edit?: AdjustmentFields;
  locked: boolean;
  busy: boolean;
  hasHoliday: boolean;
  hasLate: boolean;
  autoDeduct: boolean;
  onChange: (values: Partial<AdjustmentFields>) => void;
  onSave: () => void;
  onRemarks: () => void;
  onSlip: () => void;
}) {
  const fields = edit ?? adjustments(item);
  const valid = validAdjustment(fields, item, autoDeduct);
  const deduction = edit ? getDeduction(fields, item, autoDeduct) : item.valeDeducted;
  const exceedsVale = deduction > item.valeBalanceBefore;
  const remaining = locked ? item.valeBalanceAfter : Math.max(0, item.valeBalanceBefore - deduction);
  const net = edit && valid
    ? grossPay(item, fields.otherBonus) - (item.lateDeduction ?? 0) - deduction - Number(fields.otherDeduction)
    : item.netPay;

  function amount(key: AdjustmentAmount, label: string, max?: number) {
    if (locked) return <span className="tabular-nums">{money(item[key])}</span>;
    const isVale = key === "valeDeducted";
    const value = isVale && !fields.isValeDeductionManuallyOverridden ? String(deduction) : fields[key];
    return <Input type="number" min="0" max={max} step="0.01" className="w-24 tabular-nums" aria-label={`${label} for ${item.employeeName}`}
      aria-invalid={!validMoney(value) || (max !== undefined && Number(value) > max)}
      disabled={busy} value={value} onChange={(event) => onChange(isVale
        ? { valeDeducted: event.target.value, isValeDeductionManuallyOverridden: true } : { [key]: event.target.value })} />;
  }

  return (
    <TableRow className={edit ? "bg-amber-50/50" : undefined}>
      <TableCell className="font-semibold">{item.employeeName}</TableCell>
      <TableCell className="tabular-nums">{item.daysWorked.toFixed(1)}</TableCell>
      <TableCell className="tabular-nums">{money(item.basePay)}</TableCell>
      <TableCell className="tabular-nums">{money(item.overtimePay)}</TableCell>
      {hasHoliday && <TableCell className="tabular-nums">{item.holidayPremiumPay > 0 ? money(item.holidayPremiumPay) : "—"}</TableCell>}
      <TableCell className="tabular-nums">{money(item.roastingIncentivePay)}
        {(item.partihanIncentivePay > 0 || item.milestoneIncentivePay > 0) && <span className="block text-xs text-stone-600">Partihan {money(item.partihanIncentivePay)} · Milestone {money(item.milestoneIncentivePay)}</span>}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {amount("otherBonus", "Bonus")}
          {!locked && <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={`Edit adjustment remarks for ${item.employeeName}`} title={fields.otherBonusRemarks || fields.otherDeductionRemarks || "Edit bonus and deduction remarks"} onClick={onRemarks}><MessageSquareText /></Button>}
        </div>
        {locked && item.otherBonusRemarks && <p className="max-w-36 truncate text-xs text-stone-500" title={item.otherBonusRemarks}>{item.otherBonusRemarks}</p>}
      </TableCell>
      {hasLate && <TableCell className="tabular-nums text-rose-800">{item.lateDeduction > 0 ? `−${money(item.lateDeduction)}` : "—"}</TableCell>}
      <TableCell>
        {amount("valeDeducted", "Vale deduction", item.valeBalanceBefore)}
        <p className="mt-1 text-xs text-stone-600">{locked ? "Before" : "Max"} {money(item.valeBalanceBefore)}</p>
        <p className={cn("text-xs text-stone-600", exceedsVale && "text-red-800")}>{exceedsVale ? "Exceeds unpaid balance" : `Left ${money(remaining)}`}</p>
        {!locked && autoDeduct && (fields.isValeDeductionManuallyOverridden
          ? <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => onChange({ isValeDeductionManuallyOverridden: false })}>Use auto</Button>
          : <span className="text-xs text-stone-500">Auto deduction</span>)}
      </TableCell>
      <TableCell>
        {amount("otherDeduction", "Other deduction")}
        {locked && item.otherDeductionRemarks && <p className="max-w-36 truncate text-xs text-stone-500" title={item.otherDeductionRemarks}>{item.otherDeductionRemarks}</p>}
      </TableCell>
      <TableCell className="font-bold tabular-nums text-emerald-900">{money(net)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {edit && <Button type="button" size="sm" disabled={!valid || busy} onClick={onSave}>Save</Button>}
          <Button type="button" size="sm" variant="outline" disabled={Boolean(edit) || busy} onClick={onSlip}><ReceiptText /> Payslip</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PayrollRemarksEditor({ item, values, onApply, onClose }: {
  item: PayrollItem;
  values: AdjustmentFields;
  onApply: (values: Partial<AdjustmentFields>) => void;
  onClose: () => void;
}) {
  const [bonus, setBonus] = useState(values.otherBonusRemarks);
  const [deduction, setDeduction] = useState(values.otherDeductionRemarks);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="size-4" /> Adjustment remarks</DialogTitle>
          <DialogDescription>{item.employeeName}</DialogDescription>
        </DialogHeader>
        <PayrollField label="Bonus remarks"><Textarea value={bonus} maxLength={1000} onChange={(event) => setBonus(event.target.value)} /></PayrollField>
        <PayrollField label="Other deduction remarks"><Textarea value={deduction} maxLength={1000} onChange={(event) => setDeduction(event.target.value)} /></PayrollField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onApply({ otherBonusRemarks: bonus, otherDeductionRemarks: deduction })}>Apply remarks</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
