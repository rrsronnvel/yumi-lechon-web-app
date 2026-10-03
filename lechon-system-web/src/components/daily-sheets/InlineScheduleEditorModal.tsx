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
import { Clock, User, MapPin, Package, FileText, Calendar } from "lucide-react";

import axios from "axios";

interface InlineScheduleEditorModalProps {
  item: RoastingScheduleItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatToHHMM = (timeString?: string): string => {
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

const formatReadableDate = (timeString?: string): string => {
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
  const [tahiTime, setTahiTime] = useState("");
  const [salangTime, setSalangTime] = useState("");
  const [packagingTime, setPackagingTime] = useState("");
  const [riderName, setRiderName] = useState("");
  const [remarks, setRemarks] = useState("");

  const overrideMutation = useOverrideScheduleMutation();

  useEffect(() => {
    if (item && open) {
      setTahiTime(formatToHHMM(item.tahiStartTime));
      setSalangTime(formatToHHMM(item.salangStartTime));
      setPackagingTime(formatToHHMM(item.packagingStartTime));
      setRiderName(item.riderName && item.riderName !== "Unassigned" ? item.riderName : "");
      setRemarks(item.remarks || "");
    }
  }, [item, open]);

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
        riderName: riderName.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      toast.success(`Schedule overridden for ${item.customerName || `Order #${item.orderId || item.id}`}`);
      onOpenChange(false);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "Failed to update schedule override.");
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
            Manually level production timings or assign a delivery rider for Order #{item.orderId || item.id}.
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
                {item.size || "-"} {item.weight ? `(${item.weight})` : ""}
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
          <div className="grid grid-cols-3 gap-3">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="riderName" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Assigned Rider Name
            </Label>
            <Input
              id="riderName"
              type="text"
              placeholder="e.g., Kuya Boy, John Doe"
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
            />
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
