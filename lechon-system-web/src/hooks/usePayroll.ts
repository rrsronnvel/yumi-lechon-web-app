import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/services/apiClient";
import type { ExpenseRecordDto } from "./useExpenses";

export const employeeRoles = ["Lechonero", "Prep", "Kitchen", "Cashier", "Helper"] as const;
export const incentiveTiers = ["None", "Leader", "Assistant", "Newbie"] as const;
export type EmployeeRole = (typeof employeeRoles)[number];
export type IncentiveTier = (typeof incentiveTiers)[number];
export type PayrollRange = { startDate: string; endDate: string };
export type PayrollCycle = "Weekly" | "SemiMonthly" | "Custom";
export type PayrollCutoff = PayrollRange & { cycleType: PayrollCycle };

export interface EmployeeInput {
  biometricUserId: number;
  fullName: string;
  role: EmployeeRole;
  dailyRate: number;
  isIncentiveEligible: boolean;
  isActive: boolean;
  incentiveTier: IncentiveTier;
  incentiveWeight: number;
  hasMilestoneBonus: boolean;
  defaultShiftStartTime: string | null;
}

export interface PayrollEmployee extends EmployeeInput {
  id: number;
  unpaidValeBalance: number;
}

export interface PayrollSettings {
  roastQuota: number;
  roastBonusPerExcess: number;
  belliesPerWhole: number;
  incentiveSplitMode: "SharedTeam";
  enablePartihan: boolean;
  partihanRatePerLechon: number;
  tiktikDeductionPerLechon: number;
  enableMilestoneBonus: boolean;
  milestoneUnitLechons: number;
  milestoneBonusAmount: number;
  standardWorkHoursPerDay: number;
  overtimeMultiplier: number;
  regularShiftTotalHours: number;
  unpaidOtBufferHours: number;
  minHoursForPaidOt: number;
  enableHolidayPay: boolean;
  specialHolidayMultiplier: number;
  regularHolidayMultiplier: number;
  enableLateDeduction: boolean;
  lateGraceMinutes: number;
  latePenaltyAmount: number;
  lateTier1MaxMinutes: number;
  lateTier1Penalty: number;
  lateTier2MaxMinutes: number;
  lateTier2Penalty: number;
  lateTier3Penalty: number;
  enableValeSystem: boolean;
  valeAllowedDayOfWeek: "Wednesday" | "Any";
  enforceValeEarnedCap: boolean;
  autoDeductValeOnPayroll: boolean;
  syncToExpensesOnFinalize: boolean;
}

export type DayType = "Regular" | "SpecialHoliday" | "RegularHoliday";
export interface PayrollHoliday {
  holidayDate: string;
  name: string;
  holidayType: Exclude<DayType, "Regular">;
  isActive: boolean;
}

export interface AttendanceInput {
  timeIn: string | null;
  timeOut: string | null;
  dayCredit: number;
  overtimePay?: number | null;
  isReviewed: boolean;
  notes: string | null;
  overtimeHours?: number;
  scheduledStartTime?: string | null;
  useEmployeeShiftStart?: boolean;
  dayType?: DayType | "Auto";
  isLateExcused?: boolean;
  isOvertimePayOverridden?: boolean;
}

export interface AttendanceDay extends AttendanceInput {
  id: number;
  employeeId: number;
  employeeName: string;
  workDate: string;
  totalHours: number;
  isOvernightShift: boolean;
  exceptionFlag: "None" | "MissingPunch" | "ShortShift" | "LongShift";
  isManuallyOverridden: boolean;
  updatedBy: string | null;
  overtimeHours: number;
  overtimePay: number;
  suggestedOvertimeHours: number;
  overtimeStatus: "None" | "Pending" | "Approved" | "Rejected";
  overtimeApprovedBy: string | null;
  overtimeApprovedAt: string | null;
  pendingOvertimePayOverride: number | null;
  dayType: DayType;
  dayTypeOverride: DayType | null;
  holidayPremiumPay: number;
  scheduledStartTime: string | null;
  lateMinutes: number;
  lateDeduction: number;
  isLateExcused: boolean;
  isOvertimePayOverridden: boolean;
  dailyRate: number;
}

