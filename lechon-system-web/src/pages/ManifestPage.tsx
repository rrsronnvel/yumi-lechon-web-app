import { useState } from "react";
import {
  usePendingSettlements,
  useSettleTripMutation,
  PendingSettlementTrip,
} from "@/hooks/useManifest"; // Import hooks
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ManifestPage() {
  // 1. Consume our real automated query stream (substitute for old static state array)
  const { data: trips = [], isLoading } = usePendingSettlements();

  // 2. Instantiate our network ledger mutation agent
  const settleTripMutation = useSettleTripMutation();

  const [selectedTrip, setSelectedTrip] =
    useState<PendingSettlementTrip | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const handleConfirmSettlement = () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method for the store remittance.");
      return;
    }

    if (!selectedTrip) return;

    // 3. Fire the backend call with the selected inputs
    settleTripMutation.mutate(
      {
        tripId: selectedTrip.id,
        paymentMethod: paymentMethod,
      },
      {
        onSuccess: () => {
          toast.success(
            `Trip #${selectedTrip.id} settled successfully via ${paymentMethod}!`
          );

          // Clean up and close the modal cleanly
          setSelectedTrip(null);
          setPaymentMethod(""); // ₱0 leak protection complete!
        },
        onError: (error) => {
          toast.error(
            error.message || "An error occurred during ledger submission."
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        Loading pending daily manifests...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Top Meta Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Daily Manifest & Cash Reconciliation
        </h1>
        <p className="text-muted-foreground mt-1">
          Verify returning rider collections and prevent financial leaks before
          updating the general ledger.
        </p>
      </div>

      {/* Main Container Card */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700">
            Pending Financial Settlements
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <th className="p-4">Rider</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4 text-right">Total Collected</th>
                <th className="p-4 text-right">Rider Delivery Fee</th>
                <th className="p-4 text-right text-emerald-700 bg-emerald-50/30">
                  Net Remittance
                </th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {trips.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    🎉 All caught up! No trips pending reconciliation.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 font-medium text-slate-900">
                      {trip.riderName}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">
                        {trip.vehicleType}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-mono">
                      ₱{trip.totalCollected.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono text-red-600">
                      - ₱{trip.riderDeliveryFee.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-emerald-600 bg-emerald-50/20">
                      ₱{trip.expectedNetRemittance.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setSelectedTrip(trip)} // Open the modal!
                      >
                        Settle Trip
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* The Settle Trip Slide-out Sheet */}
      <Sheet
        open={selectedTrip !== null}
        onOpenChange={(open) => !open && setSelectedTrip(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Reconcile Trip #{selectedTrip?.id}</SheetTitle>
            <SheetDescription>
              Verify the cash amounts with {selectedTrip?.riderName}.
            </SheetDescription>
          </SheetHeader>

          {selectedTrip && (
            <div className="grid gap-6 py-6">
              <div className="space-y-4 rounded-lg bg-slate-50 p-4 border border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Gross Collected:</span>
                  <span className="font-mono">
                    ₱{selectedTrip.totalCollected.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Rider Keeps (Fee):</span>
                  <span className="font-mono text-red-600">
                    - ₱{selectedTrip.riderDeliveryFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">
                    Store Receives:
                  </span>
                  <span className="font-mono font-bold text-lg text-emerald-600">
                    ₱{selectedTrip.expectedNetRemittance.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method">
                  How is the store receiving this ₱
                  {selectedTrip.expectedNetRemittance.toLocaleString()}?
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select remittance method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Physical Cash">
                      Physical Cash (To Register)
                    </SelectItem>
                    <SelectItem value="Store GCash">
                      Store GCash Transfer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <SheetFooter>
            <Button variant="outline" onClick={() => setSelectedTrip(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConfirmSettlement}
            >
              Confirm Settlement
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}