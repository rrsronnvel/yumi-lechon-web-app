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

// Add this new hook to fetch ALL balances
export const useInventoryBalances = () => {
  return useQuery({
    queryKey: ['inventory', 'balances'], 
    queryFn: async () => {
      // CHANGE THIS URL to point to our new math endpoint!
      const response = await apiClient.get('/inventory/balances'); 
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
      // UPDATE THIS: Invalidate BOTH the alerts and the new balances table!
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
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


// 4. The Bank Statement: Fetches the chronological audit ledger
export const useInventoryLedger = () => {
  return useQuery({
    queryKey: ['inventory-ledger'],
    queryFn: async () => {
      // This matches the endpoint we built in the C# Backend task!
      const response = await apiClient.get('/inventory/transactions');
      return response.data;
    },
  });
};