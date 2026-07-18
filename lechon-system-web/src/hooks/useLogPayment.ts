/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";

export function useLogPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (paymentData: { orderId: number; amount: number; paymentProvider: string }) => {
           
            const response = await apiClient.post(`/internal/payments/manual`, paymentData);
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Payment Logged", {
                description: "The new payment has been securely appended to the ledger.",
            });
        
            await queryClient.invalidateQueries({ queryKey: ["orders"] }); 
            await queryClient.invalidateQueries({ queryKey: ["Orders"] }); // Capital O
            await queryClient.invalidateQueries({ queryKey: ["order"] });  // Singular
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] }); 
        },
        onError: (error: any) => {
            const errorMsg = typeof error.response?.data === 'string'
                ? error.response.data
                : error.response?.data?.message || "Payment provider rejected the transaction.";

            toast.error("Payment Failed", {
                description: errorMsg,
            });
        },
    });
}