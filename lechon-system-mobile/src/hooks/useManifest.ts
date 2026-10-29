import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export interface PendingSettlementDrop {
  id: number;
  orderId: number;
  riderName: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  isTrustedCustomer: boolean;
  deliveryAddress: string;
  totalCollected: number;
  riderDeliveryFee: number;
  netRemittance: number;
  custodyStatus?: 'Uncollected' | 'InStaffDrawer' | 'Settled' | string;
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
  createdAt?: string;
  targetDeliveryTime?: string;
  riderDepartureTime?: string | null;
  dispatchTime?: string | null;
}

export interface PendingPickupSettlement {
  orderId: number;
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
  remarks?: string;
  custodyStatus?: 'Uncollected' | 'InStaffDrawer' | 'Settled' | string;
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
}

export interface PendingLalamoveSettlement {
  id?: number;
  orderId: number;
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
}

export interface CreateQrSessionPayload {
  orderId: number;
  hopStage: 'RiderToStaff' | 'StaffToOwner';
  paymentMethod: 'Cash' | 'ManualGCash' | 'GCash' | string;
  expectedAmount: number;
  referenceNumber?: string;
}

export interface QrSessionStatus {
  token: string;
  orderId: number;
  customerName: string;
  assignedRiderName: string;
  hopStage: 'RiderToStaff' | 'StaffToOwner' | string;
  paymentMethod: string;
  expectedAmount: number;
  status:
    | 'PendingScan'
    | 'SignedByRider'
    | 'ValidatedByStaff'
    | 'ApprovedByOwner'
    | 'Expired'
    | string;
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

export interface StaffValidatePayload {
  token: string;
  manualOverrideRiderName?: string;
  manualOverrideAmount?: number;
  staffName?: string;
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
}

export interface DirectGcashPayload {
  orderId: number;
  amount: number;
  referenceNumber: string;
}

export const usePendingRiderSettlements = () => {
  return useQuery<PendingSettlementDrop[]>({
    queryKey: ['manifest', 'pending-settlement'],
    queryFn: async () => {
      const response = await apiClient.get<PendingSettlementDrop[]>(
        '/logistics/trips/pending-settlement'
      );
      return response.data;
    },
  });
};

export const usePendingPickupSettlements = () => {
  return useQuery<PendingPickupSettlement[]>({
    queryKey: ['manifest', 'pickups'],
    queryFn: async () => {
      const response = await apiClient.get<PendingPickupSettlement[]>(
        '/logistics/settlements/pickups'
      );
      return response.data;
    },
  });
};

export const usePendingLalamoveSettlements = () => {
  return useQuery<PendingLalamoveSettlement[]>({
    queryKey: ['manifest', 'lalamove'],
    queryFn: async () => {
      const response = await apiClient.get<PendingLalamoveSettlement[]>(
        '/logistics/settlements/lalamove'
      );
      return response.data;
    },
  });
};

export const useQrSessionStatus = (token: string | null, enabled: boolean = true) => {
  return useQuery<QrSessionStatus>({
    queryKey: ['manifest', 'qr-session', token],
    queryFn: async () => {
      if (!token) throw new Error('Token is required');
      const response = await apiClient.get<QrSessionStatus>(
        `/logistics/settlements/qr-session/${token}`
      );
      return response.data;
    },
    enabled: Boolean(token) && enabled,
    refetchInterval: 2000,
  });
};

const invalidateAllSettlementCaches = async (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['manifest'] }),
    queryClient.invalidateQueries({ queryKey: ['orders'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
};

export const useCreateQrSessionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateQrSessionPayload) => {
      const response = await apiClient.post<QrSessionStatus>(
        '/logistics/settlements/qr-session',
        payload
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['manifest', 'qr-session', data.token], data);
    },
  });
};

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
        }
      );
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};

export const useRejectRiderSignatureMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await apiClient.post<QrSessionStatus>(
        `/logistics/settlements/qr-session/${token}/reject`
      );
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};

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
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};

export const useRevertCustodyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.post(
        `/logistics/settlements/orders/${orderId}/revert-custody`
      );
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};

export const useCounterCollectPickupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CounterCollectPickupPayload) => {
      const response = await apiClient.post(
        '/logistics/settlements/counter-collect',
        payload
      );
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};

export const useDirectGcashSettlementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DirectGcashPayload) => {
      const response = await apiClient.post(
        '/logistics/settlements/direct-gcash',
        payload
      );
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
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
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};

export const useSettleManualPaymentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      orderId: number;
      amount: number;
      paymentMethod: string;
      referenceNumber?: string;
    }) => {
      const response = await apiClient.post('/internal/payments/manual', {
        orderId: payload.orderId,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        referenceNumber: payload.referenceNumber?.trim() || undefined,
        referenceId: payload.referenceNumber?.trim() || '',
      });
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAllSettlementCaches(queryClient);
    },
  });
};
