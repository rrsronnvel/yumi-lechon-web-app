import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AttendanceDay } from "@/hooks/usePayroll";
import { cn } from "@/lib/utils";
import { displayDate } from "./payrollDisplay";
import { PayrollEmpty, PayrollField, payrollSelect } from "./PayrollUi";

const needsAttention = (day: AttendanceDay) => day.exceptionFlag !== "None" || !day.isReviewed;
const hasPendingOt = (day: AttendanceDay) => day.overtimeStatus === "Pending";
const isLate = (day: AttendanceDay) => day.lateMinutes > 0 || day.lateDeduction > 0;

const quickFilters = [
  { label: "All", matches: () => true },
  { label: "Needs Attention", matches: needsAttention },
  { label: "Pending OT", matches: hasPendingOt },
  { label: "Late", matches: isLate },
  { label: "Overnight / Peak", matches: (day: AttendanceDay) => day.isOvernightShift || day.dayCredit === 1.5 },
] as const;

const sortOptions = [
  { value: "attention", label: "Attention First" },
  { value: "newest", label: "Date (Newest First)" },
  { value: "oldest", label: "Date (Oldest First)" },
  { value: "employee", label: "Employee (A → Z)" },
] as const;

const views = ["Flat", "By Date", "By Employee"] as const;
type QuickFilter = (typeof quickFilters)[number]["label"];
type SortOption = (typeof sortOptions)[number]["value"];
type View = (typeof views)[number];

function compareEmployee(first: AttendanceDay, second: AttendanceDay) {
  return first.employeeName.localeCompare(second.employeeName, "en-PH") || first.employeeId - second.employeeId;
}

function sortRows(first: AttendanceDay, second: AttendanceDay, sort: SortOption) {
  const date = second.workDate.localeCompare(first.workDate);
  const employee = compareEmployee(first, second);
  if (sort === "employee") return employee || date;
  if (sort === "oldest") return -date || employee;
  if (sort === "attention") {
    const priority = (day: AttendanceDay) => Number(hasPendingOt(day) || day.exceptionFlag !== "None");
    return priority(second) - priority(first) || date || employee;
  }
  return date || employee;
}

function groupRows(days: AttendanceDay[], view: Exclude<View, "Flat">) {
  const groups = new Map<string, AttendanceDay[]>();
  for (const day of days) {
    const key = view === "By Date" ? day.workDate : String(day.employeeId);
    const group = groups.get(key);
    if (group) group.push(day);
    else groups.set(key, [day]);
  }
  return Array.from(groups, ([key, rows]) => ({ key, rows }));
}

function groupSummary(rows: AttendanceDay[], view: Exclude<View, "Flat">) {
  if (view === "By Date") {
    const staff = new Set(rows.map((day) => day.employeeId)).size;
    const issues = rows.filter((day) => needsAttention(day) || hasPendingOt(day) || isLate(day)).length;
    return `${staff} staff · ${issues} ${issues === 1 ? "issue" : "issues"}`;
  }

  const days = rows.reduce((sum, day) => sum + day.dayCredit, 0);
  const overtime = rows.filter((day) => hasPendingOt(day) || day.overtimeStatus === "Approved").length;
  const late = rows.filter(isLate).length;
  return `${days.toFixed(1)} ${days === 1 ? "day" : "days"} · ${overtime} OT · ${late} Late`;
}

function filterPillClass(selected: boolean) {
  return cn("rounded-full", selected && "border-amber-300 bg-amber-100 font-semibold text-amber-950 hover:bg-amber-100");
}

