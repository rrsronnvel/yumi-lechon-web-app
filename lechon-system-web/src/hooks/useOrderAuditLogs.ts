import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export const useOrderAuditLogs = (orderId: number | null) => {
  return useQuery({
    // We cache this strictly to the specific order!
    queryKey: ["orders", orderId, "audit-logs"],
    queryFn: async () => {
      // apiClient attaches the Bearer token and already prefixes the /api baseURL
      const response = await apiClient.get(`/orders/${orderId}/audit-logs`);
      return response.data;
    },
    // The Bouncer: Don't run this fetch if no order is selected
    enabled: !!orderId, 
  });
};