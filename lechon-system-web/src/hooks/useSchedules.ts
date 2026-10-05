/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export interface RoastingScheduleItem {
  id: number;
  orderItemId?: number;
  orderId?: number;
  customerName?: string;
  size?: string;
  weight?: string;
  targetDeliveryTime: string;
  tahiStartTime: string;
  salangStartTime: string;
  packagingStartTime: string;
  location?: string;
  remarks?: string;
  addOns?: string;
  price?: number;
  deliveryFee?: number;
  lechonFee?: number;
  downpayment?: number;
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
      return data.sort((a, b) => {
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