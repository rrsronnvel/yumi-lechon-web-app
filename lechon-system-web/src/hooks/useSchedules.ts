/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export interface RoastingScheduleItem {
  id: number;
  orderItemId?: number;
  orderId?: number;
  orderReference?: string;
  customerName?: string;
  facebookName?: string | null;
  source?: string;
  eventType?: string | null;
  size?: string;
  categoryName?: string;
  weight?: string;
  weightRange?: string;
  minimumWeightKg?: number;
  maximumWeightKg?: number;
  targetDeliveryTime: string;
  riderDepartureTime?: string | null;
  tahiStartTime: string;
  salangStartTime: string;
  packagingStartTime: string;
  location?: string;
  landmark?: string | null;
  remarks?: string;
  freebiesSummary?: string | null;
  freebiesConfigJson?: string | null;
  addOns?: string;
  price?: number;
  lechonPrice?: number;
  addOnsTotal?: number;
  deliveryFee?: number;
  lechonFee?: number;
  downpayment?: number;
  downpaymentMethod?: string;
  grandTotal?: number;
  totalToCollect?: number;
  fulfillment?: number;
  quantity?: number;
  riderName?: string;
  status?: string;
  isManualOverride?: boolean;
  [key: string]: any;
}

export interface OverrideSchedulePayload {
  orderItemId: number;
  tahiStartTime?: string;
  salangStartTime?: string;
  packagingStartTime?: string;
  riderDepartureTime?: string;
  departureTime?: string;
  riderName?: string;
  remarks?: string;
}

export interface DailySheetsResponse {
  targetDate: string;
  formattedDate: string;
  items: RoastingScheduleItem[];
}

export function useDailySheets(targetDate?: string) {
  return useQuery({
    queryKey: ['schedules', 'daily-sheets', targetDate],
    queryFn: async () => {
      const response = await apiClient.get('/schedules/daily-sheets', {
        params: targetDate ? { date: targetDate } : undefined,
      });
      return response.data as DailySheetsResponse;
    },
  });
}

export function useRoastingRoster(date?: string) {
  return useQuery({
    queryKey: ['roster', date],
    queryFn: async () => {
      const response = await apiClient.get('/schedules/roster', {
        params: date ? { date } : undefined,
      });
      return response.data as RoastingScheduleItem[];
    },
  });
}

export const useOverrideScheduleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderItemId, ...data }: OverrideSchedulePayload) => {
      const response = await apiClient.put(`/schedules/items/${orderItemId}/override`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      queryClient.invalidateQueries({ queryKey: ["logistics", "unassigned-orders"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["logistics"] });
    },
  });
};
