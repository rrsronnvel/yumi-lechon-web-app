/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { toast } from "sonner";
import {
  usePendingSettlements,
  useSettlePaymentMutation,
  PendingSettlementDrop,
  PaymentMethodType,
} from "@/hooks/useManifest";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

export default function ManifestPage() {
  const { data: drops = [], isLoading } = usePendingSettlements();
  const [selectedDrop, setSelectedDrop] =
    useState<PendingSettlementDrop | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const settleMutation = useSettlePaymentMutation();

  const handleClose = () => {
    setSelectedDrop(null);
    setPaymentMethod("");
    setErrorMessage(null);
  };

  const handleConfirmSettlement = () => {
    if (!selectedDrop) return;

    if (!paymentMethod) {
      setErrorMessage("Please select how the payment was remitted.");
      return;
    }

    setErrorMessage(null);

    const dropName = selectedDrop.customerName;
    const dropNet = selectedDrop.netRemittance;
    const methodLabel =
      paymentMethod === "Cash"
        ? "Physical Cash"
        : paymentMethod === "GCash"
          ? "Direct Store GCash"
          : "Rider GCash Remittance";

    settleMutation.mutate(
      {
        orderId: selectedDrop.orderId || selectedDrop.id,
        provider: paymentMethod as PaymentMethodType,
        amount: selectedDrop.netRemittance,
      },
      {
        onSuccess: () => {
          toast.success(`Settlement complete for ${dropName}!`, {
            description: `₱${dropNet.toLocaleString()} recorded via ${methodLabel}.`,
          });
          handleClose();
        },
        onError: (err: any) => {
          const apiError =
            err?.response?.data?.message ||
            "Failed to settle payment. Please try again.";
          setErrorMessage(apiError);
          toast.error("Reconciliation Error", {
            description: apiError,
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        Loading pending daily reconciliations...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Daily Manifest & Cash Reconciliation
        </h1>
        <p className="text-muted-foreground mt-1">
          Verify returning rider collections customer-by-customer to prevent
          financial leaks before updating the general ledger.
        </p>
      </div>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700">
            Pending Order Drops ({drops.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <th className="p-4">Rider</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Delivery Address</th>
                <th className="p-4 text-right">Total Collected</th>
                <th className="p-4 text-right">Rider Fee</th>
                <th className="p-4 text-right text-emerald-700 bg-emerald-50/30">
                  Net Remittance
                </th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {drops.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    🎉 All caught up! No pending delivery drops to reconcile.
                  </td>
                </tr>
              ) : (
                drops.map((drop: PendingSettlementDrop) => (
                  <tr
                    key={drop.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 font-medium text-slate-900">
                      {drop.riderName}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {drop.customerName}
                        </span>
                        {drop.isTrustedCustomer && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
                          >
                            👑 VIP
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">
                      {drop.deliveryAddress || "Store Pickup"}
                    </td>
                    <td className="p-4 text-right font-mono">
                      ₱{drop.totalCollected.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono text-red-600">
                      - ₱{drop.riderDeliveryFee.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-emerald-600 bg-emerald-50/20">
                      ₱{drop.netRemittance.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={() => setSelectedDrop(drop)}
                      >
                        Settle Payment
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Settle Payment Slide-Out Drawer */}
      <Sheet
        open={!!selectedDrop}
        onOpenChange={(open) => !open && handleClose()}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-xl font-bold">
              Settle Delivery Payment
            </SheetTitle>
            <SheetDescription>
              Reconcile remittance for Order #
              {selectedDrop?.orderId || selectedDrop?.id} •{" "}
              {selectedDrop?.customerName}
            </SheetDescription>
          </SheetHeader>

          {selectedDrop && (
            <div className="py-6 space-y-6">
              {/* Customer & Rider Info Card */}
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-800">
                    Rider: {selectedDrop.riderName}
                  </span>
                  {selectedDrop.isTrustedCustomer && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
                    >
                      👑 VIP
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedDrop.deliveryAddress || "Store Pickup"}
                </p>
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 border border-slate-200 rounded-lg space-y-3">
                <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Financial Reconciliation
                </h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Total Door Collection:
                  </span>
                  <span className="font-mono font-medium">
                    ₱{selectedDrop.totalCollected.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Rider Fee Deduction:</span>
                  <span className="font-mono">
                    - ₱{selectedDrop.riderDeliveryFee.toLocaleString()}
                  </span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="font-semibold text-slate-800 text-sm">
                    Net Store Remittance:
                  </span>
                  <span className="font-mono font-bold text-lg text-emerald-600">
                    ₱{selectedDrop.netRemittance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 3-Way Payment Method Selector */}
              <div className="space-y-2">
                <Label
                  htmlFor="payment-method"
                  className="text-sm font-semibold"
                >
                  Remittance Method <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={paymentMethod || undefined}
                  onValueChange={(val: string) => {
                    setPaymentMethod(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                >
                  <SelectTrigger id="payment-method" className="w-full">
                    <SelectValue placeholder="Select remittance method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">
                      💵 Physical Cash (Rider handed bills)
                    </SelectItem>
                    <SelectItem value="GCash">
                      📱 Direct Store GCash (Customer paid QR)
                    </SelectItem>
                    <SelectItem value="ManualGCash">
                      📲 Rider GCash Remittance (Rider transferred)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          <SheetFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={settleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmSettlement}
              disabled={settleMutation.isPending}
            >
              {settleMutation.isPending
                ? "Reconciling..."
                : "Confirm Settlement"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
