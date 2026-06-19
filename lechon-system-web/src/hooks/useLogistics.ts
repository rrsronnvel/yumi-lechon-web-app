import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient'; 

// 1. The Camera (You already have this)
export const useUnassignedOrders = () => {
  return useQuery({
    queryKey: ['unassigned-orders'],
    queryFn: async () => {
      const response = await apiClient.get('/logistics/unassigned'); // Adjust URL to match your C# controller
      return response.data;
    }
  });
};

// 2. The Dispatch Radio (Add this!)
export const useAssignRider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // The instruction manual for sending data
    mutationFn: async (dispatchData: { orderIds: number[], riderName: string, vehicleType: string }) => {
      const response = await apiClient.post('/logistics/assign-rider', dispatchData);
      return response.data;
    },
    // The Magic Refresh: If successful, wipe the old data and fetch a fresh list
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] });
    }
  });
};