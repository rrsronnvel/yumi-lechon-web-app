import { useQuery } from "@tanstack/react-query";
import apiClient from '../services/apiClient';

export const useOrderDetails = (orderId: number | null) => {
    return useQuery({
        // We create a unique cache key for EVERY specific order we click
        queryKey: ["order", orderId],

        // The actual network request to your C# backend
        queryFn: async () => {
            const { data } = await apiClient.get(`/orders/${orderId}`);
            return data;
        },

        // THE SAFETY SWITCH: Only run this query if orderId is NOT null
        enabled: !!orderId,
    });
};