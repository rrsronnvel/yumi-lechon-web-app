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
    mutationFn: async (dispatchData: { orderIds: number[], riderName: string, vehicleType: string }) => {
      const response = await apiClient.post('/logistics/assign-rider', dispatchData);
      return response.data;
    },
    // The Magic Refresh:
    onSuccess: () => {
      // 1. Clear the current logistics waiting list
      queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] });

      // 2. Clear the Daily Sheets (This updates the Kitchen View & Rider View tabs!)
      queryClient.invalidateQueries({ queryKey: ['schedules', 'daily-sheets'] });

      // 3. Clear the Kitchen Kanban board just to be safe!
      queryClient.invalidateQueries({ queryKey: ['roster'] });

      // 4. Clear Master Directory
      queryClient.invalidateQueries({ queryKey: ['orders', 'directory'] });
    }
  });
};