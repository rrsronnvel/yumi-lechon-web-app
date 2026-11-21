import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";

export type PromoSeasonScope =
  | "Regular"
  | "DecemberRegular"
  | "DecemberPeak"
  | "AllDates";

export interface PromoPackage {
  id: number;
  code: string;
  groupName: string;
  name: string;
  description?: string | null;
  seasonScope: PromoSeasonScope | string;
  discountAmount: number;
  includedItemsJson: string;
  allowOnPeakDates: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type PromoPackageInput = Omit<PromoPackage, "id">;

export const promoQueryKeys = {
  all: ["promos"] as const,
  forDate: (date?: string) => ["promos", "for-date", date] as const,
};

export function usePromos() {
  return useQuery<PromoPackage[]>({
    queryKey: promoQueryKeys.all,
    queryFn: async () => (await apiClient.get<PromoPackage[]>("/promos")).data,
    staleTime: 60_000,
  });
}

export function usePromosForDate(date?: string) {
  return useQuery<PromoPackage[]>({
    queryKey: promoQueryKeys.forDate(date),
    queryFn: async () =>
      (
        await apiClient.get<PromoPackage[]>("/promos/for-date", {
          params: { date },
        })
      ).data,
    enabled: Boolean(date),
    staleTime: 60_000,
  });
}

function useInvalidatePromos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: promoQueryKeys.all });
}

export function useCreatePromo() {
  const invalidate = useInvalidatePromos();
  return useMutation({
    mutationFn: async (payload: PromoPackageInput) =>
      (await apiClient.post<PromoPackage>("/promos", payload)).data,
    onSuccess: async () => {
      await invalidate();
      toast.success("Promo package created.");
    },
    onError: () => toast.error("Could not create the promo package."),
  });
}

export function useUpdatePromo() {
  const invalidate = useInvalidatePromos();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PromoPackage) =>
      (await apiClient.put<PromoPackage>(`/promos/${id}`, payload)).data,
    onSuccess: async () => {
      await invalidate();
      toast.success("Promo package updated.");
    },
    onError: () => toast.error("Could not update the promo package."),
  });
}

export function useDeletePromo() {
  const invalidate = useInvalidatePromos();
  return useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/promos/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Promo package deleted.");
    },
    onError: () => toast.error("Could not delete the promo package."),
  });
}
