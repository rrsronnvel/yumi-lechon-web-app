/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCounterCollectPickupMutation } from "@/hooks/useManifest";
import { useAuth } from "@/context/AuthContext";
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
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [digitalAmount, setDigitalAmount] = useState<number>(0);
  const [digitalMethod, setDigitalMethod] = useState<string>("GCash");
  const [digitalReference, setDigitalReference] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { user } = useAuth();
  const defaultStaffLabel = user?.fullName
    ? `${user.fullName} (@${user.username})`
    : (user?.username || "");
  const [receivedByStaff, setReceivedByStaff] = useState<string>(defaultStaffLabel);

  useEffect(() => {
    if (open) {
      setReceivedByStaff(defaultStaffLabel);
      setCashAmount(order?.balanceDue ?? 0);
      setDigitalAmount(0);
      setDigitalReference("");
    }
  }, [open, defaultStaffLabel, order?.balanceDue]);

  const collectMutation = useCounterCollectPickupMutation();

  const handleClose = () => {
    setPaymentMethod("Cash");
    setReferenceNumber("");
    setCashAmount(0);
    setDigitalAmount(0);
    setDigitalMethod("GCash");
    setDigitalReference("");
    setErrorMessage(null);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!order) return;

    if (!paymentMethod) {
      setErrorMessage("Please select a payment method.");
      return;
    }
    if (
      paymentMethod === "Split" &&
      (cashAmount <= 0 || digitalAmount <= 0 || cashAmount + digitalAmount !== order.balanceDue)
    ) {
      setErrorMessage(`Cash and Digital amounts must both be positive and total ₱${order.balanceDue.toLocaleString()}.`);
      return;
    }
    const isFullDigital = paymentMethod !== "Cash" && paymentMethod !== "Split";
    if (isFullDigital && !referenceNumber.trim()) {
      setErrorMessage("Bank Name / Reference Note is required for a digital transfer.");
      return;
    }
    if (paymentMethod === "Split" && !digitalReference.trim()) {
      setErrorMessage("Bank Name / Reference Note is required for the digital portion.");
      return;
    }

    setErrorMessage(null);

    collectMutation.mutate(
      {
        orderId: order.orderId,
        amount: order.balanceDue,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        staffName: receivedByStaff.trim() || undefined,
        cashAmount: paymentMethod === "Split" ? cashAmount : undefined,
        digitalAmount: paymentMethod === "Split" ? digitalAmount : undefined,
        digitalMethod: paymentMethod === "Split" ? digitalMethod : undefined,
        digitalReferenceNumber:
          paymentMethod === "Split" ? digitalReference.trim() || undefined : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Counter Collection Recorded for Order #${order.orderId}!`, {
            description: isFullDigital
              ? `₱${order.balanceDue.toLocaleString()} via ${paymentMethod} logged for Owner account verification; physical drawer remains ₱0.`
              : paymentMethod === "Split"
                ? `Cash and digital portions were logged separately for ${order.customerName}.`
                : `₱${order.balanceDue.toLocaleString()} collected from ${order.customerName} as physical cash and placed into Staff Drawer custody.`,
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
            Collect walk-in payment, separating physical drawer cash from Owner-account digital transfers.
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
                  📱 Direct GCash
                </SelectItem>
                <SelectItem value="Maya">
                  💚 Maya
                </SelectItem>
                <SelectItem value="Bank Transfer">
                  🏦 Bank Transfer
                </SelectItem>
                <SelectItem value="Split">
                  ➕ Split (Cash + Digital)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "Split" && (
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Physical Cash to Drawer (₱)</Label>
                <Input
                  type="number"
                  value={cashAmount}
                  onChange={(event) => {
                    const cash = Math.max(0, Number(event.target.value) || 0);
                    setCashAmount(cash);
                    setDigitalAmount(Math.max(0, order.balanceDue - cash));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Digital Transfer Amount (₱)</Label>
                <Input
                  type="number"
                  value={digitalAmount}
                  onChange={(event) => setDigitalAmount(Math.max(0, Number(event.target.value) || 0))}
                />
              </div>
              <Select value={digitalMethod} onValueChange={(value) => value && setDigitalMethod(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GCash">Direct GCash</SelectItem>
                  <SelectItem value="ManualGCash">Rider GCash</SelectItem>
                  <SelectItem value="Maya">Maya</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={digitalReference}
                onChange={(event) => setDigitalReference(event.target.value)}
                placeholder="Bank Name / Reference Note *"
              />
            </div>
          )}

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="ref-num" className="text-sm font-medium text-stone-700">
              {paymentMethod !== "Cash" && paymentMethod !== "Split"
                ? "Bank Name / Reference Note *"
                : "Reference / Receipt # (Optional)"}
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
              : paymentMethod !== "Cash" && paymentMethod !== "Split"
                ? "✓ Log Digital Transfer for Owner Check"
                : "Confirm & Receive into Drawer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
