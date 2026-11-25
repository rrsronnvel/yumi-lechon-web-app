import { useId, useState } from "react";
import { CalendarPlus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  usePayrollHolidays, usePayrollSettings, useSavePayrollHolidayMutation, useSavePayrollSettingsMutation,
  type PayrollHoliday, type PayrollSettings,
} from "@/hooks/usePayroll";
import { displayDate, money, payrollToday, validMoney } from "./payrollDisplay";
import { PayrollEmpty, PayrollField, PayrollQueryError, PayrollSection, payrollSelect } from "./PayrollUi";

type PolicyKey<T> = { [K in keyof PayrollSettings]: PayrollSettings[K] extends T ? K : never }[keyof PayrollSettings];
type NumericPolicy = Exclude<PolicyKey<number>, "roastQuota" | "roastBonusPerExcess" | "latePenaltyAmount">;

const numericFields = {
  belliesPerWhole: { label: "Bellies per whole equivalent", min: 1, step: 1 },
  partihanRatePerLechon: { label: "Partihan rate per equivalent (₱)", min: 0, step: 0.01 },
  tiktikDeductionPerLechon: { label: "Tiktik cut per lechon (₱)", min: 0, step: 0.01 },
  milestoneUnitLechons: { label: "Lechons per milestone", min: 1, step: 1 },
  milestoneBonusAmount: { label: "Bonus per milestone (₱)", min: 0, step: 0.01 },
  standardWorkHoursPerDay: { label: "Standard work hours per day", min: 0.01, max: 24, step: 0.01 },
  overtimeMultiplier: { label: "OT multiplier", min: 1, step: 0.01 },
  regularShiftTotalHours: { label: "Regular shift, including break (h)", min: 0.01, max: 24, step: 0.01 },
  unpaidOtBufferHours: { label: "Unpaid buffer (h)", min: 0, max: 24, step: 0.01 },
  minHoursForPaidOt: { label: "Paid OT starts at (h)", min: 1, max: 48, step: 0.01 },
  specialHolidayMultiplier: { label: "Special holiday multiplier", min: 1, step: 0.01 },
  regularHolidayMultiplier: { label: "Regular holiday multiplier", min: 1, step: 0.01 },
  lateGraceMinutes: { label: "Grace period (minutes)", min: 0, max: 1439, step: 1 },
  lateTier1MaxMinutes: { label: "Tier 1 up to (minutes)", min: 0, max: 1439, step: 1 },
  lateTier1Penalty: { label: "Tier 1 penalty (₱)", min: 0, step: 0.01 },
  lateTier2MaxMinutes: { label: "Tier 2 up to (minutes)", min: 0, max: 1439, step: 1 },
  lateTier2Penalty: { label: "Tier 2 penalty (₱)", min: 0, step: 0.01 },
  lateTier3Penalty: { label: "Tier 3 penalty (₱)", min: 0, step: 0.01 },
} satisfies Record<NumericPolicy, { label: string; min: number; max?: number; step: number }>;

const minuteBracket = (after: number, through: number) => after < through ? `${after + 1}–${through}m` : "Empty bracket";

export function PayrollPolicySettings() {
  const query = usePayrollSettings();
  if (query.isError) return <PayrollQueryError error={query.error} retry={query.refetch} />;
  if (!query.data) return <PayrollEmpty>Loading payroll policies…</PayrollEmpty>;
  return <PolicyCards key={JSON.stringify(query.data)} settings={query.data} />;
}

