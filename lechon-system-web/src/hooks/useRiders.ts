import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export interface Rider {
  id: number;
  fullName: string;
  phoneNumber: string;
  isActive: boolean;
}

export const useRidersQuery = () => {
  return useQuery<Rider[]>({
    queryKey: ["riders"],
    queryFn: async () => {
      const response = await apiClient.get("/riders");
      return response.data;
    },
  });
};

export const useCreateRiderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { fullName: string; phoneNumber: string }) => {
      const response = await apiClient.post("/riders", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riders"] });
    },
  });
};
