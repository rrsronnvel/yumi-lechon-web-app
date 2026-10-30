import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

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
