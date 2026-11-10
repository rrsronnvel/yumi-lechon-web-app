/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface FreebieItemSummaryDto {
  total: number;
  freebies: number;
  paidAddOns: number;
  paluto: number;
}

export interface SarsaSummaryDto extends FreebieItemSummaryDto {
  wholeFreebies: number;
  bellyFreebies: number;
  noFreebiesSarsaGuaranteed: number;
  guaranteedSarsa?: number;
}

export interface DinuguanSummaryDto extends FreebieItemSummaryDto {
  excludedRawInnardsOrders: number;
  excludedRawInnards?: number;
}

export interface CokeSummaryDto extends FreebieItemSummaryDto {
  bellySwaps: number;
  swaps?: number;
}

export interface RawInnardsSummaryDto {
  total: number;
  bags: number;
  freebies: number;
  paidAddOns: number;
  paluto: number;
}

export interface FreebiesPrepSummaryDto {
  sarsa: SarsaSummaryDto;
  pancit: FreebieItemSummaryDto;
  palabok: FreebieItemSummaryDto;
  spaghetti: FreebieItemSummaryDto;
  dinuguan: DinuguanSummaryDto;
  puto: FreebieItemSummaryDto;
  coke15L: CokeSummaryDto;
  rawInnardsHilaw: RawInnardsSummaryDto;
}

export interface PackItemPillDto {
  itemName: string;
  quantity: number;
  badgeType: "Freebie" | "PaidAddOn" | "Paluto" | "Special" | "NoFreebies" | string;
  label: string;
}

export interface FreebiePrepRosterRowDto {
  id: string;
  rowType: "Order" | "Paluto" | string;
  orderId?: number | null;
  prepRequestId?: number | null;
  isPrepRequest: boolean;
  orderRef: string;
  orderReference?: string;
  recipient: string;
  customerName?: string | null;
  facebookName?: string | null;
  typeItem: string;
  category?: string | null;
  fulfillmentType: string;
  routeDisplay: string;
  riderName?: string | null;
  timeNeeded?: string | null;
  timeNeededDisplay: string;
  isTimeTbd: boolean;
  isNoFreebies: boolean;
  isRawInnards: boolean;
  hasBellyCokeSwap: boolean;
  freebiesSummary?: string | null;
  checklistPills: PackItemPillDto[];
  remarks: string;
  createdBy?: string | null;
}

export interface KitchenPrepRequestDto {
  id: number;
  targetDate: string;
  targetTime: string;
  targetTimeDisplay: string;
  category: string;
  recipientOrLabel: string;
  itemsJson: string;
  items: Record<string, number>;
  remarks?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateKitchenPrepRequestDto {
  targetDate: string;
  targetTime: string;
  category: string;
  recipientOrLabel: string;
  items?: Record<string, number>;
  itemsJson?: string;
  remarks?: string | null;
  createdBy?: string | null;
}

export interface FreebiesPrepResponseDto {
  targetDate: string;
  formattedDate: string;
  summary: FreebiesPrepSummaryDto;
  roster: FreebiePrepRosterRowDto[];
  prepRequests: KitchenPrepRequestDto[];
}

// Aliases for convenience
export type FreebieItemSummary = FreebieItemSummaryDto;
export type SarsaSummary = SarsaSummaryDto;
export type DinuguanSummary = DinuguanSummaryDto;
export type CokeSummary = CokeSummaryDto;
export type RawInnardsSummary = RawInnardsSummaryDto;
export type FreebiesPrepSummary = FreebiesPrepSummaryDto;
export type PackItemPill = PackItemPillDto;
export type FreebiePrepRosterRow = FreebiePrepRosterRowDto;
export type KitchenPrepRequest = KitchenPrepRequestDto;
export type CreateKitchenPrepRequestPayload = CreateKitchenPrepRequestDto;
export type FreebiesPrepResponse = FreebiesPrepResponseDto;

/**
 * Fetches the daily freebies prep summary and chronological packing roster.
 * GET /api/schedules/freebies-prep?date=YYYY-MM-DD
 */
export function useFreebiesPrep(targetDate?: string) {
  return useQuery<FreebiesPrepResponseDto>({
    queryKey: ["schedules", "freebies-prep", targetDate],
    queryFn: async () => {
      const response = await apiClient.get("/schedules/freebies-prep", {
        params: targetDate ? { date: targetDate } : undefined,
      });
      return response.data as FreebiesPrepResponseDto;
    },
    enabled: !!targetDate,
  });
}

/**
 * Creates a new Store Paluto / Extra Kitchen Prep request.
 * POST /api/schedules/prep-requests
 */
export function useCreatePrepRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateKitchenPrepRequestDto) => {
      const response = await apiClient.post("/schedules/prep-requests", payload);
      return response.data as KitchenPrepRequestDto;
    },
    onSuccess: (_, variables) => {
      const date = variables.targetDate;
      if (date) {
        queryClient.invalidateQueries({ queryKey: ["schedules", "freebies-prep", date] });
        queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets", date] });
      }
      queryClient.invalidateQueries({ queryKey: ["schedules", "freebies-prep"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

/**
 * Deletes an existing Store Paluto request by ID.
 * DELETE /api/schedules/prep-requests/{id}
 */
export function useDeletePrepRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/schedules/prep-requests/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules", "freebies-prep"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}
