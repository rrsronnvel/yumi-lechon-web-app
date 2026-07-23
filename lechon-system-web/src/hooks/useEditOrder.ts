/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";

export function useEditOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    // 1. The Payload: Send the updated data to our C# PUT endpoint
    mutationFn: async (data: any) => {
      const response = await apiClient.put(`/orders/${data.id}`, data);
      return response.data;
    },
    // 2. The Chain Reaction: If the C# backend successfully recalculates...
    onSuccess: async () => {
      toast.success("Order Updated", {
        description: "The kitchen schedule has been securely recalculated.",
      });

      // 3. The Clean Slate: Force React to instantly fetch the new reality!
      // Notice these are Catch-Alls now! No "directory" or "details" attached.
      await queryClient.invalidateQueries({ queryKey: ["orders"] }); // Catches all plural ["orders", ...]
      await queryClient.invalidateQueries({ queryKey: ["order"] });  // Catches all singular ["order", 41]
      await queryClient.invalidateQueries({ queryKey: ["roster"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error: any) => {
      // 1. Set a generic fallback
      let errorMessage = "Could not safely modify the order.";

      // 2. Safely parse the ASP.NET Core JSON error object
      if (error.response?.data) {
        const data = error.response.data;
        if (data.errors) {
          // Extracts all the specific validation errors and joins them into a readable sentence
          errorMessage = Object.values(data.errors).flat().join(" | ");
        } else if (data.title) {
          errorMessage = data.title;
        } else if (typeof data === "string") {
          errorMessage = data;
        }
      }

      // 3. Safely print the string (no more crashing!)
      toast.error("Update Failed", {
        description: errorMessage,
      });
    },
  });
}