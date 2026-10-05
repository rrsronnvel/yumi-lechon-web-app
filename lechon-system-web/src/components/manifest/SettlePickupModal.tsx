/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { toast } from "sonner";
import { useSettlePickupPaymentMutation } from "@/hooks/useManifest";
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

  const settleMutation = useSettlePickupPaymentMutation();

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

    settleMutation.mutate(
      {
        orderId: order.orderId,
        amount: order.balanceDue,
        paymentMethod: paymentMethod === "Cash" ? "Physical Cash" : "Store GCash",
        referenceNumber: referenceNumber.trim() || undefined,
      },
      {
        onSuccess: () => {
          const methodLabel =
            paymentMethod === "Cash"
              ? "Physical Cash (Store Drawer)"
              : "Store GCash QR";

          toast.success(`Settlement recorded for Order #${order.orderId}!`, {
            description: `₱${order.balanceDue.toLocaleString()} collected from ${order.customerName} via ${methodLabel}.`,
          });
          handleClose();
          onSuccess?.();
        },
        onError: (err: any) => {
          const apiError =
            err?.response?.data?.message ||
            "Failed to record settlement. Please check the amount and try again.";
          setErrorMessage(apiError);
          toast.error("Settlement Error", {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>Settle Pickup Order #{order.orderId}</span>
            {order.isTrustedCustomer && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
              >
                👑 VIP
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Record store register handover payment for {order.customerName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Details Summary Card */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-semibold text-slate-800">
                {order.customerName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Scheduled Time:</span>
              <span className="font-medium text-slate-700">
                {formattedTime}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Delivery Fee:</span>
              <span className="font-mono font-medium">₱0.00</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="font-bold text-slate-900">
                Balance to Collect:
              </span>
              <span className="font-mono text-xl font-extrabold text-emerald-600">
                ₱{order.balanceDue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label htmlFor="pickup-payment-method" className="text-sm font-semibold">
              Payment Method <span className="text-red-500">*</span>
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
              <SelectTrigger id="pickup-payment-method" className="w-full">
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
            <Label htmlFor="ref-num" className="text-sm font-medium">
              Reference / Receipt # (Optional)
            </Label>
            <Input
              id="ref-num"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g., GCash Ref # or Counter Receipt #"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={settleMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            onClick={handleConfirm}
            disabled={settleMutation.isPending}
          >
            {settleMutation.isPending
              ? "Recording..."
              : "Confirm & Record Settlement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
