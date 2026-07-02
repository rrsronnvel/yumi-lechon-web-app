import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient"; // Your Axios instance

export function useOrdersDirectory(searchTerm: string, filterTab: string) {
  return useQuery({
    // The query key re-runs the fetch anytime the search OR the tab changes
    queryKey: ['orders', 'directory', searchTerm, filterTab],
    queryFn: async () => {
      const response = await apiClient.get('/orders/directory', {
        // Axios safely formats this as ?searchTerm=xyz&filterTab=upcoming
        params: { searchTerm, filterTab } 
      });
      return response.data;
    }
  });
}