export interface OvertimeDecisionInput {
  decision: "Approve" | "Reject" | "Pending";
  overtimeHours?: number;
  overtimePayOverride?: number;
  useCalculatedPay?: boolean;
}

export interface UnmappedBiometricUser {
  biometricUserId: number;
  biometricNameSnapshot: string | null;
  punchCount: number;
}

interface ImportBatch {
  id: number;
  fileName: string;
  periodStart: string;
  periodEnd: string;
  punchesImported: number;
  duplicatesSkipped: number;
  unmappedUserCount: number;
  importedBy: string;
  importedAt: string;
}

interface AttendanceRangeResult {
  days: AttendanceDay[];
  unmappedUsers: UnmappedBiometricUser[];
  recentImportBatches: ImportBatch[];
}

interface ImportResult {
  punchesImported: number;
  duplicatesSkipped: number;
  batches: ImportBatch[];
  unmappedUsers: UnmappedBiometricUser[];
}

type ManualAttendance = { employeeId: number; workDate: string; attendance: AttendanceInput };

export type RoastCounts = { productionDate: string; wholeLechonCount: number; bellyCount: number };
export interface RoastAllocationInput {
  employeeId: number;
  partihanAmount: number;
  milestoneBonusAmount: number;
}
export interface RoastAllocation extends RoastAllocationInput {
  employeeName: string;
  dayCredit: number;
  incentiveTier: IncentiveTier;
  weightSnapshot: number;
  totalIncentiveAmount: number;
  isManualOverride: boolean;
}
export type RoastMemberRole = "Roaster" | "Tiktik";
export interface RoastTeamMemberInput {
  employeeId: number;
  memberRole: RoastMemberRole;
  allocatedAmountOverride?: number;
  resetOverride?: boolean;
}
export interface RoastTeamInput {
  id?: number;
  teamName: string;
  wholeLechonCount: number;
  bellyCount: number;
  tiktikDeductionAmount: number | null;
  tiktikRatePerLechon?: number;
  members: RoastTeamMemberInput[];
}
export interface RoastTeamMember {
  employeeId: number;
  employeeName: string;
  memberRole: RoastMemberRole;
  dayCredit: number;
  incentiveTier: IncentiveTier;
  weightSnapshot: number;
  allocatedAmount: number;
  isManualOverride: boolean;
  allocatedAmountOverride: number | null;
}
export interface RoastTeam extends Omit<RoastTeamInput, "id" | "members" | "tiktikDeductionAmount" | "tiktikRatePerLechon"> {
  id: number;
  equivalentLechons: number;
  grossPartihanPool: number;
  tiktikDeductionAmount: number;
  netPartihanPool: number;
  externalTiktikAmount: number;
  tiktikRatePerLechonSnapshot: number;
  isTiktikDeductionOverridden: boolean;
  members: RoastTeamMember[];
}
export interface RoastTeamCandidate {
  employeeId: number;
  employeeName: string;
  role: EmployeeRole;
  incentiveTier: IncentiveTier;
  incentiveWeight: number;
  dayCredit: number;
  hasMilestoneBonus: boolean;
}
interface LastRoastTeams {
  productionDate: string | null;
  teams: {
    teamName: string;
    tiktikRatePerLechon: number;
    members: Pick<RoastTeamMemberInput, "employeeId" | "memberRole">[];
  }[];
}
export interface RoastProduction extends RoastCounts {
  belliesPerWholeSnapshot: number;
  quotaSnapshot: number;
  bonusPerExcessSnapshot: number;
  equivalentLechons: number;
  totalBonusPool: number;
  isSaved: boolean;
  shares: { employeeId: number; employeeName: string; dayCredit: number; share: number }[];
  usesDualIncentives: boolean;
  partihanRatePerLechonSnapshot: number;
  partihanPool: number;
  milestoneStepSnapshot: number;
  milestoneBonusAmountSnapshot: number;
  milestonePerPerson: number;
  allocations: RoastAllocation[];
  partihanEnabledSnapshot: boolean;
  milestoneBonusEnabledSnapshot: boolean;
  teams: RoastTeam[];
  teamCandidates: RoastTeamCandidate[];
  tiktikDeductionPerLechon: number;
}

