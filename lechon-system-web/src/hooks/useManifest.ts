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
  custodyStatus?: string; // "Uncollected" | "InStaffDrawer" | "Settled"
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
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
  custodyStatus?: string; // "Uncollected" | "InStaffDrawer" | "Settled"
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
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

// QR Settlement Data Types
export interface CreateQrSessionPayload {
  orderId: number;
  hopStage: "RiderToStaff" | "StaffToOwner";
  paymentMethod: "Cash" | "ManualGCash" | "GCash" | string;
  expectedAmount: number;
  referenceNumber?: string;
}

export interface QrSessionStatus {
  token: string;
  orderId: number;
  customerName: string;
  assignedRiderName: string;
  hopStage: "RiderToStaff" | "StaffToOwner" | string;
  paymentMethod: string;
  expectedAmount: number;
  status: "PendingScan" | "SignedByRider" | "ValidatedByStaff" | "ApprovedByOwner" | "Expired" | string;
  riderSignedBy?: string | null;
  riderRemittedAmount?: number | null;
  riderSignedAt?: string | null;
  staffValidatedBy?: string | null;
  staffValidatedAt?: string | null;
  ownerApprovedBy?: string | null;
  ownerApprovedAt?: string | null;
  expiresAt: string;
  isExpired: boolean;
  isUsed: boolean;
}

export interface RiderSignPayload {
  token: string;
  riderName: string;
  remittedAmount: number;
}

export interface StaffValidatePayload {
  token: string;
  manualOverrideRiderName?: string;
  manualOverrideAmount?: number;
}

export interface OwnerApprovePayload {
  token: string;
  ownerUsername?: string;
  ownerPinOrPassword?: string;
}

export interface CounterCollectPickupPayload {
  orderId: number;
  paymentMethod: string;
  amount?: number;
  referenceNumber?: string;
}

export interface DirectGcashPayload {
  orderId: number;
  amount: number;
  referenceNumber: string;
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

// ==========================================
// TWO-HOP QR DIGITAL SETTLEMENT HOOKS
// ==========================================

// 1. Create QR Session
export const useCreateQrSessionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateQrSessionPayload) => {
      const response = await apiClient.post<QrSessionStatus>(
        "/logistics/settlements/qr-session",
        payload
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["manifest", "qr-session", data.token], data);
    },
  });
};

// 2. Poll QR Session Status
export const useQrSessionStatusQuery = (token: string | null, enabled: boolean = true) => {
  return useQuery<QrSessionStatus>({
    queryKey: ["manifest", "qr-session", token],
    queryFn: async () => {
      if (!token) throw new Error("Token is required");
      const response = await apiClient.get<QrSessionStatus>(
        `/logistics/settlements/qr-session/${token}`
      );
      return response.data;
    },
    enabled: Boolean(token) && enabled,
    refetchInterval: 2000,
  });
};

// 3. Rider Digital Signature
export const useRiderSignQrMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RiderSignPayload) => {
      const response = await apiClient.post<QrSessionStatus>(
        `/logistics/settlements/qr-session/${payload.token}/rider-sign`,
        {
          riderName: payload.riderName,
          remittedAmount: payload.remittedAmount,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["manifest", "qr-session", data.token],
      });
    },
  });
};

// 4. Staff Validate into Drawer
export const useStaffValidateQrMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: StaffValidatePayload) => {
      const response = await apiClient.post<QrSessionStatus>(
        `/logistics/settlements/qr-session/${payload.token}/staff-validate`,
        {
          manualOverrideRiderName: payload.manualOverrideRiderName,
          manualOverrideAmount: payload.manualOverrideAmount,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["manifest", "qr-session", data.token],
        }),
        queryClient.invalidateQueries({
          queryKey: ["manifest", "pending-settlement"],
        }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};

// 5. Store Counter Collection (Tab 2 Pickup)
export const useCounterCollectPickupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CounterCollectPickupPayload) => {
      const response = await apiClient.post(
        "/logistics/settlements/counter-collect",
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({
          queryKey: ["manifest", "pending-settlement"],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};

// 6. Owner Verification & Final Settlement
export const useOwnerApproveQrMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OwnerApprovePayload) => {
      const response = await apiClient.post<QrSessionStatus>(
        `/logistics/settlements/qr-session/${payload.token}/owner-approve`,
        {
          ownerUsername: payload.ownerUsername,
          ownerPinOrPassword: payload.ownerPinOrPassword,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["manifest", "qr-session", data.token],
        }),
        queryClient.invalidateQueries({
          queryKey: ["manifest", "pending-settlement"],
        }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "lalamove"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};

// 7. Direct Store GCash Bypass Settlement
export const useDirectGcashSettlementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DirectGcashPayload) => {
      const response = await apiClient.post(
        "/logistics/settlements/direct-gcash",
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["manifest", "pending-settlement"],
        }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};