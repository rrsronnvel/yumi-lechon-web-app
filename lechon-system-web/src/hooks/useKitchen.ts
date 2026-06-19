import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { RosterItem, ProductionStatus } from "@/pages/KitchenPage";

export function useKitchen() {
  const queryClient = useQueryClient();

  // 1. The useQuery Hook: Continually monitors the roster endpoint for updates
  const useRosterQuery = () => 
    useQuery<RosterItem[]>({
      queryKey: ["roster"],
      queryFn: async () => {
        // Hits your .NET endpoint. Pass today's date if your backend expects a date filter
        const response = await apiClient.get("/schedules/roster");
        return response.data;
      },
    });

  // 2. The useMutation Hook: Transmits the status change to the server
  const useUpdateStatusMutation = () =>
    useMutation({
      mutationFn: async ({ id, nextStatus }: { id: number; nextStatus: ProductionStatus }) => {
        // Sends a PATCH request to advance the item's state machine status
        const response = await apiClient.patch(`/roasting/items/${id}/status`, {
          status: nextStatus
        });
        return response.data;
      },
      // 3. Crucial Step: Shouting to the app that data has officially changed
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["roster"] });
      },
    });

  return {
    useRosterQuery,
    useUpdateStatusMutation,
  };
}