function PolicyCards({ settings }: { settings: PayrollSettings }) {
  const [edits, setEdits] = useState<Partial<Record<NumericPolicy, string>>>({});
  const [flags, setFlags] = useState(settings);
  const save = useSavePayrollSettingsMutation();
  const keys = Object.keys(numericFields) as NumericPolicy[];
  const validNumbers = keys.every((key) => {
    const field = numericFields[key];
    const text = edits[key] ?? String(settings[key]);
    const value = Number(text);
    const max = "max" in field ? field.max : field.step === 1 ? 2_147_483_647 : Infinity;
    return validMoney(text) && value >= field.min && value <= max && (field.step !== 1 || Number.isInteger(value));
  });
  const draft = { ...flags };
  for (const key of keys) if (edits[key] !== undefined) draft[key] = Number(edits[key]);
  const validBrackets = draft.lateGraceMinutes <= draft.lateTier1MaxMinutes && draft.lateTier1MaxMinutes <= draft.lateTier2MaxMinutes;
  const validGate = draft.minHoursForPaidOt > draft.regularShiftTotalHours + draft.unpaidOtBufferHours &&
    draft.minHoursForPaidOt >= draft.regularShiftTotalHours + 1;
  const valid = validNumbers && validBrackets && validGate;
  const changed = JSON.stringify(draft) !== JSON.stringify(settings);
  const equivalent = valid ? 4 + Math.floor(6 / draft.belliesPerWhole) : 0;

  function numberField(key: NumericPolicy) {
    const field = numericFields[key];
    return <PayrollField label={field.label}><Input type="number" min={field.min} max={"max" in field ? field.max : undefined} step={field.step} value={edits[key] ?? settings[key]}
      onChange={(event) => setEdits({ ...edits, [key]: event.target.value })} /></PayrollField>;
  }

  function toggle(key: PolicyKey<boolean>, label: string) {
    return <PolicySwitch label={label} checked={flags[key]} onChange={(checked) => setFlags({ ...flags, [key]: checked })} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-stone-900">Payroll policies</h2>
        <Button type="button" disabled={save.isPending || !valid || !changed} onClick={() => save.mutate(draft)}>{save.isPending ? "Saving…" : "Save policies"}</Button>
      </div>
      {!validNumbers && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Enter valid numbers for all rates, multipliers, and limits.</p>}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <PayrollSection title="Roasting Incentives" description="Saved production keeps its policy until an Owner recalculates that date.">
          <div className="grid gap-3 p-4 sm:p-5">
            {numberField("belliesPerWhole")}
            {toggle("enablePartihan", "Enable team Partihan")}
            <div className="grid gap-3 sm:grid-cols-2">{numberField("partihanRatePerLechon")}{numberField("tiktikDeductionPerLechon")}</div>
            {toggle("enableMilestoneBonus", "Enable milestone bonus")}
            <div className="grid grid-cols-2 gap-3">{numberField("milestoneUnitLechons")}{numberField("milestoneBonusAmount")}</div>
            {valid && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">4 whole + 6 bellies = {equivalent} equivalents · {money(draft.enablePartihan ? equivalent * draft.partihanRatePerLechon : 0)} Partihan pool</p>}
          </div>
        </PayrollSection>
        <PayrollSection title="OT &amp; Holiday Pay" description="OT requires approval before payroll.">
          <div className="grid gap-3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">{numberField("standardWorkHoursPerDay")}{numberField("overtimeMultiplier")}</div>
            <div className="grid gap-3 sm:grid-cols-3">{numberField("regularShiftTotalHours")}{numberField("unpaidOtBufferHours")}{numberField("minHoursForPaidOt")}</div>
            {!validGate && <p role="alert" className="text-xs text-rose-800">Set paid OT to start after the regular shift and buffer, at least one hour past the regular shift.</p>}
            {toggle("enableHolidayPay", "Enable holiday pay")}
            <div className="grid grid-cols-2 gap-3">{numberField("specialHolidayMultiplier")}{numberField("regularHolidayMultiplier")}</div>
            <HolidayDates />
          </div>
        </PayrollSection>
        <PayrollSection title="Late Deductions">
          <div className="grid gap-3 p-4 sm:p-5">
            {toggle("enableLateDeduction", "Enable late penalty")}
            <div className="grid grid-cols-2 items-end gap-3 rounded-lg bg-stone-50 p-3">
              <div className="self-center text-sm font-semibold">0–{draft.lateGraceMinutes}m grace <span className="block text-xs font-normal text-stone-600">{money(0)} penalty</span></div>
              {numberField("lateGraceMinutes")}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 p-3">
              <p className="col-span-2 text-sm font-semibold">{minuteBracket(draft.lateGraceMinutes, draft.lateTier1MaxMinutes)}</p>
              {numberField("lateTier1MaxMinutes")}{numberField("lateTier1Penalty")}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 p-3">
              <p className="col-span-2 text-sm font-semibold">{minuteBracket(draft.lateTier1MaxMinutes, draft.lateTier2MaxMinutes)}</p>
              {numberField("lateTier2MaxMinutes")}{numberField("lateTier2Penalty")}
            </div>
            <div className="grid grid-cols-2 items-end gap-3 rounded-lg border border-stone-200 p-3">
              <p className="self-center text-sm font-semibold">{draft.lateTier2MaxMinutes + 1}m+</p>{numberField("lateTier3Penalty")}
            </div>
            {!validBrackets && <p role="alert" className="text-xs text-rose-800">Put the grace period and tier limits in ascending order.</p>}
          </div>
        </PayrollSection>
        <PayrollSection title="Vale &amp; Expenses Sync">
          <div className="grid gap-3 p-4 sm:p-5">
            {toggle("enableValeSystem", "Enable Vale system")}
            <PayrollField label="Allowed disbursement day"><select className={payrollSelect} value={flags.valeAllowedDayOfWeek}
              onChange={(event) => setFlags({ ...flags, valeAllowedDayOfWeek: event.target.value === "Any" ? "Any" : "Wednesday" })}>
              <option value="Wednesday">Wednesday</option><option value="Any">Any day</option>
            </select></PayrollField>
            {toggle("enforceValeEarnedCap", "Enforce earned-wage cap")}
            {toggle("autoDeductValeOnPayroll", "Auto-deduct unpaid Vale on payday")}
            {toggle("syncToExpensesOnFinalize", "Post finalized payroll to Expenses (Labor)")}
          </div>
        </PayrollSection>
      </div>
    </div>
  );
}

function PolicySwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  const labelId = useId();
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm font-medium">
    <span id={labelId}>{label}</span><Switch aria-labelledby={labelId} checked={checked} onCheckedChange={onChange} />
  </div>;
}

