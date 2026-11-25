import { useId, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Clock3, FileSpreadsheet, Fingerprint, Moon, Plus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useAttendanceRange, useImportBiometricsMutation, useManualAttendanceMutation, usePayrollEmployees, usePayrollSettings,
  useUpdateAttendanceMutation, type AttendanceDay, type AttendanceInput, type PayrollEmployee,
  type DayType, type PayrollRange, type PayrollSettings, type UnmappedBiometricUser,
} from "@/hooks/usePayroll";
import { cn } from "@/lib/utils";
import { PayrollAttendanceTable } from "./PayrollAttendanceTable";
import { PayrollEmployeeEditor } from "./PayrollEmployees";
import { displayAuditDate, displayDate, localClock, money, payrollToday, shiftDate } from "./payrollDisplay";
import { PayrollOvertimeReview } from "./PayrollOvertimeReview";
import { PayrollEmpty, PayrollField, PayrollQueryError, PayrollSection, payrollSelect } from "./PayrollUi";

const doubleTapNote = "Double-tap / <15m span — verify";

const creditOptions = [
  { value: 1, label: "1.0 Full" },
  { value: 0.5, label: "0.5 Half" },
  { value: 1.5, label: "1.5 Peak", title: "Dec 24 / Dec 31 peak rate" },
  { value: 0, label: "0 Absent" },
];

const clockMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

function basePayLabel(rate: number, credit: number) {
  // Half-day credits can land on a half cent. Match payroll's midpoint-to-even rounding.
  const halfCents = Math.round(rate * 100) * (credit * 2);
  const cents = Math.floor(halfCents / 2);
  return money((cents + (halfCents % 2 === 1 && cents % 2 === 1 ? 1 : 0)) / 100);
}

const exceptions = {
  MissingPunch: { label: "Missing Punch", icon: AlertTriangle, style: "bg-red-50 text-red-800" },
  ShortShift: { label: "Short Shift", icon: Clock3, style: "bg-amber-100 text-amber-950" },
  LongShift: { label: "Long Shift", icon: Clock3, style: "bg-blue-50 text-blue-800" },
  None: { label: "OK", icon: Check, style: "bg-emerald-50 text-emerald-800" },
};

function dayTypeLabel(type: DayType, settings?: PayrollSettings) {
  if (type === "Regular") return "Regular";
  const standard = type === "SpecialHoliday" ? "Special holiday" : "Regular holiday";
  if (!settings?.enableHolidayPay) return standard;
  const rate = type === "SpecialHoliday" ? settings.specialHolidayMultiplier : settings.regularHolidayMultiplier;
  return `${standard} +${Number(((rate - 1) * 100).toFixed(2))}%`;
}

function DayTypeSelect({ value, onChange, label, disabled, settings }: {
  value: DayType | "Auto"; onChange: (value: DayType | "Auto") => void; label: string; disabled?: boolean; settings?: PayrollSettings;
}) {
  return <select className={payrollSelect} aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as DayType | "Auto")}>
    <option value="Auto">Holiday calendar</option>
    {(["Regular", "SpecialHoliday", "RegularHoliday"] as const).map((type) => <option key={type} value={type}>{dayTypeLabel(type, settings)}</option>)}
  </select>;
}

function DayCreditPills({ value, onChange, label, disabled }: {
  value: number; onChange: (value: number) => void; label: string; disabled?: boolean;
}) {
  return <div role="group" aria-label={label} className="flex min-w-40 flex-wrap gap-1.5">
    {creditOptions.map((option) => <Button type="button" key={option.value} size="xs" title={option.title} aria-pressed={value === option.value}
      variant="outline" className={cn("rounded-full", value === option.value && "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100")}
      disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</Button>)}
  </div>;
}

