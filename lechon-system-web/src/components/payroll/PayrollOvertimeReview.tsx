import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, Clock3, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDecideOvertimeMutation, type AttendanceDay, type OvertimeDecisionInput, type PayrollSettings } from "@/hooks/usePayroll";
import { displayAuditDate, money, validMoney } from "./payrollDisplay";
import { PayrollField } from "./PayrollUi";

export function PayrollOvertimeReview({ day, settings, disabled }: {
  day: AttendanceDay;
  settings?: PayrollSettings;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const decision = useDecideOvertimeMutation();
  const pending = day.overtimeStatus === "Pending";
  const approved = day.overtimeStatus === "Approved";
  const hasRequest = pending || approved;
  const hours = day.pendingOvertimePayOverride !== null ? day.overtimeHours : day.overtimeHours || day.suggestedOvertimeHours;
  const request = hours > 0 ? `${hours}h` : money(day.pendingOvertimePayOverride ?? 0);
  const busy = disabled || decision.isPending;

  function submit(input: OvertimeDecisionInput) {
    decision.mutate({ id: day.id, input }, { onSuccess: () => setOpen(false) });
  }

  return (
    <div className="grid min-w-48 justify-items-start gap-1.5">
      {pending && <Badge className="bg-amber-100 text-amber-950"><Clock3 /> OT Pending ({request})</Badge>}
      {approved && <Badge className="bg-emerald-50 text-emerald-900" title={day.overtimeApprovedAt && day.overtimeApprovedBy
        ? `Approved by ${day.overtimeApprovedBy} on ${displayAuditDate(day.overtimeApprovedAt)}` : undefined}>
        <Check /> OT Approved ({day.overtimeHours}h · {money(day.overtimePay)})
      </Badge>}
      {day.overtimeStatus === "Rejected" && <Badge variant="outline" className="text-stone-600">OT Rejected</Badge>}
      <div className="flex flex-wrap gap-1.5">
        {pending && <>
          <Button type="button" size="xs" className="bg-emerald-800 text-white hover:bg-emerald-900" disabled={busy} onClick={() => submit({ decision: "Approve" })}><Check /> Approve</Button>
          <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => submit({ decision: "Reject" })}><X /> Reject</Button>
        </>}
        <Popover.Root open={open} onOpenChange={(next) => { if (!decision.isPending) setOpen(next); }}>
          <Popover.Trigger render={<Button type="button" variant="outline" size="xs" disabled={busy} />}>
            {hasRequest ? <Pencil /> : <Plus />} {hasRequest ? "Edit OT" : "File OT"}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} align="end" className="z-50">
              <Popover.Popup className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-4 shadow-lg outline-none">
                <Popover.Title className="text-sm font-bold">Overtime for {day.employeeName}</Popover.Title>
                <Popover.Description className="mt-1 text-xs text-stone-600">Overtime is included in payroll after approval.</Popover.Description>
                {open && <OvertimeFields day={day} settings={settings} busy={decision.isPending} onSubmit={submit} />}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}

function OvertimeFields({ day, settings, busy, onSubmit }: {
  day: AttendanceDay;
  settings?: PayrollSettings;
  busy: boolean;
  onSubmit: (input: OvertimeDecisionInput) => void;
}) {
  const initialOverride = day.pendingOvertimePayOverride ?? (day.isOvertimePayOverridden ? day.overtimePay : null);
  const [hours, setHours] = useState(String(day.overtimeStatus === "Approved" || initialOverride !== null
    ? day.overtimeHours : day.overtimeHours || day.suggestedOvertimeHours));
  const [override, setOverride] = useState(initialOverride === null ? "" : String(initialOverride));
  const standard = settings?.standardWorkHoursPerDay ?? 8;
  const multiplier = settings?.overtimeMultiplier ?? 1.25;
  const valid = validMoney(hours) && Number(hours) <= 999.99 && (override === "" || validMoney(override))
    && (Number(hours) > 0 || override !== "");
  const potential = override === "" ? day.dailyRate / standard * multiplier * Number(hours) : Number(override);

  function save(decision: "Pending" | "Approve") {
    if (!valid) return;
    onSubmit({ decision, overtimeHours: Number(hours), overtimePayOverride: override === "" ? undefined : Number(override), useCalculatedPay: override === "" });
  }

  return (
    <div className="mt-3 grid gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <PayrollField label="OT hours"><Input type="number" min="0" max="999.99" step="0.01" value={hours} disabled={busy} onChange={(event) => setHours(event.target.value)} /></PayrollField>
        <PayrollField label="Custom pay (₱)"><Input placeholder="Calculated" type="number" min="0" step="0.01" value={override} disabled={busy} onChange={(event) => setOverride(event.target.value)} /></PayrollField>
      </div>
      <p className="text-xs text-stone-600" title={`Daily rate ÷ ${standard} standard hours × ${multiplier} × OT hours`}>
        Amount on approval <strong className="tabular-nums">{valid ? money(potential) : "—"}</strong>
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!valid || busy} onClick={() => save("Pending")}>File as pending</Button>
        <Button type="button" size="sm" className="bg-emerald-800 text-white hover:bg-emerald-900" disabled={!valid || busy} onClick={() => save("Approve")}><Check /> Approve OT</Button>
      </div>
    </div>
  );
}