export interface ValeInput {
  employeeId: number;
  transactionDate: string;
  type: "Disbursement" | "CashRepayment";
  amount: number;
  remarks: string | null;
  overridePolicy?: boolean;
}

export interface ValeEntry extends Omit<ValeInput, "type"> {
  id: number;
  employeeName: string;
  type: ValeInput["type"] | "PayrollDeduction";
  payrollPeriodId: number | null;
  recordedBy: string;
  isVoided: boolean;
  voidedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface ValeEmployee extends PayrollEmployee {
  currentWeekEarnedSoFar: number;
  maxAllowedValeNow: number;
}

interface ValeSummary {
  employees: ValeEmployee[];
  entries: ValeEntry[];
  asOf: string;
  enableValeSystem: boolean;
  valeAllowedDayOfWeek: "Wednesday" | "Any";
  enforceValeEarnedCap: boolean;
}
interface ValeVoidResult {
  employee: ValeEmployee;
  entry: ValeEntry;
}

export interface PayrollItemInput {
  otherBonus: number;
  otherBonusRemarks: string | null;
  valeDeducted: number;
  otherDeduction: number;
  otherDeductionRemarks: string | null;
  isValeDeductionManuallyOverridden?: boolean;
}

export interface PayrollItem extends PayrollItemInput {
  id: number;
  employeeId: number;
  employeeName: string;
  daysWorked: number;
  dailyRateSnapshot: number;
  basePay: number;
  overtimePay: number;
  roastingIncentivePay: number;
  valeBalanceBefore: number;
  valeBalanceAfter: number;
  netPay: number;
  holidayPremiumPay: number;
  lateDeduction: number;
  partihanIncentivePay: number;
  milestoneIncentivePay: number;
  isValeDeductionManuallyOverridden: boolean;
}

export interface PayrollPeriod extends PayrollCutoff {
  id: number;
  payDate: string;
  status: "Draft" | "Finalized";
  totalNetPay: number;
  finalizedBy: string | null;
  finalizedAt: string | null;
  totalLaborExpense: number;
  syncedExpenseId: number | null;
}

export interface PayrollDetail {
  period: PayrollPeriod;
  items: PayrollItem[];
  syncedExpense?: ExpenseRecordDto | null;
}

type PayrollArea = "employees" | "settings" | "holidays" | "attendance" | "roast-production" | "vale" | "periods" | "preview";
const ledgerQueryKeys = [["expenses"], ["reports"], ["dashboard"]] as const;

function usePayrollScope() {
  const { apiBaseUrl, user } = useAuth();
  return ["payroll", apiBaseUrl, user?.username] as const;
}

function usePayrollQuery<T>(area: Exclude<PayrollArea, "preview">, params?: PayrollRange | { asOf?: string }) {
  const scope = usePayrollScope();
  return useQuery({
    queryKey: [...scope, area, params],
    queryFn: async ({ signal }) => (await apiClient.get<T>(`/payroll/${area}`, { params, signal })).data,
  });
}

export function payrollError(error: unknown) {
  if (isAxiosError<{ message?: string; title?: string }>(error)) {
    if (error.response?.status === 413) return "The export is too large. Upload up to 16 MB at a time.";
    return error.response?.data?.message ?? error.response?.data?.title ?? error.message;
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function usePayrollMutation<T, V>(
  mutationFn: (value: V) => Promise<T>,
  invalidate: PayrollArea[],
  success: string | ((result: T) => string),
  updateCache?: (result: T, setPreview: (detail: PayrollDetail) => void) => void,
  invalidateLedger = false,
) {
  const scope = usePayrollScope();
  const cache = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      updateCache?.(result, (detail) => {
        const { startDate, endDate } = detail.period;
        cache.setQueryData([...scope, "preview", { startDate, endDate }], detail);
      });
      toast.success(typeof success === "function" ? success(result) : success);
      const keys = invalidateLedger ? [scope, ...ledgerQueryKeys] : invalidate.map((area) => [...scope, area]);
      await Promise.all(keys.map((queryKey) => cache.invalidateQueries({ queryKey })));
    },
    onError: (error) => toast.error(payrollError(error)),
  });
}