export function PayrollAttendanceTable({ days, cutoffKey, columns, renderDay }: {
  days: AttendanceDay[];
  cutoffKey: string;
  columns: string[];
  renderDay: (day: AttendanceDay, hidden?: boolean) => ReactNode;
}) {
  const [quick, setQuick] = useState<QuickFilter>("All");
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");
  const [dateSelection, setDateSelection] = useState({ cutoffKey, date: "" });
  const [sort, setSort] = useState<SortOption>("attention");
  const [view, setView] = useState<View>("Flat");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searchId = useId();

  const employeeNames = new Map(days.map((day) => [String(day.employeeId), day.employeeName]));
  const employeeOptions = Array.from(employeeNames).sort(([idA, nameA], [idB, nameB]) => nameA.localeCompare(nameB, "en-PH") || Number(idA) - Number(idB));
  const dateCounts = new Map<string, number>();
  for (const day of days) dateCounts.set(day.workDate, (dateCounts.get(day.workDate) ?? 0) + 1);
  const dates = Array.from(dateCounts).sort(([first], [second]) => first.localeCompare(second));
  const selectedEmployee = employeeNames.has(employee) ? employee : "";
  const selectedDate = dateSelection.cutoffKey === cutoffKey && dateCounts.has(dateSelection.date) ? dateSelection.date : "";
  const query = search.trim().toLocaleLowerCase("en-PH");
  const quickMatch = quickFilters.find((filter) => filter.label === quick)?.matches;
  const filtered = days.filter((day) => (
    (!quickMatch || quickMatch(day)) &&
    (!selectedEmployee || String(day.employeeId) === selectedEmployee) &&
    (!selectedDate || day.workDate === selectedDate) &&
    (!query || day.employeeName.toLocaleLowerCase("en-PH").includes(query) || day.notes?.toLocaleLowerCase("en-PH").includes(query))
  )).sort((first, second) => sortRows(first, second, sort));
  const filtersActive = quick !== "All" || search.length > 0 || selectedEmployee !== "" || selectedDate !== "";

  function resetFilters() {
    setQuick("All");
    setSearch("");
    setEmployee("");
    setDateSelection({ cutoffKey, date: "" });
  }

  return (
    <>
      <div className="grid gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
        <div role="group" aria-label="Attendance quick filters" className="flex flex-wrap gap-2">
          {quickFilters.map(({ label, matches }) => (
            <Button key={label} type="button" size="sm" variant="outline" aria-pressed={quick === label} className={filterPillClass(quick === label)} onClick={() => setQuick(label)}>
              {label} <span className="rounded-full bg-stone-900/5 px-1.5 text-xs tabular-nums">{days.filter(matches).length}</span>
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 items-end gap-2.5 lg:grid-cols-[minmax(12rem,1.35fr)_minmax(7rem,1fr)_minmax(8rem,1fr)_auto]">
          <div className="col-span-2 grid min-w-0 gap-1.5 lg:col-span-1">
            <label htmlFor={searchId} className="text-sm font-medium text-stone-700">Search employee or notes</label>
            <div className="relative min-w-0">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2 size-4 text-stone-500" />
              <Input id={searchId} className="h-8 pl-8 pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee name or notes" />
              {search && <Button type="button" size="icon-xs" variant="ghost" aria-label="Clear attendance search" className="absolute right-1 top-1" onClick={() => setSearch("")}><X /></Button>}
            </div>
          </div>
          <PayrollField label="Employee filter">
            <select className={payrollSelect} value={selectedEmployee} onChange={(event) => setEmployee(event.target.value)}>
              <option value="">All employees</option>
              {employeeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </PayrollField>
          <PayrollField label="Sort attendance">
            <select className={payrollSelect} value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
              {sortOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </PayrollField>
          <div role="group" aria-label="Attendance view" className="col-span-2 flex w-fit gap-0.5 rounded-lg border border-stone-200 bg-stone-50 p-0.5 lg:col-span-1">
            {views.map((option) => <Button type="button" size="sm" key={option} variant="ghost" aria-pressed={view === option} onClick={() => setView(option)}
              className={cn("h-7 whitespace-nowrap px-2", view === option && "bg-white font-semibold text-amber-950 shadow-xs hover:bg-white")}>{option}</Button>)}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
          <p role="status" className="tabular-nums">Showing {filtered.length} of {days.length} rows</p>
          {filtersActive && <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>Reset filters</Button>}
        </div>
      </div>
      <div role="group" aria-label="Attendance day strip" className="flex gap-2 overflow-x-auto border-b border-stone-200 bg-stone-50/70 px-4 py-2.5 sm:px-5">
        {[{ date: "", count: days.length }, ...dates.map(([date, count]) => ({ date, count }))].map(({ date, count }) => (
          <Button key={date || "all"} type="button" size="sm" variant="outline" aria-pressed={selectedDate === date}
            className={cn("shrink-0", filterPillClass(selectedDate === date))} onClick={() => setDateSelection({ cutoffKey, date })}>
            {date ? displayDate(date) : "All days"} <span className="text-xs tabular-nums text-stone-500">{count}</span>
          </Button>
        ))}
      </div>
      {days.length === 0 && <PayrollEmpty>No attendance for this cutoff. Import the raw punches or add a manual entry.</PayrollEmpty>}
      {days.length > 0 && filtered.length === 0 && <PayrollEmpty>No attendance rows match these filters.</PayrollEmpty>}
      {filtered.length > 0 && <Table className="min-w-[1250px] [&_td:first-child]:pl-5 [&_th:first-child]:pl-5">
        <TableHeader className="bg-stone-50">
          <TableRow>{columns.map((heading) => <TableHead key={heading} scope="col">{heading}</TableHead>)}</TableRow>
        </TableHeader>
        {view === "Flat" ? <TableBody>{filtered.map((day) => renderDay(day))}</TableBody> : groupRows(filtered, view).map(({ key, rows }) => {
          const groupKey = `${view}/${key}`;
          const title = view === "By Date" ? displayDate(key) : rows[0].employeeName;
          const expanded = !collapsed[groupKey];
          return (
            <TableBody key={groupKey}>
              <TableRow className="bg-stone-100/80">
                <TableHead colSpan={columns.length} scope="rowgroup">
                  <Button type="button" size="sm" variant="ghost" aria-expanded={expanded} className="gap-2 px-0 text-left" onClick={() => setCollapsed((previous) => ({ ...previous, [groupKey]: expanded }))}>
                    <ChevronDown aria-hidden="true" className={cn("transition-transform", !expanded && "-rotate-90")} />
                    <span className="font-semibold">{title}</span><span className="text-xs font-normal text-stone-600">{groupSummary(rows, view)}</span>
                  </Button>
                </TableHead>
              </TableRow>
              {rows.map((day) => renderDay(day, !expanded))}
            </TableBody>
          );
        })}
      </Table>}
    </>
  );
}
