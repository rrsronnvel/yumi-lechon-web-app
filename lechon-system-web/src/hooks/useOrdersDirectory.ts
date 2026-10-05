import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface OrderDirectoryDto {
  id: number;
  customerName: string;
  contactNumber: string;
  deliveryAddress: string;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  routingStatus: string; // "Unassigned", "Assigned", "Delivered"
  targetDeliveryTime: string;
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