import { useId, useState } from "react";
import { Flame, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  employeeRoles, incentiveTiers, usePayrollEmployees, useSavePayrollEmployeeMutation, useSetPayrollEmployeeStatusMutation,
  type EmployeeRole, type IncentiveTier, type PayrollEmployee, type UnmappedBiometricUser,
} from "@/hooks/usePayroll";
import { localClock, money, validMoney } from "./payrollDisplay";
import { PayrollPolicySettings } from "./PayrollPolicySettings";
import { PayrollEmpty, PayrollField, PayrollQueryError, PayrollSection, payrollSelect } from "./PayrollUi";

export function PayrollEmployees() {
  const employees = usePayrollEmployees();
  const status = useSetPayrollEmployeeStatusMutation();
  const [editor, setEditor] = useState<{ employee?: PayrollEmployee } | null>(null);

  return (
    <div className="grid gap-4">
      <PayrollSection title="Employee roster" actions={
        <Button type="button" onClick={() => setEditor({})}><Plus /> Add Employee</Button>
      }>
        {employees.isError && <PayrollQueryError error={employees.error} retry={employees.refetch} />}
        {employees.isPending && <PayrollEmpty>Loading employees…</PayrollEmpty>}
        {employees.data?.length === 0 && <PayrollEmpty>Add an employee to link their Deli User ID.</PayrollEmpty>}
        {!!employees.data?.length && (
          <Table className="min-w-[740px] [&_td:first-child]:pl-5 [&_th:first-child]:pl-5">
            <TableHeader className="bg-stone-50">
              <TableRow>{["Deli ID #", "Full name", "Role", "Daily rate", "Lechonero incentive", "Unpaid Vale", "Status", "Actions"].map((heading) => <TableHead key={heading} scope="col">{heading}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {employees.data.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono text-stone-600">#{employee.biometricUserId}</TableCell>
                  <TableCell className="font-semibold">{employee.fullName}</TableCell>
                  <TableCell>{employee.role}</TableCell>
                  <TableCell className="tabular-nums">{money(employee.dailyRate)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {employee.isIncentiveEligible && <Badge className="bg-amber-100 text-amber-950"><Flame /> {employee.incentiveTier === "None" ? "Partihan" : `${employee.incentiveTier} · ${employee.incentiveWeight || 1}`}</Badge>}
                      {employee.hasMilestoneBonus && <Badge className="bg-emerald-50 text-emerald-900">Milestone</Badge>}
                      {!employee.isIncentiveEligible && !employee.hasMilestoneBonus && <span className="text-stone-500">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">{money(employee.unpaidValeBalance)}</TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <Switch checked={employee.isActive} aria-label={`${employee.fullName} active status`} disabled={status.isPending}
                        onCheckedChange={(isActive) => status.mutate({ id: employee.id, isActive })} />
                      {employee.isActive ? "Active" : "Inactive"}
                    </label>
                  </TableCell>
                  <TableCell><Button type="button" variant="outline" size="sm" onClick={() => setEditor({ employee })}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PayrollSection>

      <PayrollPolicySettings />

      {editor && <PayrollEmployeeEditor employee={editor.employee} onClose={() => setEditor(null)} />}
    </div>
  );
}

const tierWeights: Record<IncentiveTier, number> = { None: 0, Leader: 8, Assistant: 5, Newbie: 3 };

const rosterFields = (employee?: PayrollEmployee, unmapped?: UnmappedBiometricUser) => ({
  biometricUserId: String(unmapped?.biometricUserId ?? employee?.biometricUserId ?? ""),
  fullName: employee?.fullName ?? unmapped?.biometricNameSnapshot?.slice(0, 120) ?? "",
  role: employee?.role ?? "Lechonero" as EmployeeRole,
  dailyRate: employee ? String(employee.dailyRate) : "",
  isIncentiveEligible: employee?.isIncentiveEligible ?? true,
  isActive: employee?.isActive ?? true,
  incentiveTier: employee?.incentiveTier ?? "None" as IncentiveTier,
  incentiveWeight: String(employee?.incentiveWeight ?? 0),
  hasMilestoneBonus: employee?.hasMilestoneBonus ?? false,
  defaultShiftStartTime: employee?.defaultShiftStartTime?.slice(0, 5) ?? "",
});

export function PayrollEmployeeEditor({ employee, unmapped, employees = [], onClose }: {
  employee?: PayrollEmployee;
  unmapped?: UnmappedBiometricUser;
  employees?: PayrollEmployee[];
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(employee?.id);
  const [fields, setFields] = useState(() => rosterFields(employee, unmapped));
  const weightHelpId = useId();
  const save = useSavePayrollEmployeeMutation();
  const valid = Number.isInteger(Number(fields.biometricUserId)) && Number(fields.biometricUserId) > 0 &&
    Boolean(fields.fullName.trim()) && validMoney(fields.dailyRate) && validMoney(fields.incentiveWeight) && Number(fields.incentiveWeight) <= 9999.99;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{unmapped ? "Link Deli User ID" : employee ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>{unmapped ? `Deli ID #${unmapped.biometricUserId} has punches ready to link.` : "Set the employee’s Deli ID and payroll details."}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          save.mutate({ id: selectedId, input: {
            ...fields, biometricUserId: Number(fields.biometricUserId), dailyRate: Number(fields.dailyRate),
            incentiveWeight: Number(fields.incentiveWeight), defaultShiftStartTime: localClock(fields.defaultShiftStartTime),
          } }, { onSuccess: onClose });
        }}>
          {unmapped && employees.length > 0 && (
            <PayrollField label="Employee to link">
              <select className={payrollSelect} value={selectedId ?? ""} onChange={(event) => {
                const linked = employees.find((item) => item.id === Number(event.target.value));
                setSelectedId(linked?.id);
                setFields(rosterFields(linked, unmapped));
              }}>
                <option value="">Add a new employee</option>
                {employees.map((item) => <option key={item.id} value={item.id}>{item.fullName} · current Deli ID #{item.biometricUserId}</option>)}
              </select>
            </PayrollField>
          )}
          <PayrollField label="Deli ID #"><Input required type="number" min="1" max="2147483647" value={fields.biometricUserId} readOnly={Boolean(unmapped)} onChange={(event) => setFields({ ...fields, biometricUserId: event.target.value })} /></PayrollField>
          <PayrollField label="Full name"><Input required maxLength={120} value={fields.fullName} onChange={(event) => setFields({ ...fields, fullName: event.target.value })} /></PayrollField>
          <div className="grid grid-cols-2 gap-3">
            <PayrollField label="Role">
              <select className={payrollSelect} value={fields.role} onChange={(event) => {
                const role = event.target.value as EmployeeRole;
                setFields({ ...fields, role, isIncentiveEligible: role === "Lechonero" });
              }}>
                {employeeRoles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </PayrollField>
            <PayrollField label="Daily rate (₱)"><Input required type="number" step="0.01" min="0" value={fields.dailyRate} onChange={(event) => setFields({ ...fields, dailyRate: event.target.value })} /></PayrollField>
          </div>
          <label className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm font-medium">Eligible for the shared incentive <Switch checked={fields.isIncentiveEligible} onCheckedChange={(checked) => setFields({ ...fields, isIncentiveEligible: checked })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <PayrollField label="Incentive tier">
              <select className={payrollSelect} value={fields.incentiveTier} onChange={(event) => {
                const incentiveTier = event.target.value as IncentiveTier;
                setFields({ ...fields, incentiveTier, incentiveWeight: String(tierWeights[incentiveTier]) });
              }}>
                {incentiveTiers.map((tier) => <option key={tier}>{tier}</option>)}
              </select>
            </PayrollField>
            <PayrollField label="Share Weight (Points)"><Input type="number" min="0" max="9999.99" step="0.01" value={fields.incentiveWeight} onChange={(event) => setFields({ ...fields, incentiveWeight: event.target.value })} aria-describedby={weightHelpId} required /></PayrollField>
            <p id={weightHelpId} className="col-span-2 text-xs text-stone-600">Relative Partihan share (e.g., 8 : 5 : 3 splits ₱400 into ₱200 / ₱125 / ₱75 and auto-adjusts if someone is absent).</p>
          </div>
          <label className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm font-medium">Milestone Bonus Eligible (per 10 lechon) <Switch checked={fields.hasMilestoneBonus} onCheckedChange={(checked) => setFields({ ...fields, hasMilestoneBonus: checked })} /></label>
          <PayrollField label="Default shift start time"><Input type="time" value={fields.defaultShiftStartTime} onChange={(event) => setFields({ ...fields, defaultShiftStartTime: event.target.value })} /></PayrollField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : unmapped ? "Link employee" : "Save employee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

