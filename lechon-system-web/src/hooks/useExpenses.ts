import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import type { ExpenseCategory, ExpenseCostType } from "@/utils/expenseCategorizer";

export type ExpensePaymentMethod = "Cash" | "GCash" | "Maya" | "Bank Transfer";

export interface ExpenseRecordDto {
  id: number;
  expenseDate: string;
  category: ExpenseCategory;
  costType: ExpenseCostType;
  itemDescription: string;
  quantity: number | null;
  unit: string | null;
  unitCost: number | null;
  computedUnitCost: number | null;
  totalCost: number;
  paymentMethod: ExpensePaymentMethod;
  remarks: string | null;
  encodedBy: string;
  createdAt: string;
}

export interface ExpenseCategorySummaryDto {
  category: ExpenseCategory;
  costType: ExpenseCostType;
  totalCost: number;
  percentageShare: number;
}

export interface ExpenseSummaryDto {
  year: number;
  month: number;
  totalExpensesYtd: number;
  totalDirectCosts: number;
  totalOverhead: number;
  totalOperatingExpenses: number;
  ownerNonOperatingOutflows: number;
  grandTotalOutflow: number;
  categoryBreakdown: ExpenseCategorySummaryDto[];
  grossRevenue: number | null;
  netFoodRevenue: number | null;
  deliveryFeeRevenue: number | null;
  discountTotal: number | null;
  grossProfit: number | null;
  operatingNetProfit: number | null;
  netCashFlowAfterOwnerOutflows: number | null;
}

export interface ExpenseUpsertRequest {
  expenseDate: string;
  category: ExpenseCategory | "";
  itemDescription: string;
  quantity: number | null;
  unit: string | null;
  unitCost: number | null;
  totalCost: number;
  paymentMethod: ExpensePaymentMethod;
  remarks: string | null;
}

export interface ExpenseFilters {
  year: number;
  month: number;
  category?: ExpenseCategory | "All";
  costType?: ExpenseCostType | "All";
  paymentMethod?: ExpensePaymentMethod | "All";
  search?: string;
}

const expenseKeys = {
  all: ["expenses"] as const,
  list: (filters: ExpenseFilters) => ["expenses", "list", filters] as const,
  summary: (year: number, month: number) => ["expenses", "summary", year, month] as const,
};

export function useExpenseRecords(filters: ExpenseFilters, enabled = true) {
  return useQuery<ExpenseRecordDto[]>({
    queryKey: expenseKeys.list(filters),
    queryFn: async () => {
      const response = await apiClient.get<ExpenseRecordDto[]>("/expenses", {
        params: {
          year: filters.year,
          month: filters.month,
          category: filters.category === "All" ? undefined : filters.category,
          costType: filters.costType === "All" ? undefined : filters.costType,
          paymentMethod: filters.paymentMethod === "All" ? undefined : filters.paymentMethod,
          search: filters.search?.trim() || undefined,
        },
      });
      return response.data;
    },
    enabled,
  });
}

export function useExpenseSummary(year: number, month: number) {
  return useQuery<ExpenseSummaryDto>({
    queryKey: expenseKeys.summary(year, month),
    queryFn: async () => {
      const response = await apiClient.get<ExpenseSummaryDto>("/expenses/summary", {
        params: { year, month },
      });
      return response.data;
    },
  });
}

function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expenseKeys.all });
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation<ExpenseRecordDto, Error, ExpenseUpsertRequest>({
    mutationFn: async (payload) => {
      const response = await apiClient.post<ExpenseRecordDto>("/expenses", payload);
      return response.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation<ExpenseRecordDto, Error, { id: number; payload: ExpenseUpsertRequest }>({
    mutationFn: async ({ id, payload }) => {
      const response = await apiClient.put<ExpenseRecordDto>(`/expenses/${id}`, payload);
      return response.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/expenses/${id}`);
    },
    onSuccess: invalidate,
  });
}

export interface AutoReclassifyResult {
  inspectedCount: number;
  updatedCount: number;
  updatedRecords: ExpenseRecordDto[];
}

export function useAutoReclassifyExpenses() {
  const invalidate = useInvalidateExpenses();
  return useMutation<AutoReclassifyResult, Error, { year: number; month: number }>({
    mutationFn: async ({ year, month }) => {
      const response = await apiClient.post<AutoReclassifyResult>(
        "/expenses/auto-reclassify",
        undefined,
        { params: { year, month } },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });
}
