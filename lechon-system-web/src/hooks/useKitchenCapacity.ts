import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { isAxiosError } from "axios";
import apiClient from "@/services/apiClient";

export type CapacityMode = "PeakHoliday" | "Weekend" | "Continuous";
export type CapacityStatus = "Open" | "LastSlot" | "Full" | "Overbooked";

export interface KitchenBranch {
  id: number;
  code: string;
  name: string;
  totalPits: number;
  safeBelliesPerPit: number;
  maxSqueezeBelliesPerPit: number;
  postDepartureBufferMinutes: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface KitchenBatchPreset {
  id: number;
  branchCode: string;
  scheduleType: Exclude<CapacityMode, "Continuous">;
  batchCode: string;
  label: string;
  startTime: string;
  endTime: string;
  anchorTime: string;
  maxPits: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CapacityBlock {
  batchCode: string;
  label: string;
  startTime: string;
  endTime: string;
  anchorTime: string;
  usedPits: number;
  maxPits: number;
  wholeCount: number;
  bellyCount: number;
  remainingPits: number;
  status: CapacityStatus;
}

export interface KitchenCapacityDay {
  date: string;
  mode: CapacityMode;
  isHalfDayHoliday: boolean;
  branch: KitchenBranch;
  activeBranches: KitchenBranch[];
  batches: CapacityBlock[];
  timeBlocks: CapacityBlock[];
  peakConcurrentPits: number;
}

export interface CapacityItem {
  itemCategoryId: number;
  orderItemId?: number;
  fulfilledItemCategoryId?: number | null;
  quantity: number;
}

export interface CapacityRequest {
  date: string;
  targetTime: string;
  riderDepartureTime?: string;
  branchCode?: string;
  batchCode?: string;
  fulfillment: number;
  items: CapacityItem[];
  excludeOrderId?: number;
}

export interface CapacitySuggestion {
  date: string;
  targetTime: string;
  riderDepartureTime: string;
  batchCode?: string | null;
  label: string;
}

export interface CapacityEvaluation {
  branchCode: string;
  batchCode: string | null;
  currentPits: number;
  incomingPits: number;
  projectedPits: number;
  maxPits: number;
  remainingAfter: number;
  status: CapacityStatus;
  canFitWithOwnerSqueeze: boolean;
  squeezedProjectedPits: number;
  requiresOwnerOverride: boolean;
  suggestedNextSlot: CapacitySuggestion | null;
}

const capacityKey = ["kitchen-capacity"] as const;

export function useKitchenCapacityDay(date?: string, branch?: string, enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...capacityKey, "day", date, branch],
    queryFn: async ({ signal }) => (await apiClient.get<KitchenCapacityDay>("/kitchen-capacity/day", {
      params: { date, branch }, signal,
    })).data,
    enabled: isAuthenticated && enabled && Boolean(date),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useKitchenCapacityEvaluation(request: CapacityRequest | null) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...capacityKey, "evaluate", request],
    queryFn: async ({ signal }) => (await apiClient.post<CapacityEvaluation>(
      "/kitchen-capacity/evaluate", request, { signal },
    )).data,
    enabled: isAuthenticated && Boolean(request),
    refetchInterval: 30_000,
    retry: false,
    gcTime: 30_000,
  });
}

export function getCapacityConflict(error: unknown): CapacityEvaluation | undefined {
  if (isAxiosError<{ code?: string; capacity?: CapacityEvaluation }>(error) &&
      error.response?.status === 409 && error.response.data?.code === "KitchenCapacityExceeded") {
    return error.response.data.capacity;
  }
}

type KitchenCapacityConfig = { branches: KitchenBranch[]; batches: KitchenBatchPreset[] };
type ConfigChange =
  | { kind: "branch"; value: KitchenBranch }
  | { kind: "batch"; value: KitchenBatchPreset }
  | { kind: "delete"; id: number };

export function useKitchenCapacityConfig() {
  const { isAuthenticated, isOwner } = useAuth();
  return useQuery({
    enabled: isAuthenticated && isOwner,
    queryKey: [...capacityKey, "config"],
    queryFn: async () => (await apiClient.get<KitchenCapacityConfig>("/kitchen-capacity/config")).data,
  });
}

export function useChangeKitchenCapacityConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: ConfigChange) => {
      if (change.kind === "branch") {
        await apiClient.put(`/kitchen-capacity/branches/${change.value.id}`, change.value);
      } else if (change.kind === "delete") {
        await apiClient.delete(`/kitchen-capacity/batches/${change.id}`);
      } else if (change.value.id) {
        await apiClient.put(`/kitchen-capacity/batches/${change.value.id}`, change.value);
      } else {
        await apiClient.post("/kitchen-capacity/batches", change.value);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: capacityKey }),
  });
}
