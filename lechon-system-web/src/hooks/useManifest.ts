import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PendingSettlementTrip {
  id: number;
  riderName: string;
  vehicleType: string;
  dispatchTime: string;
  returnTime: string;
  totalCollected: number;
  riderDeliveryFee: number;
  expectedNetRemittance: number;
}

// Existing query logic...
async function fetchPendingSettlements(): Promise<PendingSettlementTrip[]> {
  const response = await fetch("/api/logistics/trips/pending-settlement");
  if (!response.ok) throw new Error("Failed to fetch pending manifest settlements");
  return response.json();
}

export function usePendingSettlements() {
  return useQuery<PendingSettlementTrip[], Error>({
    queryKey: ["manifest", "pending-settlement"],
    queryFn: fetchPendingSettlements,
  });
}

// ==========================================
// 🚀 NEW MUTATION LOGIC FOR CHECKS 4 & 5
// ==========================================

interface SettleTripPayload {
  tripId: number;
  paymentMethod: string; // "Physical Cash" vs "Store GCash"
}

// Post request to our .NET Logistics Controller contract
async function settleDeliveryTrip({ tripId, paymentMethod }: SettleTripPayload): Promise<void> {
  const response = await fetch(`/api/logistics/trips/${tripId}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethod }),
  });
  if (!response.ok) {
    throw new Error("Failed to record cash settlement on the ledger.");
  }
}

export function useSettleTripMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settleDeliveryTrip,
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["manifest", "pending-settlement"] });
    },
  });
}