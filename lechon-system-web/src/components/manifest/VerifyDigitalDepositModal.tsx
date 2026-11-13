import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Store, Bike, CreditCard, FileText } from "lucide-react";

export interface VerifyDigitalDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  orderReference: string;
  customerName: string;
  fulfillmentType?: "Pickup" | "Delivery" | "Lalamove" | string;
  riderName?: string | null;
  pendingDigitalMethod?: string | null;
  digitalReferenceNote?: string | null;
  pendingDigitalAmount: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function VerifyDigitalDepositModal({
  open,
  onOpenChange,
  orderId,
  orderReference,
  customerName,
  fulfillmentType = "Pickup",
  riderName,
  pendingDigitalMethod = "Direct GCash",
  digitalReferenceNote,
  pendingDigitalAmount,
  onConfirm,
  isPending,
}: VerifyDigitalDepositModalProps) {
  const isDelivery = fulfillmentType === "Delivery";
  const displayRef = orderReference?.replace(/^#/, "") || String(orderId);
  const displayAmount = Number(pendingDigitalAmount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md bg-white border-stone-200 shadow-xl rounded-2xl p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <DialogTitle className="text-lg font-bold text-stone-900">
              👑 Verify Digital Deposit
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-stone-500 font-medium">
            🏦 Verify Digital Deposit (Hop 2) • Confirm account credit before marking settled.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Card */}
        <div className="my-2 p-4 bg-sky-50/60 border border-sky-200/80 rounded-xl space-y-3.5">
          {/* Customer & Order */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Customer & Order
            </span>
            <span className="text-sm font-bold text-stone-900">
              #{displayRef} • {customerName}
            </span>
          </div>

          {/* Fulfillment Type */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Fulfillment Type
            </span>
            <span className="font-semibold text-stone-800 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-stone-200">
              {isDelivery ? (
                <>
                  <Bike className="w-3.5 h-3.5 text-amber-600" />
                  <span>🛵 Rider ({riderName || "Freelance Rider"})</span>
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5 text-sky-600" />
                  <span>🏪 Store Pickup</span>
                </>
              )}
            </span>
          </div>

          {/* Payment Channel Badge */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Payment Channel
            </span>
            <Badge
              variant="outline"
              className="bg-sky-100 text-sky-800 border-sky-300 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1"
            >
              <CreditCard className="w-3 h-3" />
              {pendingDigitalMethod || "Direct GCash"}
            </Badge>
          </div>

          {/* Reference / Bank Note */}
          <div className="flex flex-col gap-1 text-xs bg-white p-2.5 rounded-lg border border-sky-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
              <FileText className="w-3 h-3 text-stone-400" /> Reference / Bank Note
            </span>
            <span className="font-mono text-xs text-stone-800 font-semibold break-all">
              {digitalReferenceNote && digitalReferenceNote.trim()
                ? digitalReferenceNote.trim()
                : "No reference note provided"}
            </span>
          </div>

          {/* Amount to Verify & Settle */}
          <div className="pt-2 border-t border-sky-200/80 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-950">
              Amount to Verify & Settle
            </span>
            <span className="text-2xl font-black text-sky-900 font-mono tracking-tight">
              ₱{displayAmount}
            </span>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className="cursor-pointer border-stone-300 text-stone-700 hover:bg-stone-100 h-9 px-4 rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
            className="cursor-pointer bg-sky-700 hover:bg-sky-800 text-white font-bold h-9 px-4 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>👑 Confirm & Settle ₱{displayAmount}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
