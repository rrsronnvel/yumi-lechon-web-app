import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

// 1. TypeScript Contracts (Matching your .NET DTO models)
export interface PendingConfirmationDto {
  id: number;
  orderReference?: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  targetDeliveryTime: string;
  phoneNumber: string;
  totalAmount: number;
}

export interface DeliveryVerificationDto {
  id: number;
  orderReference?: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  deliveryAddress: string;
  landmark?: string | null;
  phoneNumber: string;
  targetDeliveryTime: string;
}

export interface DefrostRosterDto {
  id: number;
  orderId: number;
  orderReference?: string;
  weightCategory: string;
  categoryName?: string;
  weightRange?: string;
  minimumWeightKg?: number;
  maximumWeightKg?: number;
  quantity: number;
  tahiStartTime: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  targetDeliveryTime: string;
  riderDepartureTime?: string | null;
  isTrustedCustomer: boolean;
  deliveryAddress: string;
  landmark?: string | null;
  fulfillment?: number;
  grandTotal?: number;
  downpayment?: number;
  balanceDue?: number;
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

// 2. Hook #1: The Downpayment Chase List
export function usePendingConfirmations() {
  return useQuery<PendingConfirmationDto[]>({
    queryKey: ['dashboard', 'pending-confirmations'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/tasks/pending-confirmations');
      return response.data;
    },
  });
}

// 3. Hook #2: The Human-Error Double-Check List
export function useDeliveryVerifications() {
  return useQuery<DeliveryVerificationDto[]>({
    queryKey: ['dashboard', 'delivery-verifications'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/tasks/delivery-verifications');
      return response.data;
    },
  });
}

// 4. Hook #3: The Tonight's Freezer Roster
export function useDefrostRoster() {
  return useQuery<DefrostRosterDto[]>({
    queryKey: ['dashboard', 'defrost-roster'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/tasks/defrost-roster');
      return response.data;
    },
  });
}

export function usePendingOwnerConfirmations() {
  return useQuery<PendingOwnerConfirmationDto[]>({
    queryKey: ['dashboard', 'pending-owner-confirmations'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/pending-owner-confirmations');
      return response.data;
    },
  });
}

export function useConfirmOwnerOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.post(`/orders/${orderId}/confirm-owner`);
      return response.data;
    },
    onSuccess: async (_data, orderId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order', orderId] }),
      ]);
    },
  });
}

export interface RenegotiationTask {
  orderId: number;
  orderReference?: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  targetDeliveryTime: string;
  priceGap: number;
}

export const useRenegotiationTasks = () => {
  return useQuery<RenegotiationTask[]>({
    queryKey: ['dashboard', 'renegotiations'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/tasks/renegotiations');
      return response.data;
    },
  });
};
