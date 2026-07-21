import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useOrderAuditLogs = (orderId: number | null) => {
  return useQuery({
    // We cache this strictly to the specific order!
    queryKey: ["orders", orderId, "audit-logs"],
    queryFn: async () => {
      const response = await axios.get(`http://localhost:5199/api/orders/${orderId}/audit-logs`);
      return response.data;
    },
    // The Bouncer: Don't run this fetch if no order is selected
    enabled: !!orderId, 
  });
};