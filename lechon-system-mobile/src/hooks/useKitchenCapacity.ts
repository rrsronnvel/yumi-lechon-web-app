import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { isCapacityBlocked, isKitchenDate, type CapacityEvaluation, type CapacityStatus, type CapacityTiming } from '../utils/kitchenCapacity';

interface KitchenBranch {
  code: string;
  name: string;
  maxSqueezeBelliesPerPit: number;
}

export interface KitchenBatch {
  batchCode: string;
  label: string;
  anchorTime: string;
  usedPits: number;
  maxPits: number;
  remainingPits: number;
  status: CapacityStatus;
}

interface KitchenCapacityDay {
  mode: 'PeakHoliday' | 'Weekend' | 'Continuous';
  isHalfDayHoliday: boolean;
  branch: KitchenBranch;
  activeBranches: KitchenBranch[];
  batches: KitchenBatch[];
}

interface CapacityCartItem {
  id?: number;
  itemCategoryId: number;
  fulfilledItemCategoryId?: number | null;
  quantity: number;
  isRoast: boolean;
}

interface UseKitchenCapacityOptions {
  enabled: boolean;
  isOwner: boolean;
  date: string;
  timing: CapacityTiming | null;
  fulfillment: number;
  items: CapacityCartItem[];
  excludeOrderId?: number;
}

export function useKitchenCapacity(options: UseKitchenCapacityOptions) {
  const { enabled, isOwner, date, timing, items, fulfillment, excludeOrderId } = options;
  const [branchCode, setBranchCode] = useState<string>();
  const [selectedBatch, setSelectedBatch] = useState<{ date: string; code: string } | null>(null);
  const [approval, setApproval] = useState<{ requestKey: string; reason: string } | null>(null);
  const batchCode = selectedBatch?.date === date ? selectedBatch.code : null;
  const dayEnabled = enabled && isKitchenDate(date);

  const day = useQuery({
    queryKey: ['kitchen-capacity', 'day', date, branchCode],
    queryFn: async ({ signal }) => (await apiClient.get<KitchenCapacityDay>('/kitchen-capacity/day', {
      params: { date, branch: branchCode },
      signal,
    })).data,
    enabled: dayEnabled,
    refetchInterval: 15_000,
    retry: 1,
  });

  const roastItems = items.filter((item) => item.isRoast && item.itemCategoryId > 0 && item.quantity > 0)
    .map(({ id, itemCategoryId, fulfilledItemCategoryId, quantity }) => ({
      orderItemId: id || undefined,
      itemCategoryId,
      fulfilledItemCategoryId,
      quantity,
    }));
  const request = dayEnabled && timing && roastItems.length > 0
    ? { date, ...timing, branchCode, batchCode, fulfillment, items: roastItems, excludeOrderId }
    : null;
  const requestKey = request ? JSON.stringify(request) : '';
  const evaluation = useQuery({
    queryKey: ['kitchen-capacity', 'evaluate', request],
    queryFn: async ({ signal }) => (await apiClient.post<CapacityEvaluation>('/kitchen-capacity/evaluate', request, { signal })).data,
    enabled: Boolean(request),
    refetchInterval: 15_000,
    retry: 1,
  });
  const projection = request ? evaluation.data : undefined;
  const approved = Boolean(isOwner && projection?.requiresOwnerOverride && approval?.requestKey === requestKey);
  const isChecking = Boolean(request && evaluation.isPending && evaluation.isFetching);
  const isBlocked = isCapacityBlocked(projection, isOwner, approved);

  const resetSelection = useCallback((branch?: string | null, code?: string | null, batchDate?: string) => {
    setBranchCode(branch || undefined);
    setSelectedBatch(code && batchDate ? { date: batchDate, code } : null);
    setApproval(null);
  }, []);

  return {
    day: day.data,
    projection,
    isChecking,
    isBlocked,
    hasError: Boolean((dayEnabled && day.isError) || (request && evaluation.isError)),
    approved,
    reason: approved ? approval?.reason ?? '' : '',
    branchCode: branchCode ?? day.data?.branch.code,
    batchCode,
    orderFields: {
      kitchenBranch: branchCode ?? day.data?.branch.code,
      kitchenBatchCode: enabled ? batchCode : null,
      capacityOverrideApproved: approved,
      capacityOverrideReason: approved ? approval?.reason.trim() || null : null,
    },
    setApproved: (checked: boolean) => setApproval(checked ? { requestKey, reason: '' } : null),
    setReason: (reason: string) => setApproval({ requestKey, reason }),
    selectBatch: (code: string | null, batchDate = date) => {
      setSelectedBatch(code ? { code, date: batchDate } : null);
      setApproval(null);
    },
    resetSelection,
    refresh: () => {
      if (dayEnabled) void day.refetch();
      if (request) void evaluation.refetch();
    },
  };
}
