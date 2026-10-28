import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface VoidPaymentPayload {
  orderId: number;
  paymentLogId: number;
  reason: string;
  voidedBy?: string;
}

export const useVoidPaymentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      paymentLogId,
      reason,
      voidedBy,
    }: VoidPaymentPayload) => {
      const response = await apiClient.post(
        `/orders/${orderId}/payments/${paymentLogId}/void`,
        { reason: reason.trim(), voidedBy },
      );
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["order", variables.orderId],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["manifest"] }),
        queryClient.invalidateQueries({
          queryKey: ["orders", variables.orderId, "audit-logs"],
        }),
      ]);
    },
  });
};
