import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import type { OrderDetailsDto } from './useOrders';

export interface Rider {
  id: number;
  fullName: string;
  phoneNumber: string;
  isActive: boolean;
}

export const useRiders = () =>
  useQuery<Rider[]>({
    queryKey: ['riders'],
    queryFn: async () => {
      const response = await apiClient.get<Rider[]>('/riders');
      return response.data;
    },
  });

export const useAssignRiderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      orderIds: number[];
      riderName: string;
      vehicleType?: string;
    }) => {
      const response = await apiClient.post('/logistics/assign-rider', {
        ...payload,
        vehicleType: payload.vehicleType || 'Motorcycle',
      });
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['riders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order'] }),
        queryClient.invalidateQueries({ queryKey: ['manifest'] }),
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-sheets'] }),
        queryClient.invalidateQueries({ queryKey: ['logistics'] }),
      ]);
    },
  });
};

export const useAssignOrderRidersMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, ...payload }: {
      orderId: number;
      riderName: string;
      supportRiderName: string | null;
      supportRiderFee?: number;
      supportRiderHeads?: number;
    }) => (await apiClient.put<OrderDetailsDto>(`/orders/${orderId}/riders`, payload)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['riders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order'] }),
        queryClient.invalidateQueries({ queryKey: ['manifest'] }),
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-sheets'] }),
        queryClient.invalidateQueries({ queryKey: ['logistics'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
};
