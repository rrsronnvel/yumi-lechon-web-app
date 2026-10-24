import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface PaymentChannelTotalDto {
  paymentMethod: string;
  amount: number;
}

export interface OrderDirectoryDto {
  id: number;
  orderReference?: string;
  isDraft?: boolean;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  eventType?: string | null;
  contactNumber: string;
  deliveryAddress?: string | null;
  landmark?: string | null;
  remarks?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  routingStatus: string; // "Unassigned", "Assigned", "Delivered"
  targetDeliveryTime?: string | null;
  riderDepartureTime?: string | null;
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

export const useOrdersDirectory = (
  searchTerm: string = "",
  filterTab: string = "upcoming"
) => {
  return useQuery<OrderDirectoryDto[]>({
    queryKey: ["orders", "directory", { searchTerm, filterTab }],
    queryFn: async () => {
      const response = await apiClient.get("/orders/directory", {
        params: {
          searchTerm: searchTerm.trim() || undefined,
          filterTab: filterTab || undefined,
        },
      });
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
};