export function usePayrollEmployees() {
  return usePayrollQuery<PayrollEmployee[]>("employees");
}

export function useSavePayrollEmployeeMutation() {
  return usePayrollMutation(async ({ id, input }: { id?: number; input: EmployeeInput }) =>
    id ? (await apiClient.put<PayrollEmployee>(`/payroll/employees/${id}`, input)).data
      : (await apiClient.post<PayrollEmployee>("/payroll/employees", input)).data,
  ["employees", "attendance", "roast-production", "vale", "preview"], "Employee saved.");
}

export function useSetPayrollEmployeeStatusMutation() {
  return usePayrollMutation(async ({ id, isActive }: { id: number; isActive: boolean }) =>
    (await apiClient.patch(`/payroll/employees/${id}/status`, { isActive })).data,
  ["employees", "roast-production", "vale", "preview"], "Employee status saved.");
}

export function usePayrollSettings() {
  return usePayrollQuery<PayrollSettings>("settings");
}

export function useSavePayrollSettingsMutation() {
  return usePayrollMutation(async (input: PayrollSettings) =>
    (await apiClient.put<PayrollSettings>("/payroll/settings", input)).data,
  ["settings", "attendance", "roast-production", "vale", "preview"], "Payroll policies saved.");
}

export function usePayrollHolidays() {
  return usePayrollQuery<PayrollHoliday[]>("holidays");
}

export function useSavePayrollHolidayMutation() {
  return usePayrollMutation(async (input: PayrollHoliday) =>
    (await apiClient.put<PayrollHoliday>("/payroll/holidays", input)).data,
  ["holidays", "attendance", "preview"], "Holiday saved.");
}

export function useAttendanceRange(range: PayrollRange) {
  return usePayrollQuery<AttendanceRangeResult>("attendance", range);
}

