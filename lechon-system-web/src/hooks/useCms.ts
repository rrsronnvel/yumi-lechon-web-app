import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

export interface ItemCategory {
    id: number;
    name: string;
    basePrice: number;
}

// 1. Fetch the live menu
export function useMenuCategories() {
    return useQuery<ItemCategory[]>({
        queryKey: ['cms', 'categories'],
        queryFn: async () => {
            // Re-using the same endpoint your POS form uses!
            const response = await axios.get('http://localhost:5199/api/inventory/categories');
            return response.data;
        },
    });
}

// 2. The Engine to change a price
export function useUpdatePrice() {
    const queryClient = useQueryClient();

    return useMutation({
        // Inside useUpdatePrice()
        mutationFn: async ({ categoryId, newPrice }: { categoryId: number; newPrice: number }) => {
            // 1. Notice how we use the backticks (`) to inject the categoryId directly into the URL string!
            const response = await axios.put(`http://localhost:5199/api/cms/categories/${categoryId}/price`, {
                // 2. We no longer need to pass categoryId in the body because it is in the URL!
                newPrice: newPrice,
                adminName: "Owner"
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success("Menu Price Updated!", {
                description: "The new price is now live. Checking for affected advance orders...",
            });
            // Refresh the menu list
            queryClient.invalidateQueries({ queryKey: ['cms', 'categories'] });
            // Instantly wake up the Dashboard Radar to check if this broke any old orders!
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'renegotiations'] });
        },
        onError: () => {
            toast.error("Failed to update price.");
        }
    });
}