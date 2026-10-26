import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export interface OrderDirectoryDto {
  id: number;
  orderReference?: string;
  isDraft?: boolean;
  isTimeTbd?: boolean;
  customerName: string;
  facebookName?: string | null;
  contactNumber: string;
  source?: string;
  eventType?: string | null;
  deliveryAddress?: string | null;
  landmark?: string | null;
  remarks?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  routingStatus: string; // "Unassigned", "Assigned", "Delivered"
  targetDeliveryTime?: string | null;
  riderDepartureTime?: string | null;
  itemsCount?: number;
  hasRoastItems?: boolean;
  grandTotal: number;
  downpayment: number;
  downpaymentMethod: string;
  freebiesSummary?: string | null;
  freebiesConfigJson?: string | null;
  balanceDue: number;
  isTrustedCustomer: boolean;
  isCancelled: boolean;
  cancellationReason?: string | null;
  createdBy: string;
  updatedAt?: string | null;
  hasRecentEdits: boolean;
  settlementCustodyStatus?: string; // "Uncollected", "InStaffDrawer", "Settled"
  riderName?: string | null;
  isRemittedToOwner?: boolean;
  isOwnerConfirmed: boolean;
  ownerConfirmedAt?: string | null;
  ownerConfirmedBy?: string | null;
  paymentChannelsSummary: PaymentChannelTotalDto[];
}

export interface PaymentChannelTotalDto {
  paymentMethod: string;
  amount: number;
}

export interface OrderDetailCategoryDto {
  id: number;
  name: string;
  basePrice: number;
  minimumWeightKg: number;
  maximumWeightKg: number;
}

export interface OrderDetailItemDto {
  id: number;
  orderId: number;
  itemCategoryId: number;
  quantity: number;
  price: number;
  totalPrice: number;
  itemCategory?: OrderDetailCategoryDto | null;
}

export interface OrderDetailsDto {
  id: number;
  orderReference?: string;
  isDraft?: boolean;
  isTimeTbd?: boolean;
  customerName: string;
  facebookName?: string | null;
  contactNumber: string;
  source: string;
  eventType?: string | null;
  deliveryAddress?: string | null;
  landmark?: string | null;
  remarks?: string | null;
  price: number;
  addOns?: string | null;
  deliveryFee: number;
  downpayment: number;
  downpaymentMethod: string;
  freebiesSummary?: string | null;
  freebiesConfigJson?: string | null;
  discount: number;
  grandTotal: number;
  balanceDue: number;
  isTrustedCustomer: boolean;
  targetDeliveryTime?: string | null;
  riderDepartureTime?: string | null;
  isDeliveryDetailsConfirmed: boolean;
  isCancelled: boolean;
  cancellationReason?: string | null;
  isPriceWaived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  routingStatus: string; // "Unassigned", "Assigned", "Delivered"
  deliveryTripId?: number | null;
  assignedRiderName?: string | null;
  assignedRiderPhone?: string | null;
  customerProfileId?: number | null;
  customerTotalOrdersCount?: number;
  customerPreferences?: string | null;
  customerComplaintHistory?: string | null;
  settlementCustodyStatus?: string; // "Uncollected", "InStaffDrawer", "Settled"
  isOwnerConfirmed: boolean;
  ownerConfirmedAt?: string | null;
  ownerConfirmedBy?: string | null;
  orderItems: OrderDetailItemDto[];
  paymentLogs: PaymentLogDto[];
  paymentChannelsSummary: PaymentChannelTotalDto[];
}

export interface PaymentLogDto {
  id: number;
  amount: number;
  paymentMethod: string;
  status: string;
  gatewayReferenceId: string;
  createdAt: string;
}

export interface OrderAuditLogDto {
  id: number;
  orderId: number;
  actionType: string;
  changes: string;
  changeDescription?: string;
  changedBy: string;
  timestamp: string;
}

export interface RecordManualPaymentPayload {
  orderId: number;
  amount: number;
  paymentMethod: 'GCash' | 'Cash' | 'Maya' | 'Bank Transfer' | string;
  referenceNumber?: string;
}

export interface CancelOrderPayload {
  id: number;
  reason: string;
}

export const useOrdersDirectory = (
  searchTerm: string = '',
  filterTab: string = 'upcoming',
  selectedDate: string = ''
) => {
  return useQuery<OrderDirectoryDto[]>({
    queryKey: ['orders', 'directory', { searchTerm, filterTab, selectedDate }],
    queryFn: async () => {
      const response = await apiClient.get<OrderDirectoryDto[]>('/orders/directory', {
        params: {
          searchTerm: searchTerm.trim() || undefined,
          filterTab: filterTab || undefined,
          date: selectedDate || undefined,
        },
      });
      return response.data;
    },
    staleTime: 1000 * 30,
  });
};

export const useOrderDetails = (orderId: number | null) => {
  return useQuery<OrderDetailsDto>({
    queryKey: ['orders', 'details', orderId],
    queryFn: async () => {
      const response = await apiClient.get<OrderDetailsDto>(`/orders/${orderId}`);
      return response.data;
    },
    enabled: orderId !== null,
  });
};

export const useOrderAuditLogs = (orderId: number | null) => {
  return useQuery<OrderAuditLogDto[]>({
    queryKey: ['orders', 'audit-logs', orderId],
    queryFn: async () => {
      const response = await apiClient.get<OrderAuditLogDto[]>(
        `/orders/${orderId}/audit-logs`
      );
      return response.data;
    },
    enabled: orderId !== null,
  });
};

export const useRecordManualPaymentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RecordManualPaymentPayload) => {
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
      await queryClient.invalidateQueries({ queryKey: ['orders', 'directory'] });
      await queryClient.invalidateQueries({ queryKey: ['orders', 'details'] });
      await queryClient.invalidateQueries({ queryKey: ['orders', 'audit-logs'] });
    },
  });
};

export const useCancelOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: CancelOrderPayload) => {
      const response = await apiClient.patch(`/orders/${id}/cancel`, {
        reason: reason.trim(),
      });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders', 'directory'] });
      await queryClient.invalidateQueries({ queryKey: ['orders', 'details'] });
      await queryClient.invalidateQueries({ queryKey: ['orders', 'audit-logs'] });
    },
  });
};

export const useConfirmOwnerOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.post(`/orders/${orderId}/confirm-owner`);
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
};
