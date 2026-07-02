import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient"; // Your Axios instance

export function useOrdersDirectory(searchTerm: string) {
  return useQuery({
    // The query key re-runs the fetch anytime the searchTerm changes
    queryKey: ['orders', 'directory', searchTerm], 
    queryFn: async () => {
      const response = await apiClient.get('/orders/directory', {
        params: { searchTerm } // Axios safely formats this as ?searchTerm=xyz
      });
      return response.data;
    }
  });
}