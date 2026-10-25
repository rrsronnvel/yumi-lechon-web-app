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
  deliveryFee?: number;
  lechonFee?: number;
  downpayment?: number;
  downpaymentMethod?: string;
  grandTotal?: number;
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

export function useRoastingRoster(date?: string) {
  // Dynamically calculate tomorrow's date if not provided
  let targetDate = date;
  if (!targetDate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = tomorrow.toISOString().split('T')[0];
  }

  return useQuery({
    queryKey: ['roster', targetDate],
    queryFn: async () => {
      const response = await apiClient.get(`/schedules/roster?date=${targetDate}`);
      return response.data as RoastingScheduleItem[];
    },
    select: (data: RoastingScheduleItem[]) => {
      const carcassOnly = (data || []).filter((item) => {
        const minW = Number(item.minimumWeightKg ?? item.minWeight ?? 0);
        const name = (item.size || item.categoryName || "").toLowerCase();
        const isNonCarcass = /(sarsa|sauce|dinuguan|pancit|pansit|palabok|spaghetti|puto|coke|1\.5\s*l)/i.test(name);
        return minW > 0 && !isNonCarcass;
      });
      return carcassOnly.sort((a, b) => {
        const timeA = a.tahiStartTime ? new Date(a.tahiStartTime).getTime() : 0;
        const timeB = b.tahiStartTime ? new Date(b.tahiStartTime).getTime() : 0;
        return timeA - timeB;
      });
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
