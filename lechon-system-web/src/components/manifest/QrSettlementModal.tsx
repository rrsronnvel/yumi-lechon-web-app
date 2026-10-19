import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  useCreateQrSessionMutation,
  useQrSessionStatusQuery,
  useStaffValidateQrMutation,
  useOwnerApproveQrMutation,
  useDirectGcashSettlementMutation,
  useRejectRiderSignatureMutation,
  useRevertCustodyMutation,
} from "@/hooks/useManifest";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export interface QrSettlementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  customerName: string;
  expectedAmount: number;
  riderName?: string;
  hopStage: "RiderToStaff" | "StaffToOwner";
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
  riderSignedBy?: string | null;
  onSuccess?: () => void;
}

export function QrSettlementModal({
  open,
  onOpenChange,
  orderId,
  customerName,
  expectedAmount,
  riderName,
  hopStage,
  heldByStaffName,
  heldPaymentMethod,
  riderSignedBy,
  onSuccess,
}: QrSettlementModalProps) {
  const { user, isOwner } = useAuth();

  // Payment channel for Hop 1
  const [paymentMethod, setPaymentMethod] = useState<string>(
    heldPaymentMethod || "Cash"
  );
  const [directGcashRef, setDirectGcashRef] = useState<string>("");

  // Hop 2 Counted Envelope Bills state
  const [countedBills, setCountedBills] = useState<string>("");

  // Manual Override State
  const [showOverride, setShowOverride] = useState<boolean>(false);
  const [overrideRiderName, setOverrideRiderName] = useState<string>(
    riderName || ""
  );
  const [overrideAmount, setOverrideAmount] = useState<number | "">(
    expectedAmount
  );

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createSessionMutation = useCreateQrSessionMutation();
  const staffValidateMutation = useStaffValidateQrMutation();
  const ownerApproveMutation = useOwnerApproveQrMutation();
  const directGcashMutation = useDirectGcashSettlementMutation();
  const rejectRiderMutation = useRejectRiderSignatureMutation();
  const revertCustodyMutation = useRevertCustodyMutation();

  const canRevertCustody =
    isOwner ||
    (Boolean(user?.username) &&
      Boolean(heldByStaffName) &&
      user!.username.toLowerCase() === heldByStaffName!.toLowerCase());

  // Poll current session status every 2 seconds
  const { data: sessionStatus } = useQrSessionStatusQuery(
    sessionToken,
    open && Boolean(sessionToken)
  );

  // Initialize or recreate QR Session when modal opens or payment method changes (Hop 1)
  useEffect(() => {
    if (open && orderId > 0) {
      if (paymentMethod === "GCash" && hopStage === "RiderToStaff") {
        // Direct GCash skips QR generation
        setSessionToken(null);
        return;
      }

      createSessionMutation.mutate(
        {
          orderId,
          hopStage,
          paymentMethod,
          expectedAmount,
        },
        {
          onSuccess: (data) => {
            setSessionToken(data.token);
            setOverrideRiderName(
              data.assignedRiderName || riderName || "Freelance Rider"
            );
            setOverrideAmount(data.expectedAmount || expectedAmount);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (err: any) => {
            const msg =
              err?.response?.data?.message ||
              "Failed to initialize settlement QR session.";
            setErrorMessage(msg);
          },
        }
      );
    } else {
      setSessionToken(null);
      setErrorMessage(null);
      setShowOverride(false);
      setDirectGcashRef("");
      setCountedBills("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, hopStage, paymentMethod]);

  const handleClose = () => {
    onOpenChange(false);
    setSessionToken(null);
    setErrorMessage(null);
    setShowOverride(false);
  };

  // Staff validates bills received into drawer
  const handleStaffValidate = (isManualOverride: boolean = false) => {
    if (!sessionToken) return;

    setErrorMessage(null);
    staffValidateMutation.mutate(
      {
        token: sessionToken,
        manualOverrideRiderName: isManualOverride
          ? overrideRiderName.trim()
          : undefined,
        manualOverrideAmount: isManualOverride
          ? Number(overrideAmount)
          : undefined,
      },
      {
        onSuccess: (res) => {
          toast.success(`Custody updated: In Staff Drawer!`, {
            description: `Order #${orderId} cash (₱${(
              res.riderRemittedAmount ?? expectedAmount
            ).toLocaleString()}) officially received into drawer custody.`,
          });
          handleClose();
          onSuccess?.();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message ||
            "Validation failed. Please verify the physical bills.";
          setErrorMessage(msg);
        },
      }
    );
  };

  // Direct Store GCash Settle (Hop 1 bypass)
  const handleDirectGcashSettle = () => {
    if (!directGcashRef.trim()) {
      toast.error("Please enter the GCash Reference Number.");
      return;
    }

    setErrorMessage(null);
    directGcashMutation.mutate(
      {
        orderId,
        amount: expectedAmount,
        referenceNumber: directGcashRef.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`Order #${orderId} settled via Direct Store GCash!`, {
            description: `₱${expectedAmount.toLocaleString()} recorded with Ref #${directGcashRef.trim()}.`,
          });
          handleClose();
          onSuccess?.();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message || "Failed to record Direct GCash.";
          setErrorMessage(msg);
        },
      }
    );
  };

  // Owner Quick-Approve via PC shortcut (Logged In as Owner) with Counted-Amount Speed Bump
  const handleOwnerQuickApprove = () => {
    if (!sessionToken) return;

    const countedVal = Number(countedBills);
    const targetExpected = sessionStatus?.expectedAmount ?? expectedAmount;
    if (countedBills === "" || countedVal !== targetExpected) {
      toast.error("Counted bills do not match expected remittance amount.");
      return;
    }

    setErrorMessage(null);
    ownerApproveMutation.mutate(
      {
        token: sessionToken,
        countedAmount: countedVal,
      },
      {
        onSuccess: () => {
          toast.success(`Order #${orderId} Officially Settled & Closed!`, {
            description: `₱${expectedAmount.toLocaleString()} custody transferred to Owner (${
              user?.fullName || "Owner"
            }). Ledger updated.`,
          });
          handleClose();
          onSuccess?.();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message || "Owner quick-approval failed.";
          setErrorMessage(msg);
        },
      }
    );
  };

  const handleRejectRiderSignature = () => {
    if (!sessionToken) return;
    setErrorMessage(null);
    rejectRiderMutation.mutate(sessionToken, {
      onSuccess: () => {
        toast.info("Rider signature rejected.", {
          description: "Rider requested to re-check and re-enter remittance amount.",
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message || "Failed to reject signature.";
        setErrorMessage(msg);
      },
    });
  };

  const handleRevertCustody = () => {
    if (!orderId) return;
    setErrorMessage(null);
    revertCustodyMutation.mutate(orderId, {
      onSuccess: () => {
        toast.success(`Custody for Order #${orderId} reverted to Uncollected!`);
        handleClose();
        onSuccess?.();
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message || "Failed to revert custody.";
        setErrorMessage(msg);
      },
    });
  };

  const qrUrl = sessionToken
    ? `${window.location.origin}/qr-settle/${sessionToken}`
    : "";

  const isSignedByRider = sessionStatus?.status === "SignedByRider";
  const isValidated = sessionStatus?.status === "ValidatedByStaff";
  const isApproved = sessionStatus?.status === "ApprovedByOwner";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {hopStage === "RiderToStaff" ? (
              <Badge className="bg-emerald-600 text-white font-semibold">
                Hop 1: Rider Handover
              </Badge>
            ) : (
              <Badge className="bg-purple-700 text-white font-semibold">
                👑 Hop 2: Remit to Owner
              </Badge>
            )}
            <span className="text-xs font-mono text-muted-foreground">
              Order #{orderId}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">
            {hopStage === "RiderToStaff"
              ? "Cash Custody Handover Handshake"
              : "Owner Custody Verification & Ledger Close"}
          </DialogTitle>
          <DialogDescription>
            {customerName} • Net Remittance:{" "}
            <strong className="text-emerald-700 font-mono">
              ₱{expectedAmount.toLocaleString()}
            </strong>
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
            {errorMessage}
          </div>
        )}

        {/* =================================================== */}
        {/* HOP 1: RIDER TO STAFF CONTENT */}
        {/* =================================================== */}
        {hopStage === "RiderToStaff" && (
          <div className="space-y-4 py-1">
            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Remittance Channel
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(val: string | null) => {
                  if (val) setPaymentMethod(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select payment channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">
                    💵 Physical Cash Handover
                  </SelectItem>
                  <SelectItem value="ManualGCash">
                    📲 Rider GCash Remittance (Rider Sent to Store)
                  </SelectItem>
                  <SelectItem value="GCash">
                    📱 Direct Store GCash (Customer Paid Store Directly)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Direct Store GCash Branch */}
            {paymentMethod === "GCash" ? (
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-sky-900">
                  <Smartphone className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Direct Store GCash:</strong> The customer paid directly to the store&apos;s main GCash number/QR. The freelance rider holds ₱0 of store funds. Skip the Rider QR handshake and record the reference number below.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="direct-ref" className="text-xs font-semibold text-sky-900">
                    GCash Reference Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="direct-ref"
                    value={directGcashRef}
                    onChange={(e) => setDirectGcashRef(e.target.value)}
                    placeholder="e.g., 901238491823"
                    className="font-mono bg-white"
                  />
                </div>

                <Button
                  onClick={handleDirectGcashSettle}
                  disabled={directGcashMutation.isPending}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs"
                >
                  {directGcashMutation.isPending
                    ? "Recording Settlement..."
                    : "📱 Confirm Direct GCash Settlement"}
                </Button>
              </div>
            ) : (
              /* Physical Cash or Rider GCash Remittance (QR Flow) */
              <div className="space-y-4">
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  {sessionToken ? (
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                      <QRCodeSVG value={qrUrl} size={180} includeMargin />
                    </div>
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-muted-foreground">
                      Generating One-Time QR...
                    </div>
                  )}

                  <p className="text-[11px] font-medium text-slate-500 mt-2 text-center max-w-xs">
                    Ask Rider (<strong>{riderName || "Assigned Rider"}</strong>) to scan this code with their phone camera to sign the handover.
                  </p>
                </div>

                {/* Real-time State Alert */}
                {isSignedByRider ? (
                  (() => {
                    const riderRemitted = sessionStatus?.riderRemittedAmount ?? 0;
                    const expected = sessionStatus?.expectedAmount ?? expectedAmount;
                    const isExact = riderRemitted === expected;
                    const isShort = riderRemitted < expected;
                    const diff = Math.abs(expected - riderRemitted);

                    return (
                      <div
                        className={`p-3 rounded-lg space-y-1 ${
                          isExact
                            ? "bg-emerald-50 border border-emerald-300 text-emerald-900 animate-pulse"
                            : "bg-rose-50 border border-rose-300 text-rose-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                          {isExact ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                          )}
                          <span>
                            ✍️ Signed by {sessionStatus?.riderSignedBy || riderName}
                          </span>
                        </div>
                        {isExact ? (
                          <div className="text-xs font-mono text-emerald-800">
                            Declared Amount: ₱{riderRemitted.toLocaleString()}
                          </div>
                        ) : (
                          <div className="text-xs font-semibold text-rose-800">
                            ⚠️ {isShort ? `SHORT BY ₱${diff.toLocaleString()}` : `OVER BY ₱${diff.toLocaleString()}`} (Expected ₱{expected.toLocaleString()} • Rider Declared ₱{riderRemitted.toLocaleString()})
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : isValidated ? (
                  <div className="p-3 bg-emerald-100 border border-emerald-400 rounded-lg text-emerald-900 text-xs font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Validated & placed in staff drawer!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    <Clock className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Waiting for rider to scan and submit signature...</span>
                  </div>
                )}

                {/* Primary Validate Button & Reject Button */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleStaffValidate(false)}
                    disabled={!isSignedByRider || staffValidateMutation.isPending || rejectRiderMutation.isPending}
                    className={`flex-1 font-bold text-xs sm:text-sm h-11 ${
                      isSignedByRider
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-bounce"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {staffValidateMutation.isPending
                      ? "Validating Bills..."
                      : "✅ Validate & Receive into Drawer"}
                  </Button>

                  {isSignedByRider && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRejectRiderSignature}
                      disabled={rejectRiderMutation.isPending || staffValidateMutation.isPending}
                      className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 h-11 font-semibold text-xs px-3"
                    >
                      {rejectRiderMutation.isPending ? "Rejecting..." : "🔄 Ask Rider to Re-enter"}
                    </Button>
                  )}
                </div>

                {/* Collapsible Manual Counter Override (Phone Dead) */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowOverride(!showOverride)}
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-medium text-slate-700 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Manual Counter Override (Phone Battery Dead)
                    </span>
                    {showOverride ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {showOverride && (
                    <div className="p-3 bg-white space-y-3 border-t border-slate-200 text-xs">
                      <p className="text-slate-500 text-[11px]">
                        If rider&apos;s phone has no battery or camera, confirm their name and count the cash bills manually at the counter.
                      </p>

                      <div className="space-y-1">
                        <Label htmlFor="override-rider" className="text-[11px] font-semibold text-slate-700">
                          Rider Name
                        </Label>
                        <Input
                          id="override-rider"
                          value={overrideRiderName}
                          onChange={(e) => setOverrideRiderName(e.target.value)}
                          placeholder="e.g., Kuya Berto"
                          className="h-8 text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="override-amount" className="text-[11px] font-semibold text-slate-700">
                          Counted Peso Amount (₱)
                        </Label>
                        <Input
                          id="override-amount"
                          type="number"
                          value={overrideAmount}
                          onChange={(e) =>
                            setOverrideAmount(
                              e.target.value === "" ? "" : Number(e.target.value)
                            )
                          }
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleStaffValidate(true)}
                        disabled={staffValidateMutation.isPending}
                        variant="secondary"
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs h-9"
                      >
                        {staffValidateMutation.isPending
                          ? "Saving..."
                          : "✅ Validate & Receive into Drawer (Override)"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================== */}
        {/* HOP 2: STAFF TO OWNER CONTENT */}
        {/* =================================================== */}
        {hopStage === "StaffToOwner" && (
          <div className="space-y-4 py-1">
            {/* Custody Summary Card */}
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-purple-900 font-medium">Currently Held in Drawer By:</span>
                <span className="font-bold text-purple-950 bg-purple-200/60 px-2 py-0.5 rounded">
                  {heldByStaffName || "Store Cashier"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-900 font-medium">Rider Origin:</span>
                <span className="font-semibold text-purple-950">
                  {riderSignedBy || riderName || "Walk-in Store Pickup"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-purple-200 text-sm">
                <span className="font-bold text-purple-950">Turnover Net Amount:</span>
                <span className="font-mono font-black text-emerald-700 text-base">
                  ₱{expectedAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* QR Code for Owner Mobile Scan */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
              {sessionToken ? (
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                  <QRCodeSVG value={qrUrl} size={180} includeMargin />
                </div>
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-xs text-muted-foreground">
                  Generating Owner Verification QR...
                </div>
              )}
              <p className="text-[11px] font-medium text-slate-500 mt-2 text-center max-w-xs">
                Owner can scan this code with their smartphone to review and verify turnover.
              </p>
            </div>

            {/* Owner Live Approval Status */}
            {isApproved ? (
              <div className="p-3 bg-emerald-100 border border-emerald-400 rounded-lg text-emerald-950 text-xs font-bold text-center">
                ✅ Verified & Approved by {sessionStatus?.ownerApprovedBy || "Owner"}! Closing ledger...
              </div>
            ) : (
              /* Owner PC Shortcut Card with Counted-Amount Speed Bump */
              isOwner && (
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Owner PC Verification & Settlement ({user?.fullName || "Owner"})</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="owner-counted-bills" className="text-xs font-semibold text-slate-800">
                      Physical Bills Counted in Envelope (₱) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="owner-counted-bills"
                      type="number"
                      step="any"
                      value={countedBills}
                      onChange={(e) => setCountedBills(e.target.value)}
                      placeholder={`Enter exact ₱${expectedAmount.toLocaleString()}`}
                      className="font-mono text-sm bg-white"
                    />
                    {countedBills !== "" && Number(countedBills) !== (sessionStatus?.expectedAmount ?? expectedAmount) && (
                      <p className="text-xs text-rose-600 font-medium pt-0.5">
                        Counted bills (₱{Number(countedBills).toLocaleString()}) do not match expected remittance (₱{(sessionStatus?.expectedAmount ?? expectedAmount).toLocaleString()}). Recount envelope before closing.
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={handleOwnerQuickApprove}
                    disabled={
                      countedBills === "" ||
                      Number(countedBills) !== (sessionStatus?.expectedAmount ?? expectedAmount) ||
                      ownerApproveMutation.isPending
                    }
                    className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm h-10 shadow-md"
                  >
                    {ownerApproveMutation.isPending
                      ? "Closing Ledger..."
                      : `👑 Confirm & Close Order #${orderId}`}
                  </Button>
                </div>
              )
            )}

            {/* Custody Reversion Trigger */}
            {canRevertCustody && (
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[11px] text-slate-500">
                  Drawer custody error?
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRevertCustody}
                  disabled={revertCustodyMutation.isPending}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs h-8"
                >
                  {revertCustodyMutation.isPending ? "Reverting..." : "↩️ Revert Custody to Uncollected"}
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="sm:space-x-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
