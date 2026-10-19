import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  useQrSessionStatusQuery,
  useRiderSignQrMutation,
  useOwnerApproveQrMutation,
} from "@/hooks/useManifest";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Camera,
  User,
  Banknote,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export default function QrSignPage() {
  const { token } = useParams<{ token: string }>();
  const {
    data: session,
    isLoading,
    isError,
    error,
  } = useQrSessionStatusQuery(token || null, true);

  const riderSignMutation = useRiderSignQrMutation();
  const ownerApproveMutation = useOwnerApproveQrMutation();

  // Rider Form State
  const [riderName, setRiderName] = useState("");
  const [remittedAmount, setRemittedAmount] = useState<number | "">("");
  const [wasRejected, setWasRejected] = useState(false);
  const prevStatusRef = React.useRef<string | undefined>(undefined);

  // Owner Form State
  const [ownerCountedBills, setOwnerCountedBills] = useState<number | "">("");
  const [ownerPin, setOwnerPin] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("owner");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize rider form values once session is loaded & track rejection
  useEffect(() => {
    if (session) {
      if (prevStatusRef.current === "SignedByRider" && session.status === "PendingScan") {
        setWasRejected(true);
      } else if (session.wasRejected) {
        setWasRejected(true);
      }
      prevStatusRef.current = session.status;

      if (!riderName) {
        setRiderName(
          session.assignedRiderName && session.assignedRiderName !== "Unassigned"
            ? session.assignedRiderName
            : session.riderSignedBy || ""
        );
      }
      if (remittedAmount === "") {
        setRemittedAmount(session.expectedAmount);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleRiderSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!riderName.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    const amountNum = Number(remittedAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error("Please enter a valid remittance amount.");
      return;
    }

    setErrorMessage(null);
    setWasRejected(false);
    riderSignMutation.mutate(
      {
        token,
        riderName: riderName.trim(),
        remittedAmount: amountNum,
      },
      {
        onSuccess: () => {
          toast.success("Signature submitted successfully!");
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message || "Failed to submit digital signature.";
          setErrorMessage(msg);
          toast.error("Submission failed", { description: msg });
        },
      }
    );
  };

  const handleOwnerApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !session) return;

    const countedNum = Number(ownerCountedBills);
    if (ownerCountedBills === "" || countedNum !== session.expectedAmount) {
      toast.error("Counted envelope bills do not match expected remittance amount.");
      return;
    }

    if (!ownerPin.trim()) {
      toast.error("Please enter the Owner Password or PIN.");
      return;
    }

    setErrorMessage(null);
    ownerApproveMutation.mutate(
      {
        token,
        countedAmount: countedNum,
        ownerPinOrPassword: ownerPin.trim(),
        ownerUsername: ownerUsername.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Order settlement approved!");
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message || "Owner approval failed. Check password/PIN.";
          setErrorMessage(msg);
          toast.error("Approval Rejected", { description: msg });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <img
            src="/yumi-logo.png"
            alt="Yumi's Lechon Logo"
            className="w-12 h-12 rounded-full object-cover mx-auto ring-2 ring-amber-400/80 shadow-md"
          />
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-stone-600">
            Validating secure session token...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 bg-white rounded-xl shadow-sm">
          <CardHeader className="text-center space-y-2">
            <img
              src="/yumi-logo.png"
              alt="Yumi's Lechon Logo"
              className="w-9 h-9 rounded-full object-cover mx-auto ring-2 ring-amber-400/80 shadow-sm"
            />
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-rose-800">
              Invalid or Expired QR Session
            </CardTitle>
            <CardDescription className="text-stone-600">
              {// eslint-disable-next-line @typescript-eslint/no-explicit-any
              (error as any)?.response?.data?.message ||
                "This QR code has expired or is no longer valid. Please ask the counter staff to regenerate a new QR code on the register."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isExpired = session.isExpired || session.status === "Expired";

  if (isExpired && session.status !== "ValidatedByStaff" && session.status !== "ApprovedByOwner") {
    return (
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-amber-300 bg-white rounded-xl shadow-sm">
          <CardHeader className="text-center space-y-2">
            <img
              src="/yumi-logo.png"
              alt="Yumi's Lechon Logo"
              className="w-9 h-9 rounded-full object-cover mx-auto ring-2 ring-amber-400/80 shadow-sm"
            />
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-1">
              <Clock className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-amber-900">
              QR Session Expired
            </CardTitle>
            <CardDescription className="text-stone-600">
              For security, QR settlement sessions expire after 10 minutes. Please ask the store cashier to generate a fresh QR code.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // ========================================================
  // HOP 1: RIDER TO STAFF HANDSHAKE
  // ========================================================
  if (session.hopStage === "RiderToStaff") {
    // State 3: Validated By Staff -> Full Screen High Contrast Digital Handover Receipt
    if (session.status === "ValidatedByStaff" || session.status === "ApprovedByOwner") {
      const formattedTimestamp = session.staffValidatedAt
        ? new Date(session.staffValidatedAt).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : new Date().toLocaleString("en-PH");

      return (
        <div className="min-h-screen bg-emerald-700 text-white p-4 sm:p-6 flex flex-col justify-center items-center font-sans">
          <div className="w-full max-w-md space-y-6">
            {/* Header / Seal */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <img
                  src="/yumi-logo.png"
                  alt="Yumi's Lechon Logo"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400 shadow-md"
                />
                <span className="text-xs font-extrabold tracking-widest uppercase text-amber-300">
                  YUMI&apos;S LECHON
                </span>
              </div>
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto border-2 border-white/40 shadow-lg">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <span className="inline-block px-3 py-1 bg-white/20 text-xs tracking-wider uppercase font-extrabold rounded-full backdrop-blur-sm border border-white/30">
                Official Settlement Proof
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                OFFICIAL RIDER HANDOVER RECEIPT
              </h1>
              <p className="text-emerald-100 text-xs">
                Physical funds verified and transferred into store drawer custody.
              </p>
            </div>

            {/* Receipt Card */}
            <div className="bg-white text-stone-900 rounded-2xl p-6 shadow-2xl space-y-5 border border-white/50">
              <div className="border-b border-dashed border-stone-300 pb-4 flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase font-semibold text-stone-400">
                    Order Reference
                  </span>
                  <div className="text-2xl font-black text-stone-900">
                    #{session.orderId}
                  </div>
                  <div className="text-xs text-stone-500 font-medium">
                    {session.customerName}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase font-semibold text-stone-400">
                    Handover Status
                  </span>
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> CLEARED
                    </span>
                  </div>
                </div>
              </div>

              {/* Remittance Amount */}
              <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                  Remitted Net Amount
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-700 mt-1">
                  ₱{(session.riderRemittedAmount ?? session.expectedAmount).toLocaleString()}
                </div>
                <span className="text-[11px] text-emerald-600 font-medium">
                  Payment Method: {session.paymentMethod}
                </span>
              </div>

              {/* Custody Parties */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-stone-500 font-medium">Rider Signature:</span>
                  <span className="font-bold text-stone-800">
                    {session.riderSignedBy || session.assignedRiderName || "Freelance Rider"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-stone-500 font-medium">Validated by Cashier:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                    {session.staffValidatedBy || "Store Cashier"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-100 text-xs">
                  <span className="text-stone-500 font-medium">Handover Timestamp:</span>
                  <span className="font-mono text-stone-700">
                    {formattedTimestamp}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 text-xs font-mono text-stone-400">
                  <span>Cryptographic Token:</span>
                  <span>{session.token.substring(0, 12)}...</span>
                </div>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center gap-3 text-white text-xs sm:text-sm">
              <Camera className="w-6 h-6 flex-shrink-0 text-amber-300 animate-pulse" />
              <div>
                <span className="font-bold text-amber-300">Rider Action: </span>
                📸 Take a screenshot of this receipt for your personal proof of cash turnover.
              </div>
            </div>
          </div>
        </div>
      );
    }

    // State 2: Signed by Rider -> Waiting for Counter Staff to count bills
    if (session.status === "SignedByRider") {
      return (
        <div className="min-h-screen bg-[#181312] text-white flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-stone-900 border-amber-500/50 shadow-2xl text-white rounded-xl">
            <CardHeader className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <img
                  src="/yumi-logo.png"
                  alt="Yumi's Lechon Logo"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/80 shadow-sm"
                />
                <span className="text-xs font-extrabold tracking-widest uppercase text-amber-400">
                  YUMI&apos;S LECHON
                </span>
              </div>
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/40 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 uppercase text-xs mx-auto">
                Step 1 Complete
              </Badge>
              <CardTitle className="text-2xl font-bold text-amber-300">
                Signature Submitted!
              </CardTitle>
              <CardDescription className="text-stone-300 text-sm">
                Order #{session.orderId} • {session.customerName}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 text-center">
              <div className="p-4 bg-[#181312] rounded-xl border border-stone-800 space-y-2">
                <span className="text-xs uppercase font-semibold text-stone-400">
                  Declared Cash Remittance
                </span>
                <div className="text-3xl font-mono font-black text-amber-400">
                  ₱{(session.riderRemittedAmount ?? session.expectedAmount).toLocaleString()}
                </div>
                <div className="text-xs text-stone-400 font-medium">
                  Signed by:{" "}
                  <strong className="text-stone-200">
                    {session.riderSignedBy}
                  </strong>
                </div>
              </div>

              <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200 text-xs sm:text-sm text-left flex items-start gap-3">
                <span className="text-lg">⏳</span>
                <p>
                  Hand the cash bills to the cashier at the counter. The cashier is currently counting the money and will click <strong>Validate & Receive into Drawer</strong>. This screen will automatically update to your receipt!
                </p>
              </div>

              <div className="text-xs text-stone-500">
                Polling counter status in real time...
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // State 1: PendingScan -> Rider Signature Form
    return (
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-stone-200/90 bg-white rounded-xl overflow-hidden">
          <CardHeader className="bg-[#181312] text-white space-y-2.5 p-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <img
                  src="/yumi-logo.png"
                  alt="Yumi's Lechon Logo"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/80 shadow-sm shrink-0"
                />
                <Badge className="bg-emerald-600 text-white text-xs">
                  Hop 1: Rider Handover
                </Badge>
              </div>
              <span className="text-xs text-stone-400 font-mono">
                Order #{session.orderId}
              </span>
            </div>
            <CardTitle className="text-xl font-bold text-white">
              Digital Cash Handover Signature
            </CardTitle>
            <CardDescription className="text-stone-300 text-xs">
              Customer: {session.customerName}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {wasRejected && (
              <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>⚠️ The cashier requested you re-check and re-submit your remittance amount.</span>
              </div>
            )}

            {/* Amount Summary */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                Expected Net Remittance
              </span>
              <div className="text-3xl font-mono font-black text-emerald-700">
                ₱{session.expectedAmount.toLocaleString()}
              </div>
              <span className="text-xs text-emerald-600 font-medium">
                Payment Channel: {session.paymentMethod}
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                {errorMessage}
              </div>
            )}

            {/* Signature Input Form */}
            <form onSubmit={handleRiderSign} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="riderName" className="text-sm font-semibold text-stone-800">
                  Rider Full Name <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <Input
                    id="riderName"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    placeholder="e.g. Kuya Berto"
                    className="pl-9 h-10 font-medium border-stone-300"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="remittedAmount"
                  className="text-sm font-semibold text-stone-800"
                >
                  Exact Amount Remitted (₱) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Banknote className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <Input
                    id="remittedAmount"
                    type="number"
                    step="any"
                    value={remittedAmount}
                    onChange={(e) =>
                      setRemittedAmount(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="Enter peso amount"
                    className="pl-9 h-10 font-mono font-bold text-lg border-stone-300"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={riderSignMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base shadow-md"
              >
                {riderSignMutation.isPending ? (
                  "Submitting Signature..."
                ) : (
                  <>
                    <span>✍️ Sign & Submit Handover</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-[11px] text-center text-stone-500 leading-tight">
              By tapping submit, you legally attest that you have handed this exact peso amount to the store counter staff.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========================================================
  // HOP 2: STAFF TO OWNER VERIFICATION & SETTLEMENT
  // ========================================================
  if (session.hopStage === "StaffToOwner") {
    // If already approved
    if (session.status === "ApprovedByOwner") {
      return (
        <div className="min-h-screen bg-[#181312] text-white flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-stone-900 border-emerald-500 text-white text-center p-6 space-y-4 rounded-xl">
            <img
              src="/yumi-logo.png"
              alt="Yumi's Lechon Logo"
              className="w-11 h-11 rounded-full object-cover mx-auto ring-2 ring-amber-400/80 shadow-md"
            />
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <CardTitle className="text-2xl font-black text-emerald-400">
              ✅ Order #{session.orderId} Officially Settled & Closed
            </CardTitle>
            <p className="text-sm text-stone-300">
              Owner verification complete. The financial payment log has been recorded and custody cleared.
            </p>
            <div className="p-3 bg-[#181312] rounded-lg text-xs space-y-1 font-mono text-stone-400">
              <div>Approved By: {session.ownerApprovedBy || "Owner"}</div>
              <div>
                Amount: ₱{(session.expectedAmount).toLocaleString()} ({session.paymentMethod})
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // StaffToOwner verification screen
    return (
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-stone-200/90 bg-white rounded-xl overflow-hidden">
          <CardHeader className="bg-[#181312] text-white space-y-2 p-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <img
                  src="/yumi-logo.png"
                  alt="Yumi's Lechon Logo"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/80 shadow-sm shrink-0"
                />
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs">
                  👑 Hop 2: Owner Verification
                </Badge>
              </div>
              <span className="text-xs text-stone-300 font-mono">
                Order #{session.orderId}
              </span>
            </div>
            <CardTitle className="text-xl font-bold">
              Business Owner Remittance Approval
            </CardTitle>
            <CardDescription className="text-stone-300 text-xs">
              Verify staff drawer turnover and close order ledger
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Custody Chain Trail */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-stone-500 font-medium">Customer:</span>
                <span className="font-bold text-stone-800">
                  {session.customerName}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-stone-500 font-medium">Rider Origin:</span>
                <span className="font-semibold text-stone-800">
                  {session.riderSignedBy || session.assignedRiderName || "Walk-in Counter"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <span className="text-stone-500 font-medium">Held in Drawer By:</span>
                <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                  {session.staffValidatedBy || "Staff Cashier"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-base">
                <span className="font-bold text-stone-900">Total to Receive:</span>
                <span className="font-mono font-black text-2xl text-emerald-600">
                  ₱{session.expectedAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                {errorMessage}
              </div>
            )}

            {/* Owner Pin Form */}
            <form onSubmit={handleOwnerApprove} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="countedBills"
                  className="text-sm font-semibold text-stone-800"
                >
                  Physical Bills Counted in Envelope (₱) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Banknote className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <Input
                    id="countedBills"
                    type="number"
                    step="any"
                    value={ownerCountedBills}
                    onChange={(e) =>
                      setOwnerCountedBills(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="Enter exact counted bills"
                    className="pl-9 h-10 font-mono font-bold text-lg border-stone-300"
                    required
                  />
                </div>
                {ownerCountedBills !== "" && Number(ownerCountedBills) !== session.expectedAmount && (
                  <p className="text-xs text-rose-600 font-medium pt-0.5">
                    Counted bills (₱{Number(ownerCountedBills).toLocaleString()}) do not match expected remittance (₱{session.expectedAmount.toLocaleString()}). Recount envelope before closing.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerUsername" className="text-xs font-semibold text-stone-700">
                  Owner Username
                </Label>
                <Input
                  id="ownerUsername"
                  value={ownerUsername}
                  onChange={(e) => setOwnerUsername(e.target.value)}
                  placeholder="owner"
                  className="font-medium text-sm h-10 border-stone-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerPin" className="text-sm font-semibold text-stone-800">
                  Owner Password / Master PIN <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <Input
                    id="ownerPin"
                    type="password"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder="Enter owner credentials..."
                    className="pl-9 h-10 font-medium border-stone-300"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={
                  ownerCountedBills === "" ||
                  Number(ownerCountedBills) !== session.expectedAmount ||
                  ownerApproveMutation.isPending
                }
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white font-bold h-12 text-base shadow-md"
              >
                {ownerApproveMutation.isPending ? (
                  "Verifying & Closing..."
                ) : (
                  <>
                    <span>👑 Owner Approve & Settle</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
