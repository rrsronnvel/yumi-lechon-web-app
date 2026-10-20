import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { ItemCategory, ParsedOrderDraftDto } from '../utils/messengerTextParser';

export type { ItemCategory, ParsedOrderDraftDto };

export interface InventoryBalanceDto {
  categoryId: number;
  categoryName: string;
  weightRangeDisplay: string;
  physicalStock: number;
  lockedStock: number;
  availableStock: number;
  minimumSafetyStock: number;
  healthStatus: 'Optimal' | 'Low Stock' | 'Deficit' | string;
}

export interface CreateOrderItemPayload {
  itemCategoryId: number;
  quantity: number;
  price: number;
}

export interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  source: string;
  targetDeliveryTime: string;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  address: string;
  deliveryAddress?: string;
  remarks?: string;
  price: number;
  addOns?: string;
  deliveryFee: number;
  discount: number;
  downpayment: number;
  grandTotal: number;
  totalAmount?: number;
  isTrustedCustomer: boolean;
  items: CreateOrderItemPayload[];
}

export interface ScreenshotAssetInput {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export const useCatalogCategories = () => {
  const query = useQuery<ItemCategory[]>({
    queryKey: ['inventory', 'categories'],
    queryFn: async () => {
      const response = await apiClient.get<ItemCategory[]>('/inventory/categories');
      return response.data;
    },
    staleTime: 1000 * 60,
  });

  const activeCategories = useMemo(
    () => (query.data || []).filter((c) => c.isActive !== false),
    [query.data]
  );

  const roastCategories = useMemo(
    () => activeCategories.filter((c) => c.minimumWeightKg > 0),
    [activeCategories]
  );

  const addOnCategories = useMemo(
    () => activeCategories.filter((c) => c.minimumWeightKg === 0),
    [activeCategories]
  );

  return {
    ...query,
    categories: activeCategories,
    roastCategories,
    addOnCategories,
  };
};

export const useInventoryBalances = () => {
  return useQuery<InventoryBalanceDto[]>({
    queryKey: ['inventory', 'balances'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryBalanceDto[]>('/inventory/balances');
      return response.data;
    },
    staleTime: 1000 * 30,
  });
};

export const useParseScreenshotMutation = () => {
  return useMutation({
    mutationFn: async (imageAsset: ScreenshotAssetInput): Promise<ParsedOrderDraftDto> => {
      const formData = new FormData();
      formData.append(
        'file',
        {
          uri: imageAsset.uri,
          name: imageAsset.fileName || 'messenger-intake.jpg',
          type: imageAsset.mimeType || 'image/jpeg',
        } as unknown as Blob
      );

      const response = await apiClient.post<ParsedOrderDraftDto>(
        '/orders/parse-screenshot',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
        }
      );

      return response.data;
    },
  });
};

export const useCreateOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const response = await apiClient.post('/orders', payload);
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['manifest'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      ]);
    },
  });
};
