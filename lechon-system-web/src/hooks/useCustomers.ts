import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { useDebounce } from "@/hooks/useDebounce";

export interface CustomerProfileDto {
  id: number;
  contactNumber: string;
  fullName: string;
  facebookName?: string | null;
  defaultAddress?: string | null;
  defaultLandmark?: string | null;
  preferences?: string | null;
  complaintHistory?: string | null;
  isVip: boolean;
  totalOrdersCount: number;
  updatedAt: string;
}

export interface UpdateCustomerNotesVariables {
  id?: number | null;
  phone?: string;
  customerName?: string;
  facebookName?: string | null;
  preferences?: string | null;
  complaintHistory?: string | null;
  isVip?: boolean;
}

export const useCustomerLookup = (phone: string, fbName?: string) => {
  const debouncedPhone = useDebounce((phone || "").trim(), 300);
  const debouncedFbName = useDebounce((fbName || "").trim(), 300);

  const digitCount = debouncedPhone.replace(/\D/g, "").length;
  const shouldFetch = digitCount >= 7 || debouncedFbName.length >= 3;

  return useQuery<CustomerProfileDto | null>({
    queryKey: ["customers", "lookup", debouncedPhone, debouncedFbName],
    queryFn: async () => {
      const response = await apiClient.get<CustomerProfileDto | null>(
        "/customers/lookup",
        {
          params: {
            phone: digitCount >= 7 ? debouncedPhone : undefined,
            fbName: debouncedFbName.length >= 3 ? debouncedFbName : undefined,
          },
        }
      );
      if (response.status === 204 || !response.data) {
        return null;
      }
      return response.data;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 30,
  });
};

export const useUpdateCustomerNotesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: UpdateCustomerNotesVariables
    ): Promise<CustomerProfileDto> => {
      const payload = {
        customerName: variables.customerName,
        facebookName: variables.facebookName,
        preferences: variables.preferences ?? "",
        complaintHistory: variables.complaintHistory ?? "",
        isVip: variables.isVip,
      };

      if (variables.id && variables.id > 0) {
        const response = await apiClient.put<CustomerProfileDto>(
          `/customers/${variables.id}/notes`,
          payload
        );
        return response.data;
      }

      if (variables.phone && variables.phone.trim()) {
        const encodedPhone = encodeURIComponent(variables.phone.trim());
        const response = await apiClient.put<CustomerProfileDto>(
          `/customers/by-phone/${encodedPhone}/notes`,
          payload,
          {
            params: {
              customerName: variables.customerName || undefined,
              fbName: variables.facebookName || undefined,
            },
          }
        );
        return response.data;
      }

      throw new Error("Either Customer Profile ID or Phone Number is required.");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["order"] }),
      ]);
    },
  });
};
