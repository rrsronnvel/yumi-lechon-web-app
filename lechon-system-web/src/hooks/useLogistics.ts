import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";

export interface TodayDispatchOrder {
  id: number;
  customerName: string;
  deliveryAddress: string;
  targetDeliveryTime: string;
  riderName?: string;
  vehicleType?: string;
  isDeliveryDetailsConfirmed?: boolean;
  routingStatus?: string;
}

// 1. Fetch unassigned orders for tomorrow's planner
export const useUnassignedOrders = () => {
  return useQuery({
    queryKey: ["logistics", "unassigned-orders"],
    queryFn: async () => {
      const response = await apiClient.get("/logistics/unassigned");
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds fresh cache
  });
};

// 2. Fetch today's scheduled delivery roster
export const useTodayOperations = () => {
  return useQuery<TodayDispatchOrder[]>({
    queryKey: ["logistics", "today"],
    queryFn: async () => {
      const response = await apiClient.get("/logistics/today");
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds fresh cache
  });
};

// 3. Assign or reassign rider (Handles both batch planning and emergency roadside swaps)
export const useAssignRider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchData: {
      orderIds: number[];
      riderName: string;
      vehicleType: string;
    }) => {
      const response = await apiClient.post("/logistics/assign-rider", dispatchData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics", "unassigned-orders"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "directory"] });
      queryClient.invalidateQueries({ queryKey: ["logistics", "today"] });
    },
  });
};

// 4. Close out delivery loop when rider sends proof of delivery
export const useConfirmDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.patch(`/orders/${orderId}/confirm-delivery`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "directory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "delivery-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["logistics", "today"] });
    },
  });
};