export function useImportBiometricsMutation() {
  return usePayrollMutation(async (files: File[]) => {
    const data = new FormData();
    for (const file of files) data.append("files", file);
    return (await apiClient.post<ImportResult>("/payroll/attendance/import", data, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  }, ["attendance", "roast-production", "vale", "preview"],
  ({ punchesImported, duplicatesSkipped }) => `${punchesImported} new punches imported. ${duplicatesSkipped} duplicates skipped.`);
}

export function useUpdateAttendanceMutation() {
  return usePayrollMutation(async ({ id, input }: { id: number; input: AttendanceInput }) =>
    (await apiClient.put<AttendanceDay>(`/payroll/attendance/${id}`, input)).data,
  ["attendance", "roast-production", "vale", "preview"], "Attendance saved.");
}

export function useDecideOvertimeMutation() {
  return usePayrollMutation(async ({ id, input }: { id: number; input: OvertimeDecisionInput }) =>
    (await apiClient.post<AttendanceDay>(`/payroll/attendance/${id}/overtime-decision`, input)).data,
  ["attendance", "preview"], (day) => day.overtimeStatus === "Approved" ? "Overtime approved."
    : day.overtimeStatus === "Rejected" ? "Overtime rejected." : "Overtime filed for approval.");
}

export function useManualAttendanceMutation() {
  return usePayrollMutation(async (input: ManualAttendance) =>
    (await apiClient.post<AttendanceDay>("/payroll/attendance/manual", input)).data,
  ["attendance", "roast-production", "vale", "preview"], "Manual attendance recorded.");
}

export function useRoastProduction(range: PayrollRange) {
  return usePayrollQuery<RoastProduction[]>("roast-production", range);
}

export function useSaveRoastProductionMutation() {
  return usePayrollMutation(async (input: RoastCounts[]) =>
    (await apiClient.put<RoastProduction[]>("/payroll/roast-production", input)).data,
  ["roast-production", "preview"], "Roasting production saved.");
}

export function usePrefillRoastMutation() {
  return usePayrollMutation(async (range: PayrollRange) =>
    (await apiClient.post<RoastCounts[]>("/payroll/roast-production/prefill", null, { params: range })).data,
  [], "Order counts loaded. Review and save production.");
}

export function useSaveRoastAllocationsMutation() {
  return usePayrollMutation(async ({ date, allocations, reset = false }: { date: string; allocations: RoastAllocationInput[]; reset?: boolean }) =>
    (await apiClient.put<RoastProduction>(`/payroll/roast-production/${date}/allocations`, { allocations, reset })).data,
  ["roast-production", "preview"], "Roaster allocations saved.");
}

export function useSaveRoastTeamsMutation() {
  return usePayrollMutation(async ({ date, teams }: { date: string; teams: RoastTeamInput[] }) =>
    (await apiClient.put<RoastProduction>(`/payroll/roast-production/${date}/teams`, { teams })).data,
  ["roast-production", "preview"], "Roasting teams saved.");
}

export function useCopyLastRoastTeamsMutation() {
  return useMutation({
    mutationFn: async (beforeDate: string) =>
      (await apiClient.get<LastRoastTeams>("/payroll/roast-production/last-teams", { params: { beforeDate } })).data,
    onError: (error) => toast.error(payrollError(error)),
  });
}

export function useValeSummary(asOf?: string) {
  return usePayrollQuery<ValeSummary>("vale", { asOf });
}

export function useRecordValeMutation() {
  return usePayrollMutation(async (input: ValeInput) =>
    (await apiClient.post<ValeEntry>("/payroll/vale", input)).data,
  ["vale", "employees", "preview"], (entry) => entry.type === "CashRepayment" ? "Cash repayment recorded." : "Vale recorded.");
}

export function useVoidValeMutation() {
  const scope = usePayrollScope();
  const cache = useQueryClient();
  return usePayrollMutation(async ({ id, reason }: { id: number; reason: string }) =>
    (await apiClient.post<ValeVoidResult>(`/payroll/vale/${id}/void`, { reason })).data,
  ["vale", "employees", "preview"], "Vale entry voided.", ({ employee, entry }) => {
    cache.setQueryData<ValeSummary>([...scope, "vale", { asOf: undefined }], (current) => current && ({
      ...current,
      employees: current.employees.map((row) => row.id === employee.id ? employee : row),
      entries: current.entries.map((row) => row.id === entry.id ? entry : row),
    }));
  });
}

export function usePayrollPeriods() {
  return usePayrollQuery<PayrollPeriod[]>("periods");
}

export function usePayrollPeriodPreview(range: PayrollCutoff) {
  const scope = usePayrollScope();
  const cache = useQueryClient();
  const { startDate, endDate } = range;
  return useQuery({
    queryKey: [...scope, "preview", { startDate, endDate }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.post<PayrollDetail>("/payroll/periods/preview", range, { signal });
      void cache.invalidateQueries({ queryKey: [...scope, "periods"] });
      return data;
    },
    retry: false,
  });
}

export function useUpdatePayrollItemMutation() {
  return usePayrollMutation(async ({ periodId, itemId, input }: { periodId: number; itemId: number; input: PayrollItemInput }) =>
    (await apiClient.put<PayrollDetail>(`/payroll/periods/${periodId}/items/${itemId}`, input)).data,
  ["periods"], "Payroll adjustments saved.", (detail, setPreview) => setPreview(detail));
}

export function useFinalizePayrollMutation() {
  return usePayrollMutation(async ({ periodId, syncToExpenses }: { periodId: number; syncToExpenses: boolean }) =>
    (await apiClient.post<PayrollDetail>(`/payroll/periods/${periodId}/finalize`, { syncToExpenses })).data,
  [], "Payroll finalized and Vale deductions recorded.",
  (detail, setPreview) => setPreview(detail), true);
}

export function useSyncPayrollExpenseMutation() {
  return usePayrollMutation(async (periodId: number) =>
    (await apiClient.post<PayrollDetail>(`/payroll/periods/${periodId}/sync-expense`)).data,
  [], "Labor expense posted to the ledger.", (detail, setPreview) => setPreview(detail), true);
}
