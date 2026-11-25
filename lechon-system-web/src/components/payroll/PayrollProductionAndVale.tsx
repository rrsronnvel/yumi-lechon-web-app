import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Undo2, WalletCards, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  usePrefillRoastMutation, useRecordValeMutation, useRoastProduction, useSaveRoastAllocationsMutation, useSaveRoastProductionMutation, useValeSummary,
  useVoidValeMutation, type PayrollRange, type RoastAllocation, type RoastProduction, type ValeEmployee, type ValeEntry, type ValeInput,
} from "@/hooks/usePayroll";
import { displayDate, money, payrollToday, validMoney, validRoastCount } from "./payrollDisplay";
import { PayrollRoastTeams } from "./PayrollRoastTeams";
import { PayrollEmpty, PayrollField, PayrollQueryError, PayrollSection, payrollSelect } from "./PayrollUi";

type CountFields = { whole: string; bellies: string };

export function PayrollProductionAndVale({ range }: { range: PayrollRange }) {
  return <div className="grid gap-4"><WeeklyProduction range={range} /><ValeLedger /></div>;
}

function WeeklyProduction({ range }: { range: PayrollRange }) {
  const production = useRoastProduction(range);
  const prefill = usePrefillRoastMutation();
  const save = useSaveRoastProductionMutation();
  const [edits, setEdits] = useState<Record<string, CountFields>>({});
  const rows = production.data ?? [];
  const busy = prefill.isPending || save.isPending;
  const changedRows = rows.filter((row) => edits[row.productionDate] !== undefined);
  const valid = changedRows.every((row) => {
    const { whole, bellies } = edits[row.productionDate];
    return validRoastCount(whole) && validRoastCount(bellies) &&
      Number(whole) + Math.floor(Number(bellies) / row.belliesPerWholeSnapshot) <= 2_147_483_647;
  });

  function prefillCounts() {
    prefill.mutate(range, {
      onSuccess: (suggestions) => {
        const saved = new Map(rows.map((row) => [row.productionDate, row]));
        const next: Record<string, CountFields> = {};
        for (const suggestion of suggestions) {
          const row = saved.get(suggestion.productionDate);
          if (row && (suggestion.wholeLechonCount !== row.wholeLechonCount || suggestion.bellyCount !== row.bellyCount)) {
            next[suggestion.productionDate] = { whole: String(suggestion.wholeLechonCount), bellies: String(suggestion.bellyCount) };
          }
        }
        setEdits(next);
      },
    });
  }

  function saveCounts() {
    if (!valid) return;
    save.mutate(changedRows.map(({ productionDate }) => ({
      productionDate, wholeLechonCount: Number(edits[productionDate].whole), bellyCount: Number(edits[productionDate].bellies),
    })), { onSuccess: () => setEdits({}) });
  }

  return (
    <PayrollSection title="Roasting production" description="Teams split their net Partihan pools. The store daily total sets the milestone bonus." actions={
      <>
        <Button type="button" variant="outline" onClick={prefillCounts} disabled={busy || !rows.length}><Zap /> {prefill.isPending ? "Loading orders…" : "Pre-fill from Orders"}</Button>
        <Button type="button" onClick={saveCounts} disabled={busy || !changedRows.length || !valid}>{save.isPending ? "Saving…" : "Save production"}</Button>
      </>
    }>
      {production.isError && <PayrollQueryError error={production.error} retry={production.refetch} />}
      {production.isPending && <PayrollEmpty>Loading roasting production…</PayrollEmpty>}
      {!valid && <p role="alert" className="px-5 py-2 text-sm text-red-800">Enter non-negative whole counts for each date.</p>}
      {!!rows.length && (
        <Table className="min-w-[840px] [&_td:first-child]:pl-5 [&_th:first-child]:pl-5">
          <TableHeader className="bg-stone-50">
            <TableRow>{["Production date", "Whole", "Belly", "Equivalent", "Partihan Pool", "Milestone per Roaster", "Daily Roaster Breakdown"].map((heading) => <TableHead key={heading} scope="col">{heading}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => <ProductionRow key={row.productionDate} row={row} edit={edits[row.productionDate]} busy={busy}
              onChange={(fields) => setEdits((current) => ({ ...current, [row.productionDate]: fields }))} />)}
          </TableBody>
        </Table>
      )}
    </PayrollSection>
  );
}

