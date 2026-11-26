import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import type { SplitMotoAssignment } from "@/utils/splitMoto";
import { useAuth } from "@/context/AuthContext";

export interface PendingSettlementDrop extends SplitMotoAssignment {
  id: number;
  orderId: number;
  orderReference: string;
  riderName: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  isTrustedCustomer: boolean;
  deliveryAddress: string;
  totalCollected: number;
  riderDeliveryFee: number;
  netRemittance: number;
  custodyStatus?: string; // "Uncollected" | "InStaffDrawer" | "Settled"
  settlementCustodyStatus?: string; // "Uncollected" | "InStaffDrawer" | "Settled"
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
  heldByStaffAmount?: number | null;
  pendingDigitalMethod?: string | null;
  pendingDigitalAmount?: number | null;
  digitalTransferMethod?: string | null;
  digitalTransferAmount?: number | null;
  digitalReferenceNote?: string | null;
  createdAt?: string;
  targetDeliveryTime?: string;
  riderDepartureTime?: string | null;
  dispatchTime?: string | null;
}

export type PaymentMethodType =
  | "Cash"
  | "GCash"
  | "ManualGCash"
  | "Maya"
  | "Bank Transfer";

export interface SettlePaymentPayload {
  orderId: number;
  provider: PaymentMethodType;
  amount: number;
}

export interface PendingPickupSettlement {
  orderId: number;
  orderReference: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  contactNumber: string;
  targetDeliveryTime: string;
  riderDepartureTime?: string | null;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
  isPaidInFull: boolean;
  isTrustedCustomer: boolean;
  address?: string;
  landmark?: string | null;
  remarks?: string;
  custodyStatus?: string; // "Uncollected" | "InStaffDrawer" | "Settled"
  settlementCustodyStatus?: string; // "Uncollected" | "InStaffDrawer" | "Settled"
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
  heldByStaffAmount?: number | null;
  pendingDigitalMethod?: string | null;
  pendingDigitalAmount?: number | null;
  digitalTransferMethod?: string | null;
  digitalTransferAmount?: number | null;
  digitalReferenceNote?: string | null;
}

export interface PendingLalamoveSettlement {
  id?: number;
  orderId: number;
  orderReference: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  isTrustedCustomer: boolean;
  contactNumber: string;
  deliveryAddress: string;
  targetDeliveryTime: string;
  riderDepartureTime?: string | null;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
  isClearedForRelease: boolean;
  isReleased: boolean;
  remarks?: string;
  custodyStatus?: string;
  settlementCustodyStatus?: string;
}

export interface DownpaymentTrackerItem {
  paymentLogId?: number | null;
  orderId: number;
  orderReference: string;
  customerName: string;
  phoneNumber?: string | null;
  bookingSource?: string | null;
  downpaymentAmount: number;
  amount?: number;
  downpaymentMethod?: string | null;
  paymentMethod?: string | null;
  targetDeliveryTime?: string | null;
  eventDate?: string | null;
  isDateTbd?: boolean;
  isDraft?: boolean;
  createdAt?: string;
  paidAt?: string | null;
  referenceNumber?: string | null;
  encodedBy?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
  isDpRemittedToOwner?: boolean;
  isRemittedToOwner?: boolean;
  dpRemittedAt?: string | null;
  remittedAt?: string | null;
  dpRemittedBy?: string | null;
  remittedBy?: string | null;
}

export const computeEffectiveNetRemittance = (drop: {
  netRemittance?: number;
  totalCollected: number;
  riderDeliveryFee: number;
  custodyStatus?: string;
  settlementCustodyStatus?: string;
}): number => {
  if (typeof drop.netRemittance === "number" && drop.netRemittance > 0) {
    return drop.netRemittance;
  }
  const custody = drop.custodyStatus || drop.settlementCustodyStatus;
  if (custody === "Uncollected" || !custody) {
    return Math.max(0, Number(drop.totalCollected || 0) - Number(drop.riderDeliveryFee || 0));
  }
  return drop.netRemittance ?? 0;
};

type PendingDigitalFields = {
  pendingDigitalAmount?: number | null;
  pendingDigitalMethod?: string | null;
  digitalTransferAmount?: number | null;
  digitalTransferMethod?: string | null;
};

export const getPendingDigitalAmount = (item: PendingDigitalFields): number =>
  Number(item.pendingDigitalAmount ?? item.digitalTransferAmount ?? 0);

