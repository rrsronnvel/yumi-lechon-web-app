import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { useOverrideScheduleMutation, RoastingScheduleItem } from "@/hooks/useSchedules";
import { useRidersQuery, useCreateRiderMutation } from "@/hooks/useRiders";
import { Clock, User, MapPin, Package, FileText, Calendar, Phone } from "lucide-react";

import axios from "axios";

interface InlineScheduleEditorModalProps {
  item: RoastingScheduleItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatToHHMM = (timeString?: string | null): string => {
  if (!timeString) return "";
  try {
    if (timeString.length <= 8 && timeString.includes(":")) {
      const [h, m] = timeString.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    const d = new Date(timeString);
    if (isNaN(d.getTime())) return "";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "";
  }
};

const formatReadableDate = (timeString?: string | null): string => {
  if (!timeString) return "-";
  try {
    const d = new Date(timeString);
    if (isNaN(d.getTime())) return timeString;
    return d.toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return timeString;
  }
};

const buildIsoTime = (referenceDateStr: string | undefined, timeHHMM: string): string | undefined => {
  if (!timeHHMM) return undefined;
  let baseDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  if (isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }
  const [hours, minutes] = timeHHMM.split(":").map(Number);
  const combined = new Date(baseDate.getTime());
  combined.setHours(hours, minutes, 0, 0);
  return combined.toISOString();
};

export function InlineScheduleEditorModal({
  item,
  open,
  onOpenChange,
}: InlineScheduleEditorModalProps) {
  const { data: registeredRiders = [] } = useRidersQuery();
  const createRiderMutation = useCreateRiderMutation();

  const [tahiTime, setTahiTime] = useState("");
  const [salangTime, setSalangTime] = useState("");
  const [packagingTime, setPackagingTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [remarks, setRemarks] = useState("");

  const overrideMutation = useOverrideScheduleMutation();

  useEffect(() => {
    if (item && open) {
      setTahiTime(formatToHHMM(item.tahiStartTime));
      setSalangTime(formatToHHMM(item.salangStartTime));
      setPackagingTime(formatToHHMM(item.packagingStartTime));
      setDepartureTime(
        formatToHHMM(item.riderDepartureTime ?? item.targetDeliveryTime)
      );
      const currentRider =
        item.riderName && item.riderName !== "Unassigned" ? item.riderName : "";
      setRiderName(currentRider);

      // Auto-fill phone from registry or item
      const matched = registeredRiders.find(
        (r) => r.fullName.toLowerCase() === currentRider.trim().toLowerCase()
      );
      setRiderPhone(matched ? matched.phoneNumber : item.riderPhone || "");
      setRemarks(item.remarks || "");
    }
  }, [item, open, registeredRiders]);

  if (!item) return null;

  const targetId = item.orderItemId || item.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const refDate = item.targetDeliveryTime || item.tahiStartTime;
      await overrideMutation.mutateAsync({
        orderItemId: targetId,
        tahiStartTime: buildIsoTime(refDate, tahiTime),
        salangStartTime: buildIsoTime(refDate, salangTime),
        packagingStartTime: buildIsoTime(refDate, packagingTime),
        riderDepartureTime:
          item.fulfillment === 0
            ? undefined
            : buildIsoTime(refDate, departureTime),
        riderName: riderName.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      // Auto-save new ad-hoc rider to registry if phone and name are provided
      const cleanName = riderName.trim();
      const cleanPhone = riderPhone.trim();
      if (cleanName && cleanPhone && cleanName !== "Unassigned") {
        const alreadyRegistered = registeredRiders.some(
          (r) => r.fullName.toLowerCase() === cleanName.toLowerCase()
        );
        if (!alreadyRegistered) {
          try {
            await createRiderMutation.mutateAsync({
              fullName: cleanName,
              phoneNumber: cleanPhone,
            });
          } catch {
            // Ignore registry save error if duplicate
          }
        }
      }

      toast.success(
        `Schedule overridden for ${item.customerName || `Order #${item.orderId || item.id}`}`
      );
      onOpenChange(false);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || "Failed to update schedule override."
        );
      } else {
        toast.error("Failed to update schedule override.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <DialogTitle>Production & Logistics Override</DialogTitle>
          </div>
          <DialogDescription>
            Manually level production timings or assign a delivery rider for Order #{item.orderReference || item.orderId || item.id}.
          </DialogDescription>
        </DialogHeader>

        {/* Read-Only Dossier Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5" /> Customer Name
              </span>
              <p className="font-semibold text-slate-900 text-sm">{item.customerName || "-"}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <Package className="w-3.5 h-3.5" /> Size & Weight
              </span>
              <p className="font-semibold text-slate-900 text-sm">
                {item.size || "-"} {item.weight ? `(${item.weight.replace(/\s*kg\b/gi, "").replace(/\.00\b/g, "").replace(/\.0\b/g, "").trim()})` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
            <div className="space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5" /> Target Delivery Time
              </span>
              <p className="font-semibold text-red-600">{formatReadableDate(item.targetDeliveryTime)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5" /> Destination Address
              </span>
              <p className="font-medium text-slate-800 line-clamp-2" title={item.location}>
                {item.location || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tahiTime" className="text-xs font-semibold text-slate-700">
                Tahi Time
              </Label>
              <Input
                id="tahiTime"
                type="time"
                value={tahiTime}
                onChange={(e) => setTahiTime(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="salangTime" className="text-xs font-semibold text-slate-700">
                Salang Time
              </Label>
              <Input
                id="salangTime"
                type="time"
                value={salangTime}
                onChange={(e) => setSalangTime(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="packagingTime" className="text-xs font-semibold text-slate-700">
                Packaging Time
              </Label>
              <Input
                id="packagingTime"
                type="time"
                value={packagingTime}
                onChange={(e) => setPackagingTime(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="departureTime" className="text-xs font-semibold text-amber-900">
                Departure / Pickup
              </Label>
              <Input
                id="departureTime"
                type="time"
                disabled={item.fulfillment === 0}
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="font-mono text-sm border-amber-300 disabled:bg-stone-100"
              />
            </div>
          </div>

          {/* Rider Selection & Ad-Hoc Entry */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Assigned Rider
              </Label>
              {riderName && riderName !== "Unassigned" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRiderName("");
                    setRiderPhone("");
                    toast.info("Rider unassigned. Click Save Overrides to apply.");
                  }}
                  className="h-6 text-[11px] px-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  Unassign Rider
                </Button>
              )}
            </div>

            {item.fulfillment === 0 && (
              <div className="p-2 rounded-md bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium">
                🏪 Store Pickup — Non-delivery order. Freelance rider assignment is disabled.
              </div>
            )}

            {item.fulfillment === 2 && (
              <div className="p-2 rounded-md bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium">
                📦 Lalamove Courier — Customer-booked courier. Freelance rider assignment is disabled.
              </div>
            )}

            <div className="space-y-1.5">
              <select
                disabled={item.fulfillment === 0 || item.fulfillment === 2}
                className="w-full h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:bg-stone-100"
                value={
                  registeredRiders.find(
                    (r) => r.fullName.toLowerCase() === riderName.trim().toLowerCase()
                  )?.id || ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    return;
                  }
                  const selected = registeredRiders.find((r) => r.id === Number(val));
                  if (selected) {
                    setRiderName(selected.fullName);
                    setRiderPhone(selected.phoneNumber);
                  }
                }}
              >
                <option value="">-- Select from Rider Registry --</option>
                {registeredRiders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} ({r.phoneNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <Label htmlFor="riderName" className="text-[11px] font-medium text-slate-600">
                  Rider Name
                </Label>
                <Input
                  id="riderName"
                  type="text"
                  placeholder="e.g., Kuya Boy"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  disabled={item.fulfillment === 0 || item.fulfillment === 2}
                  className="h-8 text-xs bg-white disabled:opacity-50 disabled:bg-stone-100"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="riderPhone" className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Contact Phone
                </Label>
                <Input
                  id="riderPhone"
                  type="text"
                  placeholder="e.g., 09171234567"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  disabled={item.fulfillment === 0 || item.fulfillment === 2}
                  className="h-8 text-xs font-mono bg-white disabled:opacity-50 disabled:bg-stone-100"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remarks" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Dispatch Remarks
            </Label>
            <Input
              id="remarks"
              type="text"
              placeholder="e.g., Spicy belly, extra crispy, call before arrival"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={overrideMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={overrideMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {overrideMutation.isPending ? "Saving..." : "Save Overrides"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InlineScheduleEditorModal;