function ProductionRow({ row, edit, busy, onChange }: { row: RoastProduction; edit?: CountFields; busy: boolean; onChange: (fields: CountFields) => void }) {
  const [expanded, setExpanded] = useState<"teams" | "allocations" | null>(null);
  const fields = edit ?? { whole: String(row.wholeLechonCount), bellies: String(row.bellyCount) };
  const equivalent = Number(fields.whole) + Math.floor(Number(fields.bellies) / row.belliesPerWholeSnapshot);
  const legacy = row.isSaved && !row.usesDualIncentives;
  const hasTeams = row.teams.length > 0;
  let pool = 0;
  if (legacy) pool = Math.max(0, equivalent - row.quotaSnapshot) * row.bonusPerExcessSnapshot;
  else if (row.partihanEnabledSnapshot) pool = hasTeams
    ? row.teams.reduce((sum, team) => sum + team.netPartihanPool, 0) : equivalent * row.partihanRatePerLechonSnapshot;
  const milestone = row.milestoneBonusEnabledSnapshot && row.milestoneStepSnapshot > 0
    ? Math.floor(equivalent / row.milestoneStepSnapshot) * row.milestoneBonusAmountSnapshot : 0;
  const valid = validRoastCount(fields.whole) && validRoastCount(fields.bellies);
  const date = displayDate(row.productionDate);
  const title = legacy ? `Legacy quota ${row.quotaSnapshot} · ${money(row.bonusPerExcessSnapshot)} per excess lechon`
    : hasTeams ? "Total net roaster pools after Tiktik cuts" : `${money(row.partihanRatePerLechonSnapshot)} per equivalent lechon`;

  return (
    <>
      <TableRow className={edit ? "bg-amber-50/50" : undefined}>
        <TableCell className="font-semibold">{date}
          <span className="mt-0.5 block text-xs font-normal text-stone-500">{row.belliesPerWholeSnapshot} bellies = 1 whole {legacy ? "· Legacy" : ""}</span>
        </TableCell>
        <TableCell><Input type="number" min="0" max="2147483647" aria-label={`Whole lechons for ${date}`} value={fields.whole} onChange={(event) => onChange({ ...fields, whole: event.target.value })} disabled={busy} className="w-20 tabular-nums" /></TableCell>
        <TableCell><Input type="number" min="0" max="2147483647" aria-label={`Lechon bellies for ${date}`} value={fields.bellies} onChange={(event) => onChange({ ...fields, bellies: event.target.value })} disabled={busy} className="w-20 tabular-nums" /></TableCell>
        <TableCell className="font-semibold tabular-nums">{valid ? equivalent : "—"}</TableCell>
        <TableCell className="tabular-nums" title={title}>
          <span className="font-semibold text-emerald-900">{valid ? money(pool) : "—"}</span>
          <span className="block text-xs text-stone-500">{legacy ? "Legacy bonus pool" : hasTeams ? "Net team pools" : `Eq × ${money(row.partihanRatePerLechonSnapshot)}`}</span>
        </TableCell>
        <TableCell className="tabular-nums">
          <span className="font-semibold text-emerald-900">{valid && !legacy ? money(milestone) : "—"}</span>
          {!legacy && <span className="block text-xs text-stone-500">per {row.milestoneStepSnapshot} lechons</span>}
        </TableCell>
        <TableCell>
          <Button type="button" variant="outline" size="sm" aria-expanded={expanded === "teams"} aria-label={`Manage Teams / Partihan for ${date}`}
            onClick={() => setExpanded(expanded === "teams" ? null : "teams")}>
            {expanded === "teams" ? <ChevronUp /> : <ChevronDown />} Manage Teams / Partihan
          </Button>
          {hasTeams ? <p className="mt-1 text-xs text-stone-600">{row.teams.length} {row.teams.length === 1 ? "team" : "teams"}</p> :
            <Button type="button" variant="ghost" size="xs" className="mt-1 block" aria-expanded={expanded === "allocations"}
              onClick={() => setExpanded(expanded === "allocations" ? null : "allocations")}>Single-pool breakdown</Button>}
        </TableCell>
      </TableRow>
      {expanded && <TableRow className="bg-stone-50/80">
        <TableCell colSpan={7} className="whitespace-normal p-0!">
          <div className="sticky left-0 max-w-[calc(100vw-1.5rem)] p-3 lg:max-w-[calc(100vw-19rem)]">
            {expanded === "teams" ? <PayrollRoastTeams row={row} disabled={busy}
              storeCounts={edit && valid ? { whole: Number(edit.whole), bellies: Number(edit.bellies) } : undefined} /> :
              !hasTeams && <AllocationEditor key={`${row.productionDate}:${JSON.stringify(row.allocations)}`} row={row} legacy={legacy} disabled={busy || !!edit} />}
          </div>
        </TableCell>
      </TableRow>}
    </>
  );
}

