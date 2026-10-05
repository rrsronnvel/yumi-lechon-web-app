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
  createdAt?: string;
  targetDeliveryTime?: string;
  dispatchTime?: string | null;
}

export type PaymentMethodType = "Cash" | "GCash" | "ManualGCash";

export interface SettlePaymentPayload {
  orderId: number;
  provider: PaymentMethodType;
  amount: number;
}

export interface PendingPickupSettlement {
  orderId: number;
  customerName: string;
  contactNumber: string;
  targetDeliveryTime: string;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
  isPaidInFull: boolean;
  isTrustedCustomer: boolean;
  address?: string;
  remarks?: string;
}

export interface PendingLalamoveSettlement {
  orderId: number;
  customerName: string;
  contactNumber: string;
  deliveryAddress: string;
  targetDeliveryTime: string;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
  isClearedForRelease: boolean;
  isReleased: boolean;
  remarks?: string;
}

// Tab 1: Freelance Rider Settlements
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
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "lalamove"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};

// Tab 2: Store Pickup Settlements
export const usePendingPickupsQuery = () => {
  return useQuery<PendingPickupSettlement[]>({
    queryKey: ["manifest", "pickups"],
    queryFn: async () => {
      const response = await apiClient.get("/logistics/settlements/pickups");
      return response.data;
    },
  });
};

export const useSettlePickupPaymentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      orderId: number;
      amount: number;
      paymentMethod: string;
      referenceNumber?: string;
    }) => {
      const response = await apiClient.post("/internal/payments/manual", payload);
      return response.data;
    },
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "lalamove"] }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "pending-settlement"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};

// Tab 3: Lalamove Courier Gate Settlements & Dispatch Release
export const usePendingLalamoveQuery = () => {
  return useQuery<PendingLalamoveSettlement[]>({
    queryKey: ["manifest", "lalamove"],
    queryFn: async () => {
      const response = await apiClient.get("/logistics/settlements/lalamove");
      return response.data;
    },
  });
};

export const useReleaseLalamoveMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.post(
        `/logistics/settlements/lalamove/${orderId}/release`
      );
      return response.data;
    },
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manifest", "lalamove"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};