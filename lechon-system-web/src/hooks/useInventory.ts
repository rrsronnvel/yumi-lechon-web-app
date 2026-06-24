import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

// 1. The Camera: Fetches current stock and low-stock warnings
export const useInventoryAlerts = () => {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      const response = await apiClient.get('/procurement/alerts');
      return response.data;
    },
  });
};

// 2. The Override Switch: Manually adjusts stock
export const useAdjustStock = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (adjustmentData: unknown) => {
      const response = await apiClient.post('/inventory/transactions', adjustmentData);
      return response.data;
    },
    onSuccess: () => {
      // The Magic Refresh: Silently updates the table behind the scenes
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
  });
};

// 3. The Auto-Order Button: Generates POs for low stock
export const useGeneratePOs = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/procurement/generate-po');
      return response.data;
    },
    onSuccess: () => {
      // The Magic Refresh again!
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
  });
};