function HolidayDates() {
  const holidays = usePayrollHolidays();
  const save = useSavePayrollHolidayMutation();
  const [editing, setEditing] = useState<PayrollHoliday | null>(null);
  const [isNew, setIsNew] = useState(false);

  return (
    <div className="mt-2 grid gap-2 border-t border-stone-200 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Holiday dates</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          setIsNew(true);
          setEditing({ holidayDate: payrollToday(), holidayType: "SpecialHoliday", name: "", isActive: true });
        }}><CalendarPlus /> Add holiday</Button>
      </div>
      {holidays.isError && <PayrollQueryError error={holidays.error} retry={holidays.refetch} />}
      {holidays.isPending && <p className="text-xs text-stone-500">Loading holiday dates…</p>}
      {holidays.data?.length === 0 && <p className="text-xs text-stone-500">No holiday dates configured.</p>}
      {!!holidays.data?.length && <ul className="divide-y divide-stone-100">
        {holidays.data.map((holiday) => (
          <li key={holiday.holidayDate} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{holiday.name} <Badge variant="outline">{holiday.holidayType === "RegularHoliday" ? "Regular" : "Special"}</Badge></p>
              <p className="text-xs text-stone-500">{displayDate(holiday.holidayDate)} {holiday.holidayDate.slice(0, 4)}{holiday.isActive ? "" : " · Inactive"}</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${holiday.name} ${holiday.holidayDate}`} onClick={() => { setIsNew(false); setEditing(holiday); }}><Pencil /></Button>
          </li>
        ))}
      </ul>}
      {editing && <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isNew ? "Add holiday" : "Edit holiday"}</DialogTitle><DialogDescription>Choose the date and premium category used for attendance.</DialogDescription></DialogHeader>
          <form className="grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            if (editing.holidayDate && editing.name.trim()) save.mutate({ ...editing, name: editing.name.trim() }, { onSuccess: () => setEditing(null) });
          }}>
            <PayrollField label="Holiday date"><Input type="date" required readOnly={!isNew} value={editing.holidayDate} onChange={(event) => setEditing({ ...editing, holidayDate: event.target.value })} /></PayrollField>
            <PayrollField label="Holiday name"><Input required maxLength={120} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></PayrollField>
            <PayrollField label="Holiday type"><select className={payrollSelect} value={editing.holidayType}
              onChange={(event) => setEditing({ ...editing, holidayType: event.target.value as PayrollHoliday["holidayType"] })}>
              <option value="SpecialHoliday">Special holiday</option><option value="RegularHoliday">Regular holiday</option>
            </select></PayrollField>
            <PolicySwitch label="Active" checked={editing.isActive} onChange={(isActive) => setEditing({ ...editing, isActive })} />
            {isNew && holidays.data?.some((holiday) => holiday.holidayDate === editing.holidayDate) && <p className="text-xs text-amber-900">Saving this date updates its existing holiday entry.</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending || !editing.holidayDate || !editing.name.trim()}>{save.isPending ? "Saving…" : "Save holiday"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
