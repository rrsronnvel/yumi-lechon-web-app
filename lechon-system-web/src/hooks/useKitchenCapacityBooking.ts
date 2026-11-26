import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCapacityApproval, getCapacityDepartureTime } from "@/utils/kitchenCapacity";
import {
  getCapacityConflict,
  type CapacityItem,
  type CapacityRequest,
  useKitchenCapacityDay,
  useKitchenCapacityEvaluation,
} from "./useKitchenCapacity";

type BatchSelection = {
  code: string;
  branch?: string;
  targetTime: string;
  riderDepartureTime: string;
};

export function useKitchenCapacityBooking({
  targetTime, riderDepartureTime, fulfillment, items, isDraft, isOwner, disabled = false,
  excludeOrderId, initialBranch, initialBatch,
}: {
  targetTime: string;
  riderDepartureTime?: string;
  fulfillment: number;
  items: CapacityItem[];
  isDraft: boolean;
  isOwner: boolean;
  disabled?: boolean;
  excludeOrderId?: number;
  initialBranch?: string;
  initialBatch?: BatchSelection;
}) {
  const queryClient = useQueryClient();
  const [branchSelection, setBranch] = useState(initialBranch);
  const [batchSelection, setBatch] = useState(initialBatch);
  const [approval, setApproval] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const departure = getCapacityDepartureTime(targetTime, riderDepartureTime, fulfillment);
  const date = targetTime.slice(0, 10);
  const departureDate = departure.slice(0, 10);
  const kitchenDate = fulfillment === 2 && departureDate < date ? departureDate : date;
  const enabled = !disabled && !isDraft && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(targetTime);
  const day = useKitchenCapacityDay(kitchenDate, branchSelection, enabled);
  const branch = branchSelection ?? day.data?.branch.code;
  const activeBatch = (batchSelection?.branch ?? branch) === branch &&
    batchSelection?.targetTime === targetTime && batchSelection?.riderDepartureTime === departure
    ? batchSelection.code : undefined;
  const request: CapacityRequest | null = enabled && items.length > 0 ? {
    date, targetTime, riderDepartureTime: departure, branchCode: branch,
    batchCode: activeBatch, fulfillment, items, excludeOrderId,
  } : null;
  const evaluation = useKitchenCapacityEvaluation(request);
  const result = evaluation.data;
  const approvalKey = JSON.stringify([request, result?.projectedPits, result?.maxPits]);
  const { approved, blocked } = getCapacityApproval(result, isOwner, approval === approvalKey);

  return {
    date: kitchenDate,
    targetTime,
    riderDepartureTime: departure,
    branch,
    day: day.data,
    result,
    batchCode: result?.batchCode ?? activeBatch,
    isOwner,
    enabled,
    isChecking: Boolean(request && evaluation.isPending),
    isError: Boolean(request && evaluation.isError),
    blocked: Boolean(request && (evaluation.isPending || blocked)),
    approved,
    reason: approved ? reason : "",
    setBranch,
    setBatch,
    setReason,
    setApproved: (checked: boolean) => {
      setApproval(checked ? approvalKey : null);
      if (!checked) setReason("");
    },
    reportConflict: (error: unknown) => {
      const conflict = getCapacityConflict(error);
      if (!conflict || !request) return;
      setApproval(null);
      setReason("");
      queryClient.setQueryData(["kitchen-capacity", "evaluate", request], conflict);
      void queryClient.invalidateQueries({ queryKey: ["kitchen-capacity", "day"] });
    },
    orderFields: {
      kitchenBranch: branch,
      kitchenBatchCode: enabled ? activeBatch ?? null : null,
      capacityOverrideApproved: enabled && approved,
      capacityOverrideReason: enabled && approved ? reason.trim() || null : null,
    },
  };
}
