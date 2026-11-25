import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Fingerprint, Flame, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PayrollCutoff } from "@/hooks/usePayroll";
import { PayrollAttendance } from "@/components/payroll/PayrollAttendance";
import { PayrollEmployees } from "@/components/payroll/PayrollEmployees";
import { PayrollProductionAndVale } from "@/components/payroll/PayrollProductionAndVale";
import { PayrollWeeklySheet } from "@/components/payroll/PayrollWeeklySheet";
import { PayrollField } from "@/components/payroll/PayrollUi";
import { currentCutoff, displayDate, displayPeriod, monthlyCutoff, payrollToday, shiftDate, validCutoff } from "@/components/payroll/payrollDisplay";

const tabButton = "min-h-9 min-w-0 justify-start whitespace-normal px-2 text-left text-xs md:justify-center md:whitespace-nowrap md:text-sm";
const dateInput = "w-full min-w-0 border-stone-600 bg-stone-900 px-2 text-sm text-white [color-scheme:dark] sm:w-36";
const cycleLabels = { Weekly: "Weekly", SemiMonthly: "Semi-monthly", Custom: "Custom" };

export default function PayrollPage() {
  const [range, setRange] = useState(currentCutoff);
  const rangeKey = `${range.startDate}/${range.endDate}/${range.cycleType}`;

  return (
    <div className="mx-auto grid w-full max-w-[1480px] gap-5 pb-7">
      <header className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900">
          <WalletCards className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-950 sm:text-3xl">Payroll &amp; Attendance</h1>
      </header>

      <WeeklyCutoff key={rangeKey} range={range} onChange={setRange} />

      <Tabs defaultValue="attendance" className="min-w-0 gap-4">
        <div className="min-w-0 overflow-x-auto rounded-xl bg-stone-100 ring-1 ring-stone-200">
          <TabsList aria-label="Payroll sections" className="grid w-full grid-cols-2 gap-1 bg-transparent md:inline-flex md:w-auto md:min-w-full md:justify-start">
            <TabsTrigger className={tabButton} value="attendance"><Fingerprint /> Attendance &amp; USB Import</TabsTrigger>
            <TabsTrigger className={tabButton} value="production"><Flame /> Roasting Incentives &amp; Vale</TabsTrigger>
            <TabsTrigger className={tabButton} value="payroll"><WalletCards /> Weekly Payroll &amp; Payslips</TabsTrigger>
            <TabsTrigger className={tabButton} value="employees"><Users /> Employees &amp; Settings</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="attendance" className="min-w-0"><PayrollAttendance range={range} /></TabsContent>
        <TabsContent value="production" className="min-w-0"><PayrollProductionAndVale key={rangeKey} range={range} /></TabsContent>
        <TabsContent value="payroll" className="min-w-0"><PayrollWeeklySheet key={rangeKey} range={range} onSelectPeriod={setRange} /></TabsContent>
        <TabsContent value="employees" className="min-w-0"><PayrollEmployees /></TabsContent>
      </Tabs>
    </div>
  );
}

function WeeklyCutoff({ range, onChange }: { range: PayrollCutoff; onChange: (range: PayrollCutoff) => void }) {
  const [custom, setCustom] = useState(range);
  const isCustom = custom.startDate !== range.startDate || custom.endDate !== range.endDate;
  const today = payrollToday();
  const presets = [
    { label: "This Week (Mon–Sun)", cutoff: currentCutoff() },
    { label: "1st–15th", cutoff: monthlyCutoff(today, "first") },
    { label: "16th–End of Month", cutoff: monthlyCutoff(today, "second") },
  ];

  function moveCutoff(direction: -1 | 1) {
    if (range.cycleType === "SemiMonthly") {
      const adjacent = direction < 0 ? shiftDate(range.startDate, -1) : shiftDate(range.endDate, 1);
      onChange(monthlyCutoff(adjacent, Number(adjacent.slice(8, 10)) <= 15 ? "first" : "second"));
      return;
    }

    const inclusiveDays = (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86_400_000 + 1;
    const delta = direction * inclusiveDays;
    onChange({ ...range, startDate: shiftDate(range.startDate, delta), endDate: shiftDate(range.endDate, delta) });
  }

  return (
    <section aria-label="Payroll cutoff selector" className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-900 px-4 py-3.5 text-white shadow-md sm:px-5">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <CalendarDays className="size-4 text-amber-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-wide">{cycleLabels[range.cycleType]} cutoff</h2>
          <Badge className="bg-amber-200 text-amber-950">Payday: {displayDate(range.endDate, true)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Button type="button" variant="ghost" className="text-stone-200 hover:bg-stone-700 hover:text-white" onClick={() => moveCutoff(-1)}>
            <ChevronLeft /> {range.cycleType === "Weekly" ? "Prev Week" : "Previous cutoff"}
          </Button>
          <span className="order-first basis-full text-sm font-semibold tabular-nums sm:order-none sm:basis-auto">{displayPeriod(range)}</span>
          <Button type="button" variant="ghost" className="text-stone-200 hover:bg-stone-700 hover:text-white" onClick={() => moveCutoff(1)}>
            {range.cycleType === "Weekly" ? "Next Week" : "Next cutoff"} <ChevronRight />
          </Button>
        </div>
      </div>
      <form className="grid w-full grid-cols-2 items-end gap-2 rounded-xl bg-stone-800 p-2.5 sm:flex sm:w-auto sm:flex-wrap" onSubmit={(event) => {
        event.preventDefault();
        if (validCutoff(custom)) onChange({ ...custom, cycleType: "Custom" });
      }}>
        <div className="[&_label]:text-xs [&_label]:text-stone-200">
          <PayrollField label="Start date">
            <Input type="date" required className={dateInput} value={custom.startDate} onChange={(event) => setCustom({ ...custom, startDate: event.target.value })} />
          </PayrollField>
        </div>
        <div className="[&_label]:text-xs [&_label]:text-stone-200">
          <PayrollField label="End date">
            <Input type="date" required className={dateInput} value={custom.endDate} onChange={(event) => setCustom({ ...custom, endDate: event.target.value })} />
          </PayrollField>
        </div>
        <Button type="submit" className="col-span-2 w-fit bg-white text-stone-950 hover:bg-stone-200" disabled={!isCustom || !validCutoff(custom)}>Apply dates</Button>
        {isCustom && !validCutoff(custom) && <p className="col-span-2 w-full text-xs text-amber-200">Choose an inclusive cutoff of up to 31 days.</p>}
      </form>
      <div className="flex w-full flex-wrap gap-1.5" aria-label="Cutoff presets">
        {presets.map(({ label, cutoff }) => (
          <Button key={label} type="button" variant="ghost" size="sm"
            aria-pressed={range.startDate === cutoff.startDate && range.endDate === cutoff.endDate && range.cycleType === cutoff.cycleType}
            className="rounded-full border border-stone-600 px-2.5 text-stone-200 hover:bg-stone-700 hover:text-white aria-pressed:border-amber-300 aria-pressed:bg-amber-200 aria-pressed:text-amber-950"
            onClick={() => onChange(cutoff)}>{label}</Button>
        ))}
      </div>
    </section>
  );
}