export const getPendingDigitalMethod = (
  item: PendingDigitalFields,
): string => item.pendingDigitalMethod || item.digitalTransferMethod || "Digital Transfer";

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
  wasRejected?: boolean;
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
  staffName?: string;
  cashAmount?: number;
  digitalAmount?: number;
  digitalMethod?: string;
  digitalReferenceNumber?: string;
  logSupportRiderExpense?: boolean;
}

export interface OwnerApprovePayload {
  token: string;
  countedAmount: number;
  ownerUsername?: string;
  ownerPinOrPassword?: string;
}

export interface CounterCollectPickupPayload {
  orderId: number;
  paymentMethod: string;
  amount?: number;
  referenceNumber?: string;
  staffName?: string;
  cashAmount?: number;
  digitalAmount?: number;
  digitalMethod?: string;
  digitalReferenceNumber?: string;
}

export interface DirectGcashPayload {
  orderId: number;
  amount: number;
  referenceNumber: string;
}

// Tab 1: Freelance Rider Settlements
export const usePendingSettlements = () => {
  const { isAuthenticated } = useAuth();
  return useQuery<PendingSettlementDrop[]>({
    enabled: isAuthenticated,
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
  const { isAuthenticated } = useAuth();
  return useQuery<PendingPickupSettlement[]>({
    enabled: isAuthenticated,
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
  const { isAuthenticated } = useAuth();
  return useQuery<PendingLalamoveSettlement[]>({
    enabled: isAuthenticated,
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


// Tab 4: Downpayment & Walk-In Remittance Tracker
export const useDownpaymentsQuery = () => {
  const { isAuthenticated } = useAuth();
  return useQuery<DownpaymentTrackerItem[]>({
    enabled: isAuthenticated,
    queryKey: ["manifest", "downpayments"],
    queryFn: async () => {
      const response = await apiClient.get("/logistics/downpayments");
      return response.data;
    },
  });
};

export interface ToggleDownpaymentPayload {
  paymentLogId?: number | null;
  orderId: number;
}

export const useToggleDownpaymentRemittanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ToggleDownpaymentPayload | number) => {
      const isObj = typeof payload === "object" && payload !== null;
      const paymentLogId = isObj ? payload.paymentLogId : null;
      const orderId = isObj ? payload.orderId : payload;

      if (paymentLogId) {
        const response = await apiClient.post(
          `/logistics/downpayments/logs/${paymentLogId}/toggle-remittance`,
        );
        return response.data;
      }
      const response = await apiClient
        .post(`/logistics/downpayments/${orderId}/toggle-remittance`)
        .catch(() => apiClient.post(`/logistics/downpayments/${orderId}/verify`));
      return response.data;
    },
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manifest", "downpayments"] }),
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
      queryClient.invalidateQueries({ queryKey: ["riders"] });
      queryClient.invalidateQueries({
        queryKey: ["manifest", "qr-session", data.token],
      });
    },
  });
};

// 3b. Safeguard 1: Discrepancy Rejection
export const useRejectRiderSignatureMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await apiClient.post<QrSessionStatus>(
        `/logistics/settlements/qr-session/${token}/reject`
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["riders"] });
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
          staffName: payload.staffName,
          cashAmount: payload.cashAmount,
          digitalAmount: payload.digitalAmount,
          digitalMethod: payload.digitalMethod,
          digitalReferenceNumber: payload.digitalReferenceNumber,
          logSupportRiderExpense: payload.logSupportRiderExpense,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["riders"] }),
        queryClient.invalidateQueries({
          queryKey: ["manifest", "qr-session", data.token],
        }),
        queryClient.invalidateQueries({
          queryKey: ["manifest", "pending-settlement"],
        }),
        queryClient.invalidateQueries({ queryKey: ["manifest", "pickups"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["order", data.orderId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};


// 4b. Safeguard 3: Revert Custody to Uncollected
export const useRevertCustodyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.post(
        `/logistics/settlements/orders/${orderId}/revert-custody`
      );
      return response.data;
    },
    onSuccess: () => {
      return Promise.all([
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


// 5. Store Counter Collection (Tab 2 Pickup & Tab 3 Lalamove)
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
        queryClient.invalidateQueries({ queryKey: ["manifest", "lalamove"] }),
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


// 6. Owner Verification & Final Settlement
export const useOwnerApproveQrMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OwnerApprovePayload) => {
      const response = await apiClient.post<QrSessionStatus>(
        `/logistics/settlements/qr-session/${payload.token}/owner-approve`,
        {
          countedAmount: payload.countedAmount,
          ownerUsername: payload.ownerUsername,
          ownerPinOrPassword: payload.ownerPinOrPassword,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["riders"] }),
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
        queryClient.invalidateQueries({ queryKey: ["manifest", "lalamove"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });
};

// 7b. Direct Owner Digital Verification Mutation
export const useVerifyDigitalSettlementMutation = (hookOrderId?: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mutationOrderId?: number) => {
      const targetOrderId = mutationOrderId ?? hookOrderId;
      if (!targetOrderId) {
        throw new Error("Order ID is required for digital settlement verification.");
      }
      const response = await apiClient.post(
        `/logistics/settlements/orders/${targetOrderId}/verify-digital`
      );
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manifest"] }),
        queryClient.invalidateQueries({ queryKey: ["order"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["downpayments"] }),
      ]);
    },
  });
};

// ==========================================
// 8. Staff Drawer & Floating Custody Overview HUD
// ==========================================

export interface CustodyOverviewMetrics {
  inDrawerTotal: number;
  inDrawerCount: number;
  uncollectedTotal: number;
  uncollectedCount: number;
  pendingDigitalTotal: number;
  pendingDigitalCount: number;
}

export function computeCustodyMetrics(
  riderDrops: PendingSettlementDrop[] = [],
  pickupDrops: PendingPickupSettlement[] = []
): CustodyOverviewMetrics {
  let inDrawerTotal = 0;
  let inDrawerCount = 0;
  let uncollectedTotal = 0;
  let uncollectedCount = 0;
  let pendingDigitalTotal = 0;
  let pendingDigitalCount = 0;

  for (const r of riderDrops) {
    const status = r.settlementCustodyStatus || r.custodyStatus || "Uncollected";
    const amount = Number(r.netRemittance || 0);
    const physicalAmount = Number(r.heldByStaffAmount ?? 0);
    const digitalAmount = getPendingDigitalAmount(r);
    const hasPendingDigital = status !== "Settled" && digitalAmount > 0;

    if (status === "InStaffDrawer") {
      if (physicalAmount > 0) {
        inDrawerTotal += physicalAmount;
        inDrawerCount += 1;
      }
    } else if (status === "Uncollected" && !hasPendingDigital && amount > 0) {
      uncollectedTotal += amount;
      uncollectedCount += 1;
    }
    if (hasPendingDigital) {
      pendingDigitalTotal += digitalAmount;
      pendingDigitalCount += 1;
    }
  }

  for (const p of pickupDrops) {
    const status = p.settlementCustodyStatus || p.custodyStatus || "Uncollected";
    const amount = Number(p.heldByStaffAmount ?? p.balanceDue ?? 0);
    const physicalAmount = Number(p.heldByStaffAmount ?? 0);
    const digitalAmount = getPendingDigitalAmount(p);
    const hasPendingDigital = status !== "Settled" && digitalAmount > 0;

    if (status === "InStaffDrawer") {
      if (physicalAmount > 0) {
        inDrawerTotal += physicalAmount;
        inDrawerCount += 1;
      }
    } else if (status === "Uncollected" && !hasPendingDigital && amount > 0) {
      uncollectedTotal += amount;
      uncollectedCount += 1;
    }
    if (hasPendingDigital) {
      pendingDigitalTotal += digitalAmount;
      pendingDigitalCount += 1;
    }
  }

  return {
    inDrawerTotal,
    inDrawerCount,
    uncollectedTotal,
    uncollectedCount,
    pendingDigitalTotal,
    pendingDigitalCount,
  };
}

export const useCustodyOverview = (
  riderDrops?: PendingSettlementDrop[],
  pickupDrops?: PendingPickupSettlement[]
) => {
  const { data: defaultRiders = [], isLoading: isLoadingRiders } = usePendingSettlements();
  const { data: defaultPickups = [], isLoading: isLoadingPickups } = usePendingPickupsQuery();

  const activeRiders = riderDrops ?? defaultRiders;
  const activePickups = pickupDrops ?? defaultPickups;

  const metrics = useMemo(() => {
    return computeCustodyMetrics(activeRiders, activePickups);
  }, [activeRiders, activePickups]);

  return {
    ...metrics,
    isLoading: isLoadingRiders || isLoadingPickups,
  };
};
