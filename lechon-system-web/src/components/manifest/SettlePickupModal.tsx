/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { toast } from "sonner";
import { useCounterCollectPickupMutation } from "@/hooks/useManifest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SettlePickupModalOrder {
  orderId: number;
  customerName: string;
  targetDeliveryTime: string;
  balanceDue: number;
  deliveryFee?: number;
  isTrustedCustomer?: boolean;
}

interface SettlePickupModalProps {
  order: SettlePickupModalOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SettlePickupModal({
  order,
  open,
  onOpenChange,
  onSuccess,
}: SettlePickupModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const collectMutation = useCounterCollectPickupMutation();

  const handleClose = () => {
    setPaymentMethod("Cash");
    setReferenceNumber("");
    setErrorMessage(null);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!order) return;

    if (!paymentMethod) {
      setErrorMessage("Please select a payment method.");
      return;
    }

    setErrorMessage(null);

    collectMutation.mutate(
      {
        orderId: order.orderId,
        amount: order.balanceDue,
        paymentMethod: paymentMethod === "Cash" ? "Cash" : "GCash",
        referenceNumber: referenceNumber.trim() || undefined,
      },
      {
        onSuccess: () => {
          const methodLabel =
            paymentMethod === "Cash"
              ? "Physical Cash (Store Drawer)"
              : "Store GCash QR";

          toast.success(`Counter Collection Recorded for Order #${order.orderId}!`, {
            description: `₱${order.balanceDue.toLocaleString()} collected from ${order.customerName} via ${methodLabel} and placed into Staff Drawer custody.`,
          });
          handleClose();
          onSuccess?.();
        },
        onError: (err: any) => {
          const apiError =
            err?.response?.data?.message ||
            "Failed to record counter collection. Please check the amount and try again.";
          setErrorMessage(apiError);
          toast.error("Collection Error", {
            description: apiError,
          });
        },
      }
    );
  };

  if (!order) return null;

  const formattedTime = new Date(order.targetDeliveryTime).toLocaleString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-x-hidden max-w-md w-full p-6 rounded-xl border-stone-200/90 bg-white">
        <DialogHeader className="w-full min-w-0">
          <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <span>Collect Pickup Order #{order.orderId}</span>
            {order.isTrustedCustomer && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
              >
                👑 VIP
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-stone-500">
            Collect walk-in customer handover payment and place into staff drawer custody.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 w-full min-w-0">
          {/* Order Details Summary Card */}
          <div className="p-4 border border-stone-200 rounded-xl bg-stone-50 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-stone-500">Customer:</span>
              <span className="font-semibold text-stone-900">
                {order.customerName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-500">Scheduled Time:</span>
              <span className="font-medium text-stone-700">
                {formattedTime}
              </span>
            </div>
            <div className="flex justify-between items-center text-stone-500">
              <span>Delivery Fee:</span>
              <span className="font-mono font-medium">₱0.00</span>
            </div>
            <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
              <span className="font-bold text-stone-900">
                Balance to Collect:
              </span>
              <span className="font-mono text-xl font-extrabold text-emerald-600">
                ₱{order.balanceDue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label htmlFor="pickup-payment-method" className="text-sm font-semibold text-stone-800">
              Payment Method <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={paymentMethod}
              onValueChange={(val: string | null) => {
                if (val) {
                  setPaymentMethod(val);
                  if (errorMessage) setErrorMessage(null);
                }
              }}
            >
              <SelectTrigger id="pickup-payment-method" className="w-full h-10 border-stone-300">
                <SelectValue placeholder="Select payment method..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">
                  💵 Physical Cash (To Store Drawer)
                </SelectItem>
                <SelectItem value="GCash">
                  📱 Store GCash QR
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Optional Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="ref-num" className="text-sm font-medium text-stone-700">
              Reference / Receipt # (Optional)
            </Label>
            <Input
              id="ref-num"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g., GCash Ref # or Counter Receipt #"
              className="h-10 border-stone-300"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 bg-transparent border-t border-stone-200 pt-3 px-0 pb-0 gap-2 sm:space-x-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={collectMutation.isPending}
            className="border-stone-300 text-stone-700 h-10"
          >
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 shadow-xs"
            onClick={handleConfirm}
            disabled={collectMutation.isPending}
          >
            {collectMutation.isPending
              ? "Recording..."
              : "Confirm & Receive into Drawer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
