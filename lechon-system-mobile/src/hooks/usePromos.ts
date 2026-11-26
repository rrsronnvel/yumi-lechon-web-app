import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export interface PromoPackageDto {
  id: number;
  code: string;
  groupName: string;
  name: string;
  description?: string | null;
  seasonScope: 'Regular' | 'DecemberRegular' | 'DecemberPeak' | 'AllDates' | string;
  discountAmount: number;
  includedItemsJson: string;
  allowOnPeakDates: boolean;
  isActive: boolean;
  sortOrder: number;
}

export const parsePromoItems = (promo?: PromoPackageDto | null): Record<string, number> => {
  if (!promo?.includedItemsJson) return {};
  try {
    const parsed = JSON.parse(promo.includedItemsJson) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Math.max(0, Number(value) || 0)] as const)
        .filter(([, value]) => value > 0),
    );
  } catch {
    return {};
  }
};

export const usePromoCatalog = (enabled: boolean) => useQuery<PromoPackageDto[]>({
  queryKey: ['promos', 'catalog'],
  queryFn: async ({ signal }) => (await apiClient.get<PromoPackageDto[]>('/promos', { signal })).data,
  enabled,
  staleTime: 60_000,
});

export const usePromosForDate = (date: string, enabled = true) => {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
    ? date.trim()
    : '';

  return useQuery<PromoPackageDto[]>({
    queryKey: ['promos', 'for-date', normalizedDate],
    queryFn: async () => {
      const response = await apiClient.get<PromoPackageDto[]>('/promos/for-date', {
        params: { date: normalizedDate },
      });
      return response.data ?? [];
    },
    enabled: enabled && Boolean(normalizedDate),
    staleTime: 60_000,
  });
};
