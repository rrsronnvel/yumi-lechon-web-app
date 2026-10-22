import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export interface DefrostRosterItemDto {
  id: number;
  orderId: number;
  orderReference: string;
  itemCategoryId: number;
  weightCategory: string;
  categoryName?: string;
  weightRange?: string;
  minimumWeightKg?: number;
  maximumWeightKg?: number;
  quantity: number;
  tahiStartTime: string;
  targetDeliveryTime: string;
  riderDepartureTime?: string | null;
  customerName: string;
  facebookName?: string | null;
  eventType?: string | null;
  landmark?: string | null;
  deliveryAddress: string;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  isTrustedCustomer: boolean;
  isRushDefrost: boolean;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
}

export interface PendingConfirmationItemDto {
  id: number;
  orderId: number;
  orderReference: string;
  customerName: string;
  facebookName?: string | null;
  contactNumber: string;
  phoneNumber?: string;
  targetDeliveryTime: string;
  grandTotal: number;
  totalAmount?: number;
  balanceDue: number;
  itemsSummary: string;
}

export const useDefrostRosterQuery = () => {
  return useQuery<DefrostRosterItemDto[]>({
    queryKey: ['dashboard', 'roster'],
    queryFn: async () => {
      const response = await apiClient.get<DefrostRosterItemDto[]>('/dashboard/roster');
      return response.data;
    },
    staleTime: 1000 * 30,
  });
};

export const usePendingConfirmationsQuery = () => {
  return useQuery<PendingConfirmationItemDto[]>({
    queryKey: ['dashboard', 'pending-confirmations'],
    queryFn: async () => {
      const response = await apiClient.get<PendingConfirmationItemDto[]>('/dashboard/pending-confirmations');
      return response.data;
    },
    staleTime: 1000 * 30,
  });
};
