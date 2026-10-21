import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface OrderDirectoryDto {
  id: number;
  orderReference?: string;
  customerName: string;
  facebookName?: string | null;
  source?: string;
  eventType?: string | null;
  contactNumber: string;
  deliveryAddress: string;
  landmark?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  routingStatus: string; // "Unassigned", "Assigned", "Delivered"
  targetDeliveryTime: string;
  riderDepartureTime?: string | null;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
  isTrustedCustomer: boolean;
  isCancelled: boolean;
  cancellationReason?: string | null;
  createdBy: string;
  updatedAt?: string | null;
  hasRecentEdits: boolean;
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
