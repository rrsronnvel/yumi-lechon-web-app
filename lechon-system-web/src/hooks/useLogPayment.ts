/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";

export function useLogPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (paymentData: {
            orderId: number;
            amount?: number;
            paymentProvider?: string;
            referenceNumber?: string;
            splits?: Array<{ amount: number; paymentMethod: string; referenceNumber?: string }>;
        }) => {
           
            const response = await apiClient.post(`/orders/${paymentData.orderId}/payments`, {
                orderId: paymentData.orderId,
                amount: paymentData.amount,
                paymentMethod: paymentData.paymentProvider,
                referenceNumber: paymentData.referenceNumber,
                splits: paymentData.splits,
            });
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
            await queryClient.invalidateQueries({ queryKey: ["manifest"] });
            await queryClient.invalidateQueries({ queryKey: ["orders", "audit-logs"] });
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