type AllocationFields = { partihan: string; milestone: string };
const shareFields = (allocation: RoastAllocation): AllocationFields => ({
  partihan: String(allocation.partihanAmount),
  milestone: String(allocation.milestoneBonusAmount),
});

function AllocationEditor({ row, legacy, disabled }: { row: RoastProduction; legacy: boolean; disabled: boolean }) {
  const [edits, setEdits] = useState<Record<number, AllocationFields>>({});
  const save = useSaveRoastAllocationsMutation();
  const allocations = row.allocations ?? [];
  const changes = allocations.filter((allocation) => edits[allocation.employeeId] !== undefined);
  const valid = changes.every(({ employeeId }) => validMoney(edits[employeeId].partihan) && validMoney(edits[employeeId].milestone));
  const busy = save.isPending || disabled || !row.isSaved;

  function change(allocation: RoastAllocation, key: keyof AllocationFields, value: string) {
    setEdits((previous) => ({ ...previous, [allocation.employeeId]: { ...(previous[allocation.employeeId] ?? shareFields(allocation)), [key]: value } }));
  }

  return (
    <div className="grid gap-2 border-l-2 border-amber-200 pl-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Roaster breakdown · {displayDate(row.productionDate)}</h3>
        <div className="flex gap-2">
          {row.isSaved && <Button type="button" size="sm" variant="outline" disabled={busy}
            title="Clear manual overrides and recalculate using the current policy"
            onClick={() => save.mutate({ date: row.productionDate, allocations: [], reset: true }, { onSuccess: () => setEdits({}) })}>
            {legacy ? "Switch to dual incentives" : "Reset / recalculate"}
          </Button>}
          {!legacy && <Button type="button" size="sm" disabled={busy || !changes.length || !valid}
            onClick={() => save.mutate({ date: row.productionDate, allocations: changes.map(({ employeeId }) => ({
              employeeId, partihanAmount: Number(edits[employeeId].partihan), milestoneBonusAmount: Number(edits[employeeId].milestone),
            })) }, { onSuccess: () => setEdits({}) })}>Save overrides</Button>}
        </div>
      </div>
      {(!row.isSaved || disabled) && <p className="text-xs text-stone-600">Save production counts to edit the shares.</p>}
      {legacy && <ul className="flex flex-wrap gap-2">{row.shares.map((share) => <li key={share.employeeId} className="rounded-md bg-white px-2 py-1 text-xs">{share.employeeName} · {money(share.share)}</li>)}</ul>}
      {!legacy && allocations.length === 0 && <p className="text-sm text-stone-600">No eligible roasters worked on this date.</p>}
      {!legacy && allocations.length > 0 && <Table>
        <TableHeader><TableRow>{["Roaster", "Tier / Weight", "Day credit", "Partihan (₱)", "Milestone (₱)", "Total incentive"].map((heading) => <TableHead scope="col" key={heading}>{heading}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{allocations.map((allocation) => {
          const fields = edits[allocation.employeeId] ?? shareFields(allocation);
          const total = Number(fields.partihan) + Number(fields.milestone);
          return <TableRow key={allocation.employeeId}>
            <TableCell className="whitespace-normal font-medium">{allocation.employeeName} {allocation.isManualOverride && <Badge className="ml-1 bg-amber-100 text-amber-950">Override</Badge>}</TableCell>
            <TableCell>{allocation.incentiveTier} · {allocation.weightSnapshot}</TableCell>
            <TableCell>{allocation.dayCredit.toFixed(1)}</TableCell>
            <TableCell><Input type="number" min="0" step="0.01" aria-label={`Partihan for ${allocation.employeeName}`} className="w-24" value={fields.partihan} disabled={busy} onChange={(event) => change(allocation, "partihan", event.target.value)} /></TableCell>
            <TableCell><Input type="number" min="0" step="0.01" aria-label={`Milestone for ${allocation.employeeName}`} className="w-24" value={fields.milestone} disabled={busy} onChange={(event) => change(allocation, "milestone", event.target.value)} /></TableCell>
            <TableCell className="font-semibold tabular-nums">{money(total)}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>}
    </div>
  );
}

const valeLabels = { Disbursement: "Disbursement", PayrollDeduction: "Payroll deduction", CashRepayment: "Cash repayment" };

function ValeLedger() {
  const vale = useValeSummary();
  const [entryType, setEntryType] = useState<ValeInput["type"] | null>(null);
  const [entryToVoid, setEntryToVoid] = useState<ValeEntry | null>(null);
  const employees = vale.data?.employees ?? [];

  return (
    <PayrollSection title="Cash Advance (Vale)" description="Outstanding balances include cash repayments and finalized payroll deductions." actions={
      <>
        <Button type="button" onClick={() => setEntryType("Disbursement")} disabled={!employees.length || !vale.data?.enableValeSystem}><Plus /> Record Vale</Button>
        <Button type="button" variant="outline" onClick={() => setEntryType("CashRepayment")} disabled={!employees.some((employee) => employee.unpaidValeBalance > 0)}><Plus /> Cash Repayment</Button>
      </>
    }>
      {vale.isError && <PayrollQueryError error={vale.error} retry={vale.refetch} />}
      {vale.isPending && <PayrollEmpty>Loading Vale balances…</PayrollEmpty>}
      {vale.data && !vale.data.enableValeSystem && <p className="mx-4 mt-4 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-700">Cash Advance (Vale) system is currently turned OFF in Settings</p>}
      {vale.data?.enableValeSystem && <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-5">
        <Badge className="bg-amber-100 text-amber-950">{vale.data.valeAllowedDayOfWeek === "Wednesday" ? "Wednesday disbursements only" : "Disbursements allowed any day"}</Badge>
        <Badge variant="outline">Earned wages as of {displayDate(vale.data.asOf)}</Badge>
      </div>}
      {vale.data?.employees.length === 0 && <PayrollEmpty>Add an employee to record cash advances.</PayrollEmpty>}
      {!!employees.length && (
        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((employee) => (
            <div key={employee.id} className="min-w-0 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <p className="truncate text-sm font-semibold" title={employee.fullName}>{employee.fullName}</p>
                <WalletCards className="size-4 shrink-0 text-stone-500" aria-hidden="true" />
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-stone-950">{money(employee.unpaidValeBalance)}</p>
              <p className="text-xs text-stone-600">Unpaid Vale Balance</p>
              {vale.data?.enableValeSystem && <dl className="mt-2 grid gap-1 border-t border-stone-200 pt-2 text-xs">
                <div className="flex flex-wrap justify-between gap-1"><dt>Earned So Far This Week</dt><dd className="font-semibold">{money(employee.currentWeekEarnedSoFar)}</dd></div>
                <div className="flex flex-wrap justify-between gap-1"><dt>Max Allowed Vale</dt><dd className="font-semibold">{vale.data.enforceValeEarnedCap ? money(employee.maxAllowedValeNow) : "No earned-wage cap"}</dd></div>
              </dl>}
            </div>
          ))}
        </div>
      )}
      {vale.data?.entries.length === 0 && !!employees.length && <PayrollEmpty>No Vale transactions recorded.</PayrollEmpty>}
      {!!vale.data?.entries.length && (
        <Table className="min-w-[760px] border-t border-stone-100 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5">
          <TableHeader className="bg-stone-50">
            <TableRow>{["Date", "Employee", "Type", "Amount", "Remarks", "Recorded by", "Action"].map((heading) => <TableHead key={heading} scope="col">{heading}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {vale.data.entries.map((entry) => (
              <ValeLedgerRow key={entry.id} entry={entry} onVoid={() => setEntryToVoid(entry)} />
            ))}
          </TableBody>
        </Table>
      )}

      {entryType && <ValeEditor type={entryType} employees={employees} onClose={() => setEntryType(null)} />}
      {entryToVoid && <VoidValeDialog entry={entryToVoid} onClose={() => setEntryToVoid(null)} />}
    </PayrollSection>
  );
}

function ValeLedgerRow({ entry, onVoid }: { entry: ValeEntry; onVoid: () => void }) {
  const strike = entry.isVoided ? "line-through" : undefined;
  const typeStyle = entry.isVoided ? "bg-stone-100 text-stone-600 line-through" : entry.type === "Disbursement"
    ? "bg-amber-100 text-amber-950" : "bg-emerald-50 text-emerald-900";
  return (
    <TableRow className={entry.isVoided ? "bg-stone-50 text-stone-500" : undefined}>
      <TableCell className={strike}>{entry.transactionDate}</TableCell>
      <TableCell className="font-semibold"><span className={strike}>{entry.employeeName}</span></TableCell>
      <TableCell>
        <Badge className={typeStyle}>{valeLabels[entry.type]}</Badge>
        {entry.isVoided && <Badge variant="outline" className="ml-1.5 text-stone-700">Voided</Badge>}
      </TableCell>
      <TableCell className="font-medium tabular-nums"><span className={strike}>{money(entry.amount)}</span></TableCell>
      <TableCell className="max-w-72 whitespace-normal">
        <span className={strike}>{entry.remarks || "—"}</span>
        {entry.isVoided && <p className="mt-0.5 text-xs text-stone-600"
          title={entry.voidedAt ? `${entry.voidedAt.slice(0, 16).replace("T", " ")} Philippine time` : undefined}>
          Voided by {entry.voidedBy}{entry.voidReason && ` · ${entry.voidReason}`}
        </p>}
      </TableCell>
      <TableCell className={strike}>{entry.recordedBy}</TableCell>
      <TableCell>
        {!entry.isVoided && !entry.payrollPeriodId && <Button type="button" variant="ghost" size="xs" onClick={onVoid}
          aria-label={`Void ${entry.employeeName} ${valeLabels[entry.type].toLowerCase()}`}><Undo2 /> Void</Button>}
      </TableCell>
    </TableRow>
  );
}

function VoidValeDialog({ entry, onClose }: { entry: ValeEntry; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const voidVale = useVoidValeMutation();
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !voidVale.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Vale entry</DialogTitle>
          <DialogDescription>The entry will remain visible in the ledger. Balances and draft payroll will update.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          voidVale.mutate({ id: entry.id, reason }, { onSuccess: onClose });
        }}>
          <p className="rounded-lg bg-stone-50 px-3 py-2 font-medium tabular-nums">{entry.employeeName} · {money(entry.amount)} · {entry.transactionDate}</p>
          <PayrollField label="Void Reason"><Input value={reason} maxLength={250} onChange={(event) => setReason(event.target.value)} /></PayrollField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={voidVale.isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={voidVale.isPending}>{voidVale.isPending ? "Voiding…" : "Confirm Void"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ValeEditor({ type, employees, onClose }: { type: ValeInput["type"]; employees: ValeEmployee[]; onClose: () => void }) {
  const repayment = type === "CashRepayment";
  const roster = repayment ? employees.filter((employee) => employee.unpaidValeBalance > 0) : employees;
  const [employeeId, setEmployeeId] = useState(roster[0]?.id);
  const [date, setDate] = useState(payrollToday);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [overridePolicy, setOverridePolicy] = useState(false);
  const record = useRecordValeMutation();
  const rules = useValeSummary(date || undefined);
  const wages = rules.data?.employees.find((employee) => employee.id === employeeId);
  const balance = employees.find((employee) => employee.id === employeeId)?.unpaidValeBalance ?? 0;
  const valid = Boolean(employeeId && date && validMoney(amount) && Number(amount) > 0 && (!repayment || Number(amount) <= balance));

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !record.isPending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{repayment ? "Record cash repayment" : "Record Vale"}</DialogTitle>
          <DialogDescription>{repayment ? "Post a cash payment against this employee’s outstanding balance." : "Record cash advanced to an employee."}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          if (valid && employeeId) record.mutate({ employeeId, transactionDate: date, type, amount: Number(amount), remarks, overridePolicy: !repayment && overridePolicy }, { onSuccess: onClose });
        }}>
          <PayrollField label="Employee">
            <select className={payrollSelect} value={employeeId ?? ""} onChange={(event) => setEmployeeId(Number(event.target.value))} required>
              {roster.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}{!employee.isActive && " (inactive)"}</option>)}
            </select>
          </PayrollField>
          <div className="grid grid-cols-2 gap-3">
            <PayrollField label="Transaction date"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></PayrollField>
            <PayrollField label="Amount (₱)"><Input type="number" min="0.01" max={repayment ? balance : undefined} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></PayrollField>
          </div>
          <p className="text-sm text-stone-600">Current unpaid balance <strong>{money(balance)}</strong></p>
          {!repayment && <div className="grid gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950">
            {rules.data?.valeAllowedDayOfWeek === "Wednesday" && <p>Disbursements are allowed on Wednesday.</p>}
            {wages && <p>Earned this week <strong>{money(wages.currentWeekEarnedSoFar)}</strong>{rules.data?.enforceValeEarnedCap && <> · Maximum Vale <strong>{money(wages.maxAllowedValeNow)}</strong></>}</p>}
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={overridePolicy} onChange={(event) => setOverridePolicy(event.target.checked)} /> Override policy</label>
          </div>}
          <PayrollField label="Remarks"><Textarea value={remarks} maxLength={1000} onChange={(event) => setRemarks(event.target.value)} /></PayrollField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={record.isPending}>Cancel</Button>
            <Button type="submit" disabled={!valid || record.isPending}>{record.isPending ? "Recording…" : repayment ? "Record repayment" : "Record Vale"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
