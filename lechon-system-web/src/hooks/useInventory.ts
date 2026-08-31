import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { toast } from 'sonner';

export interface InventoryBalance {
  categoryId: number;
  categoryName: string;
  weightRangeDisplay: string;
  physicalStock: number;
  lockedStock: number;
  availableStock: number;
  minimumSafetyStock: number;
  healthStatus: "Optimal" | "Low Stock" | "Deficit" | string;
}

export interface InventoryAlert {
  itemCategoryId: number;
  categoryName: string;
  currentStock: number;
  minimumSafetyStock: number;
}

export interface InventoryTransaction {
  id: number;
  itemCategoryId: number;
  quantity: number;
  transactionType: string;
  reason?: string;
  referenceId?: number;
  transactionDate: string;
}

// 1. The Camera: Fetches current stock and low-stock warnings
export const useInventoryAlerts = () => {
  return useQuery<InventoryAlert[]>({
    queryKey: ['procurement', 'alerts'],
    queryFn: async () => {
      const response = await apiClient.get('/procurement/alerts');
      return response.data;
    },
  });
};

// 2. Fetch Live Balances calculated via Dual-Stock Forecasting Engine
export const useInventoryBalances = () => {
  return useQuery<InventoryBalance[]>({
    queryKey: ['inventory', 'balances'], 
    queryFn: async () => {
      const response = await apiClient.get('/inventory/balances'); 
      return response.data;
    },
  });
};

// 3. The Override Switch: Manually adjusts stock
export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (adjustmentData: {
      itemCategoryId: number;
      quantity: number;
      transactionType: string;
      reason?: string;
    }) => {
      const response = await apiClient.post('/inventory/transactions', adjustmentData);
      return response.data;
    },
    onSuccess: async () => {
      toast.success("Ledger Adjustment Logged", {
        description: "Inventory balances and audit records have been synchronized.",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['procurement', 'alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        // Backwards compatibility with any legacy keys
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] }),
      ]);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to log inventory adjustment.";
      toast.error("Adjustment Failed", {
        description: message,
      });
    },
  });
};

// 4. The Auto-Order Button: Generates POs for low stock
export const useGeneratePOs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/procurement/generate-po');
      return response.data;
    },
    onSuccess: async () => {
      toast.success("Draft POs Generated", {
        description: "Supplier restock orders have been created.",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['procurement', 'alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
      ]);
    },
    onError: () => {
      toast.error("Failed to generate purchase orders.");
    }
  });
};

// 5. The Bank Statement: Fetches the chronological audit ledger
export const useInventoryLedger = () => {
  return useQuery<InventoryTransaction[]>({
    queryKey: ['inventory', 'transactions'],
    queryFn: async () => {
      const response = await apiClient.get('/inventory/transactions');
      return response.data;
    },
  });
};