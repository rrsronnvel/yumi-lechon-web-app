/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { toast } from 'sonner';

export interface ItemCategory {
    id: number;
    name: string;
    basePrice: number;
    isActive: boolean;       
    minimumWeightKg: number; 
    maximumWeightKg: number;
    minimumSafetyStock?: number;
    tahiDurationMinutes?: number;  
    salangDurationMinutes?: number; 
}

export interface PriceHistoryLog {
    id: number;
    itemCategoryId: number;
    oldPrice: number;
    newPrice: number;
    delta: number;
    changedBy?: string | null;
    dateChanged: string;
}

export interface CreateCategoryPayload {
    name: string;
    minimumWeightKg: number;
    maximumWeightKg: number;
    basePrice: number;
    minimumSafetyStock: number;
}

export interface UpdateCategoryDetailsPayload {
    categoryId: number;
    name: string;
    minimumWeightKg: number;
    maximumWeightKg: number;
    minimumSafetyStock: number;
}

export interface DeliveryPricingDto {
    baseFare: number;
    ratePerKm: number;
}

// 1. Fetch the live menu categories
export function useMenuCategories() {
    return useQuery<ItemCategory[]>({
        queryKey: ['inventory', 'categories'],
        queryFn: async () => {
            const response = await apiClient.get<ItemCategory[]>('/inventory/categories');
            return response.data;
        },
    });
}

// 2. Query price history log
export function usePriceHistory(categoryId: number | null) {
    return useQuery<PriceHistoryLog[]>({
        queryKey: ['cms', 'price-history', categoryId],
        queryFn: async () => {
            if (categoryId === null) return [];
            const response = await apiClient.get<PriceHistoryLog[]>(`/cms/categories/${categoryId}/price-history`);
            return response.data;
        },
        enabled: categoryId !== null,
    });
}

// 3. Update Category Details (Metadata & Safety Stock)
export function useUpdateCategoryDetails() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ categoryId, ...payload }: UpdateCategoryDetailsPayload) => {
            const response = await apiClient.put(`/cms/categories/${categoryId}/details`, payload);
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Category details updated successfully!");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['cms', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
                queryClient.invalidateQueries({ queryKey: ['procurement', 'alerts'] }),
            ]);
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message || "Failed to update category details.";
            toast.error(msg);
        }
    });
}

// 4. Toggle Category POS Visibility / Active Status
export function useToggleCategoryStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (categoryId: number) => {
            const response = await apiClient.patch<{ isActive: boolean }>(`/cms/categories/${categoryId}/status`);
            return response.data;
        },
        onSuccess: async (data) => {
            toast.success(data?.isActive ? "Category activated!" : "Category hidden from POS!");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['cms', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
            ]);
        },
        onError: () => {
            toast.error("Failed to update category visibility status.");
        }
    });
}

// Backwards-compatible alias
export const useToggleActive = useToggleCategoryStatus;

// 5. Update Menu Item Base Price
export function useUpdatePrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ categoryId, newPrice, adminName = "Owner" }: { categoryId: number; newPrice: number; adminName?: string }) => {
            const response = await apiClient.put(`/cms/categories/${categoryId}/price`, {
                newPrice: newPrice,
                adminName: adminName,
            });
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Menu Price Updated!", {
                description: "The new price is now live. Checking for affected advance orders...",
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['cms', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['cms', 'price-history'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard', 'renegotiations'] }),
            ]);
        },
        onError: () => {
            toast.error("Failed to update price.");
        }
    });
}

// 6. Create brand new menu item
export function useCreateCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateCategoryPayload) => {
            const response = await apiClient.post('/cms/categories', payload);
            return response.data;
        },
        onSuccess: async () => {
            toast.success("New Menu Item Created!", {
                description: "The item is now live and active on the POS.",
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['cms', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
            ]);
        },
        onError: () => {
            toast.error("Failed to create new item. Check your inputs.");
        }
    });
}

// 7. Update kitchen cooking clock profile
export function useUpdateClocks() {
    const queryClient = useQueryClient(); 

    return useMutation({
        mutationFn: async ({ categoryId, tahi, salang }: { categoryId: number; tahi: number; salang: number }) => {
            const response = await apiClient.patch(`/cms/categories/${categoryId}/clocks`, {
                tahiDurationMinutes: tahi,
                salangDurationMinutes: salang
            });
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Clocks Updated!", { description: "All upcoming kitchen schedules just re-adjusted." });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['cms', 'categories'] }),
                queryClient.invalidateQueries({ queryKey: ['schedules'] }),
            ]);
        }
    });
}

// 8. Fetch CMS Delivery Pricing Configuration (Base Fare & Rate Per KM)
export function useDeliveryPricing() {
    return useQuery<DeliveryPricingDto>({
        queryKey: ['cms', 'delivery-pricing'],
        queryFn: async () => {
            const response = await apiClient.get<DeliveryPricingDto>('/cms/delivery-pricing');
            return response.data;
        },
        staleTime: 1000 * 60 * 5,
    });
}

// 9. Update CMS Delivery Pricing Configuration (Owner only)
export function useUpdateDeliveryPricing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: DeliveryPricingDto) => {
            const response = await apiClient.put<DeliveryPricingDto>('/cms/delivery-pricing', payload);
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Delivery Rates Saved!", {
                description: "New Base Fare & Rate Per KM are now active across POS terminals.",
            });
            await queryClient.invalidateQueries({ queryKey: ['cms', 'delivery-pricing'] });
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message || "Failed to update delivery pricing.";
            toast.error(msg);
        },
    });
}
