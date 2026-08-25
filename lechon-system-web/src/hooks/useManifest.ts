import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface PendingSettlementDrop {
  id: number;
  orderId: number;
  riderName: string;
  customerName: string;
  isTrustedCustomer: boolean;
  deliveryAddress: string;
  totalCollected: number;
  riderDeliveryFee: number;
  netRemittance: number;
}

export type PaymentMethodType = "Cash" | "GCash" | "ManualGCash";

export interface SettlePaymentPayload {
  orderId: number;
  provider: PaymentMethodType;
  amount: number;
}

export const usePendingSettlements = () => {
  return useQuery<PendingSettlementDrop[]>({
    queryKey: ["manifest", "pending-settlement"],
    queryFn: async () => {
      const response = await apiClient.get("/logistics/trips/pending-settlement");
      return response.data;
    },
  });
};

export const useSettlePaymentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SettlePaymentPayload) => {
      const response = await apiClient.post("/internal/payments/manual", {
        orderId: payload.orderId,
        amount: payload.amount,
        provider: payload.provider,
      });
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manifest", "pending-settlement"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};