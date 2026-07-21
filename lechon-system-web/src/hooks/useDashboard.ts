import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient'; // Adjust path if your client lives elsewhere

// 1. TypeScript Contracts (Matching your .NET DTO models)
export interface PendingConfirmationDto {
  id: number;
  customerName: string;
  targetDeliveryTime: string;
  phoneNumber: string;
  totalAmount: number;
}

export interface DeliveryVerificationDto {
  id: number;
  customerName: string;
  deliveryAddress: string;
  phoneNumber: string;
  targetDeliveryTime: string;
}

export interface DefrostRosterDto {
  id: number;
  weightCategory: string;
  quantity: number;
  tahiStartTime: string;
  // 🚀 NEW FIELDS
  customerName: string;
  targetDeliveryTime: string;
  isTrustedCustomer: boolean;
  deliveryAddress: string;
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


export interface RenegotiationTask {
  orderId: number;
  customerName: string;
  targetDeliveryTime: string;
  priceGap: number;
}

// 2. Build the fetcher hook
export const useRenegotiationTasks = () => {
  return useQuery<RenegotiationTask[]>({
    queryKey: ['dashboard', 'renegotiations'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/tasks/renegotiations');
      return response.data;
    },
  });
};