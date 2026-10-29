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
  source?: string;
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
  source?: string;
  contactNumber: string;
  phoneNumber?: string;
  targetDeliveryTime: string;
  grandTotal: number;
  totalAmount?: number;
  balanceDue: number;
  itemsSummary: string;
}

export interface PendingOwnerConfirmationDto {
  id: number;
  orderId: number;
  orderReference: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  targetDeliveryTime?: string | null;
  itemsSummary: string;
  freebiesSummary?: string | null;
  freebiesConfigJson?: string | null;
  deliveryFee: number;
  grandTotal: number;
  downpayment: number;
  downpaymentMethod: string;
  createdBy: string;
  createdAt: string;
  isOwnerConfirmed: boolean;
  ownerConfirmedAt?: string | null;
  ownerConfirmedBy?: string | null;
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

export const usePendingOwnerConfirmationsQuery = () => {
  return useQuery<PendingOwnerConfirmationDto[]>({
    queryKey: ['dashboard', 'pending-owner-confirmations'],
    queryFn: async () => {
      const response = await apiClient.get<PendingOwnerConfirmationDto[]>(
        '/dashboard/pending-owner-confirmations'
      );
      return response.data;
    },
    staleTime: 1000 * 30,
  });
};