export function PayrollAttendance({ range }: { range: PayrollRange }) {
  const attendance = useAttendanceRange(range);
  const employees = usePayrollEmployees();
  const policy = usePayrollSettings();
  const importPunches = useImportBiometricsMutation();
  const [linking, setLinking] = useState<UnmappedBiometricUser | null>(null);
  const [editor, setEditor] = useState<{ day?: AttendanceDay } | null>(null);
  const days = attendance.data?.days;
  const columns = ["Employee", "Date", "Time In", "Time Out", "Hours", "Exception", "Day Credit", "Day Type", "OT Approval",
    ...(policy.data?.enableLateDeduction ? ["Late deduction"] : []), "Review"];
  const mappedIds = new Set(employees.data?.map((employee) => employee.biometricUserId));
  const unmapped = new Map<number, UnmappedBiometricUser>();
  for (const user of [...(importPunches.data?.unmappedUsers ?? []), ...(attendance.data?.unmappedUsers ?? [])]) {
    if (!mappedIds.has(user.biometricUserId)) unmapped.set(user.biometricUserId, user);
  }

  return (
    <div className="grid gap-4">
      <UsbImport importPunches={importPunches} hasAttendance={days && days.length > 0} />

      {unmapped.size > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:px-5">
          <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> Unmapped Deli IDs</h2>
          <ul className="mt-2 divide-y divide-amber-200">
            {Array.from(unmapped.values()).map((user) => (
              <li key={user.biometricUserId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm"><strong>#{user.biometricUserId}</strong>{user.biometricNameSnapshot && ` · ${user.biometricNameSnapshot}`} · {user.punchCount} {user.punchCount === 1 ? "punch" : "punches"}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setLinking(user)}><Plus /> Link / Add Employee</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PayrollSection title="Daily attendance" description="Punch times use the Philippine local clock." actions={
        <Button type="button" variant="outline" onClick={() => setEditor({})} disabled={!employees.data?.length}><Plus /> Manual Entry</Button>
      }>
        {attendance.isError && <PayrollQueryError error={attendance.error} retry={attendance.refetch} />}
        {attendance.isPending && <PayrollEmpty>Loading daily attendance…</PayrollEmpty>}
        {days && <PayrollAttendanceTable days={days} cutoffKey={`${range.startDate}/${range.endDate}`} columns={columns}
          renderDay={(day, hidden) => <AttendanceRow key={`${day.id}:${day.dayCredit}:${day.dayTypeOverride}`}
            day={day} hidden={hidden} settings={policy.data} onReview={() => setEditor({ day })} />} />}
      </PayrollSection>

      {!!attendance.data?.recentImportBatches.length && (
        <details className="rounded-xl border border-stone-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-stone-800 sm:px-5">Recent USB imports</summary>
          <Table className="min-w-[690px] border-t border-stone-100 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5">
            <TableHeader className="bg-stone-50">
              <TableRow>{["File", "Export period", "Imported", "Duplicates", "Unmapped IDs", "Imported by"].map((heading) => <TableHead key={heading} scope="col">{heading}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {attendance.data.recentImportBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.fileName}</TableCell>
                  <TableCell>{displayDate(batch.periodStart)} – {displayDate(batch.periodEnd)}</TableCell>
                  <TableCell>{batch.punchesImported}</TableCell><TableCell>{batch.duplicatesSkipped}</TableCell><TableCell>{batch.unmappedUserCount}</TableCell>
                  <TableCell>{batch.importedBy}<span className="block text-xs text-stone-500">{displayAuditDate(batch.importedAt)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      )}

      {linking && <PayrollEmployeeEditor unmapped={linking} employees={employees.data} onClose={() => setLinking(null)} />}
      {editor && <AttendanceEditor day={editor.day} settings={policy.data} employees={employees.data ?? []} range={range} onClose={() => setEditor(null)} />}
    </div>
  );
}

function UsbImport({ importPunches, hasAttendance }: { importPunches: ReturnType<typeof useImportBiometricsMutation>; hasAttendance?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const contentId = useId();
  const open = expanded ?? (hasAttendance === false);

  function selectFiles(selected: FileList | null) {
    if (!selected?.length || importPunches.isPending) return;
    const items = Array.from(selected);
    setExpanded(true);
    if (items.length > 2 || items.some((file) => !file.name.toLowerCase().endsWith(".xls"))) {
      setFiles([]);
      setError("Choose one or two binary .xls attendance exports.");
      return;
    }
    setError("");
    setFiles(items);
  }

  return (
    <section className={cn("min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs", dragging && "border-amber-500")}
      onDragOver={(event) => { event.preventDefault(); if (!importPunches.isPending) setDragging(true); }}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}>
      <h2>
        <button type="button" aria-expanded={open} aria-controls={contentId}
          className={cn("flex w-full min-w-0 items-center gap-2.5 px-4 py-3 text-left outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 sm:px-5",
            open && "border-b border-stone-100", dragging && "bg-amber-50")}
          onClick={() => setExpanded(!open)}>
          <Upload aria-hidden="true" className="size-4 shrink-0 text-amber-800" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-900">Import Deli punches{!open && <span className="font-normal text-stone-600"> · Drop .xls or expand</span>}</span>
          <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-stone-500 transition-transform", !open && "-rotate-90")} />
        </button>
      </h2>
      <div id={contentId} hidden={!open} className="p-4 sm:p-5">
        <div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 px-4 py-5 sm:px-5", dragging && "border-amber-500 bg-amber-50")}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-950"><Upload className="size-4" /></div>
            <div>
              <p className="font-semibold text-stone-900">Drop one or two .xls files</p>
              <p className="mt-1 max-w-[54ch] text-sm text-stone-600">Upload <strong>Employee Attendance Record.xls</strong> from your FAT32 USB drive. Deli Attendance Report and Abnormal Report exports are rejected.</p>
            </div>
          </div>
          <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label="Deli attendance export files" accept=".xls" multiple disabled={importPunches.isPending}
            onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={importPunches.isPending}>Choose files</Button>
            <Button type="button" disabled={!files.length || importPunches.isPending} onClick={() => importPunches.mutate(files, { onSuccess: () => setFiles([]) })}>
              <Fingerprint /> {importPunches.isPending ? "Importing…" : "Import punches"}
            </Button>
          </div>
        </div>
        {!!files.length && <ul className="mt-3 grid gap-1 text-sm text-stone-700">{files.map((file, index) => <li key={`${index}:${file.name}`} className="flex min-w-0 items-center gap-2 break-all"><FileSpreadsheet className="size-4 shrink-0" /> {file.name}</li>)}</ul>}
        {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
        {importPunches.data && <p role="status" className="mt-3 text-sm text-emerald-900">{importPunches.data.punchesImported} new punches imported · {importPunches.data.duplicatesSkipped} duplicates skipped</p>}
      </div>
    </section>
  );
}

function AttendanceRow({ day, hidden, onReview, settings }: { day: AttendanceDay; hidden?: boolean; onReview: () => void; settings?: PayrollSettings }) {
  const [credit, setCredit] = useState(day.dayCredit);
  const [dayType, setDayType] = useState<DayType | "Auto">(day.dayTypeOverride ?? "Auto");
  const save = useUpdateAttendanceMutation();
  const changed = credit !== day.dayCredit || dayType !== (day.dayTypeOverride ?? "Auto");
  const flag = exceptions[day.exceptionFlag];
  const Icon = flag.icon;
  const rowLabel = `${day.employeeName}, ${displayDate(day.workDate)}`;

  function saveRow(isLateExcused = day.isLateExcused) {
    save.mutate({ id: day.id, input: {
      timeIn: day.timeIn, timeOut: day.timeOut, dayCredit: credit, dayType, notes: day.notes, isLateExcused, isReviewed: true,
    } });
  }

  return (
    <TableRow hidden={hidden}>
      <TableCell className="font-semibold">{day.employeeName}</TableCell>
      <TableCell>{displayDate(day.workDate)}</TableCell>
      <TableCell className="tabular-nums">{day.timeIn?.slice(11, 16) ?? "—"}</TableCell>
      <TableCell className="tabular-nums">
        {day.timeOut?.slice(11, 16) ?? "—"}
        {day.isOvernightShift && <Badge title="Checkout on the following date" className="ml-1.5 bg-indigo-50 text-indigo-900"><Moon /> Overnight</Badge>}
      </TableCell>
      <TableCell className="tabular-nums">{day.totalHours.toFixed(2)}</TableCell>
      <TableCell>
        <Badge className={flag.style}><Icon /> {flag.label}</Badge>
        {day.notes && <p className="mt-1 max-w-36 truncate text-xs text-stone-600" title={day.notes}>{day.notes}</p>}
      </TableCell>
      <TableCell>
        <DayCreditPills label={`Day credit for ${rowLabel}`} value={credit} disabled={save.isPending} onChange={setCredit} />
        <p className="mt-1 text-xs text-stone-600 tabular-nums" aria-live="polite">{basePayLabel(day.dailyRate, credit)} base pay</p>
      </TableCell>
      <TableCell>
        <Badge className={day.dayType !== "Regular" ? "bg-indigo-50 text-indigo-900" : undefined}>{dayTypeLabel(day.dayType ?? "Regular", settings)}</Badge>
        {day.holidayPremiumPay > 0 && <p className="mt-0.5 text-xs font-medium text-emerald-800">+{money(day.holidayPremiumPay)}</p>}
        {settings?.enableHolidayPay && <div className="mt-1"><DayTypeSelect value={dayType} onChange={setDayType} label={`Day type for ${rowLabel}`} disabled={save.isPending} settings={settings} /></div>}
      </TableCell>
      <TableCell><PayrollOvertimeReview day={day} settings={settings} disabled={save.isPending || changed} /></TableCell>
      {settings?.enableLateDeduction && <TableCell>
        {day.lateMinutes > 0 && <Badge className="bg-amber-50 text-amber-950">Late {day.lateMinutes}m{day.lateDeduction > 0 && ` · −${money(day.lateDeduction)}`}</Badge>}
        {day.isLateExcused && <Badge className="bg-emerald-50 text-emerald-900">Excused</Badge>}
        {(day.lateMinutes > 0 || day.isLateExcused) ? <Button type="button" size="xs" variant="outline" className="mt-1 block" disabled={save.isPending || changed}
          onClick={() => saveRow(!day.isLateExcused)}>{day.isLateExcused ? "Restore penalty" : "Excuse"}</Button> : "—"}
      </TableCell>}
      <TableCell>
        <div className="flex items-center gap-1.5">
          {changed && <Button type="button" size="sm" disabled={save.isPending} onClick={() => saveRow()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>}
          <Button type="button" variant="outline" size="sm" onClick={onReview} disabled={save.isPending || changed}>{day.isReviewed && <Check className="text-emerald-700" />} {day.isReviewed ? "Edit" : "Review"}</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AttendanceEditor({ day, settings, employees, range, onClose }: {
  day?: AttendanceDay;
  settings?: PayrollSettings;
  employees: PayrollEmployee[];
  range: PayrollRange;
  onClose: () => void;
}) {
  const today = payrollToday();
  const originalTimeIn = day?.timeIn?.slice(11, 16) ?? "";
  const originalTimeOut = day?.timeOut?.slice(11, 16) ?? "";
  const [workDate, setWorkDate] = useState(day?.workDate ?? (today >= range.startDate && today <= range.endDate ? today : range.startDate));
  const [employeeId, setEmployeeId] = useState(day?.employeeId ?? employees[0]?.id);
  const [timeIn, setTimeIn] = useState(originalTimeIn);
  const [timeOut, setTimeOut] = useState(originalTimeOut);
  const [overnightChoice, setOvernightChoice] = useState<boolean | null>(day?.isOvernightShift ?? null);
  const [credit, setCredit] = useState(day?.dayCredit ?? 1);
  const [hasTouchedDayCredit, setHasTouchedDayCredit] = useState(false);
  const [dayType, setDayType] = useState<DayType | "Auto">(day?.dayTypeOverride ?? "Auto");
  const [shiftStart, setShiftStart] = useState(day?.scheduledStartTime?.slice(0, 5) ?? "");
  const [lateExcused, setLateExcused] = useState(Boolean(day?.isLateExcused));
  const [notes, setNotes] = useState(day?.notes ?? "");
  const [reviewed, setReviewed] = useState(day?.isReviewed ?? true);
  const create = useManualAttendanceMutation();
  const update = useUpdateAttendanceMutation();
  const busy = create.isPending || update.isPending;
  const scheduleChanged = shiftStart !== (day?.scheduledStartTime?.slice(0, 5) ?? "");
  const overnight = overnightChoice ?? Boolean(timeIn && timeOut && timeOut <= timeIn);
  const endDate = workDate && overnight ? shiftDate(workDate, 1) : workDate;
  const shiftMinutes = timeIn && timeOut ? clockMinutes(timeOut) - clockMinutes(timeIn) + (overnight ? 1440 : 0) : null;
  const timeError = timeOut && !timeIn ? "Enter Time in before Time out." : shiftMinutes !== null && shiftMinutes < 0
    ? "Time out is earlier than Time in. Turn on Overnight or adjust the time." : null;
  const duration = shiftMinutes !== null && shiftMinutes >= 0 ? `${(shiftMinutes / 60).toFixed(2)} hrs` : null;
  const punchesChanged = timeIn !== originalTimeIn || timeOut !== originalTimeOut || overnight !== day?.isOvernightShift;
  const validSpan = shiftMinutes !== null && shiftMinutes >= 15;
  const wasUnresolved = day?.dayCredit === 0 && (day.exceptionFlag === "MissingPunch" || day.notes === doubleTapNote);
  const selectedCredit = wasUnresolved && punchesChanged && validSpan && !hasTouchedDayCredit ? 1 : credit;
  const visibleNotes = validSpan && notes === doubleTapNote ? "" : notes;
  const dailyRate = employees.find((employee) => employee.id === employeeId)?.dailyRate ?? day?.dailyRate ?? 0;
  const creditLabel = creditOptions.find((option) => option.value === selectedCredit)?.label;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{day ? `Attendance for ${day.employeeName}` : "Manual attendance"}</DialogTitle>
          <DialogDescription>Punch times use the Philippine local clock.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          if (!employeeId || !workDate || timeError) return;
          const input: AttendanceInput = {
            timeIn: timeIn ? `${workDate}T${localClock(timeIn)}` : null,
            timeOut: timeOut ? `${endDate}T${localClock(timeOut)}` : null,
            dayCredit: selectedCredit, isReviewed: reviewed, notes: visibleNotes,
            dayType,
            scheduledStartTime: scheduleChanged ? localClock(shiftStart) : undefined,
            useEmployeeShiftStart: scheduleChanged ? !shiftStart : undefined,
            isLateExcused: lateExcused,
          };
          if (day) update.mutate({ id: day.id, input }, { onSuccess: onClose });
          else create.mutate({ employeeId, workDate, attendance: input }, { onSuccess: onClose });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <PayrollField label="Work date"><Input type="date" required readOnly={Boolean(day)} value={workDate} min={range.startDate} max={range.endDate} onChange={(event) => setWorkDate(event.target.value)} /></PayrollField>
            {!day && <PayrollField label="Employee">
              <select className={payrollSelect} value={employeeId ?? ""} required onChange={(event) => setEmployeeId(Number(event.target.value))}>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}{!employee.isActive && " (inactive)"}</option>)}
              </select>
            </PayrollField>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PayrollField label="Time in"><Input type="time" step="60" value={timeIn} onChange={(event) => {
              setTimeIn(event.target.value.slice(0, 5));
              setOvernightChoice(null);
            }} /></PayrollField>
            <PayrollField label="Time out"><Input type="time" step="60" value={timeOut} onChange={(event) => {
              setTimeOut(event.target.value.slice(0, 5));
              setOvernightChoice(null);
            }} /></PayrollField>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={overnight} onCheckedChange={setOvernightChoice} />
              <Moon className="size-4 text-indigo-700" aria-hidden="true" /> Overnight (Ends Next Day)
            </label>
            {overnight && endDate && <span className="text-xs text-indigo-900">→ Ends {displayDate(endDate)}{duration && ` · ${duration}`}</span>}
          </div>
          {timeError && <p role="alert" className="text-xs text-rose-800">{timeError}</p>}
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-stone-700">Day credit</legend>
            <DayCreditPills value={selectedCredit} onChange={(value) => {
              setHasTouchedDayCredit(true);
              setCredit(value);
            }} label="Day credit" disabled={busy} />
          </fieldset>
          {settings?.enableHolidayPay && <PayrollField label="Day type"><DayTypeSelect value={dayType} onChange={setDayType} label="Day type" settings={settings} /></PayrollField>}
          {settings?.enableLateDeduction && <div className="grid gap-3 sm:grid-cols-2">
            <PayrollField label="Scheduled start time"><Input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} />
              <span className="text-xs font-normal text-stone-500">Blank uses the employee’s default.</span>
            </PayrollField>
            <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={lateExcused} onCheckedChange={setLateExcused} /> Excuse lateness</label>
          </div>}
          <PayrollField label="Notes"><Textarea value={visibleNotes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} /></PayrollField>
          <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={reviewed} onCheckedChange={setReviewed} /> Mark as reviewed</label>
          <output className="grid gap-0.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
            <span className="font-semibold">Live shift &amp; pay preview</span>
            <span>{duration && `${duration} · `}{creditLabel} ({money(dailyRate)} × {selectedCredit}) = <strong>{basePayLabel(dailyRate, selectedCredit)}</strong> base pay</span>
          </output>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !employeeId || !workDate || Boolean(timeError)}>{busy ? "Saving…" : "Save attendance"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
