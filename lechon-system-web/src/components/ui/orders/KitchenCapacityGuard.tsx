import type { useKitchenCapacityBooking } from "@/hooks/useKitchenCapacityBooking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capacityStatusText, capacityTone, formatCapacityTime, getBatchSlotTimes, toCapacityFormTime } from "@/utils/kitchenCapacity";
import { cn } from "@/lib/utils";

interface KitchenCapacityGuardProps {
  capacity: ReturnType<typeof useKitchenCapacityBooking>;
  onScheduleChange: (targetTime: string, riderDepartureTime: string) => void;
}

export function KitchenCapacityGuard({ capacity, onScheduleChange }: KitchenCapacityGuardProps) {
  if (!capacity.enabled) return null;

  const { day, result, isOwner, isChecking, isError, branch, date } = capacity;
  if (!result && !isChecking && !isError && day?.mode !== "PeakHoliday" &&
      !day?.isHalfDayHoliday && (day?.activeBranches.length ?? 0) < 2) return null;
  const chooseSlot = (targetTime: string, riderDepartureTime: string, code?: string | null) => {
    capacity.setBatch(code ? { code, branch, targetTime, riderDepartureTime } : undefined);
    capacity.setApproved(false);
    onScheduleChange(targetTime, riderDepartureTime);
  };

  return (
    <section className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs" aria-label="Roasting capacity">
      {(day?.activeBranches.length ?? 0) > 1 && (
        <Label className="flex flex-wrap items-center gap-2 font-semibold">
          Roasting branch
          <select className="rounded border border-stone-300 bg-white px-2 py-1" value={branch} onChange={(event) => {
            capacity.setBranch(event.target.value);
            capacity.setBatch(undefined);
            capacity.setApproved(false);
          }}>
            {day?.activeBranches.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </Label>
      )}
      {day?.mode === "PeakHoliday" && (
        <div className="flex flex-wrap gap-1.5" aria-label="Peak holiday batches">
          {day.batches.map((slot) => (
            <button
              key={slot.batchCode}
              type="button"
              aria-pressed={capacity.batchCode === slot.batchCode}
              className={cn("rounded-md border px-2 py-1.5 text-left font-semibold", capacityTone[slot.status], capacity.batchCode === slot.batchCode && "ring-2 ring-stone-800 ring-offset-1")}
              onClick={() => {
                const times = getBatchSlotTimes(date, slot, capacity.targetTime, capacity.riderDepartureTime);
                chooseSlot(times.targetTime, times.riderDepartureTime, slot.batchCode);
              }}
            >
              {formatCapacityTime(slot.anchorTime)} · {slot.remainingPits} left
            </button>
          ))}
        </div>
      )}
      {day?.isHalfDayHoliday && <p className="font-semibold text-amber-900">Dec 25 Half-Day Ops (Cooking until 12:00 NN)</p>}
      <div aria-live="polite">
        {isChecking ? (
          <p className="font-semibold text-stone-600">Checking pit capacity…</p>
        ) : result ? (
          <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 font-bold", capacityTone[result.status])}>
            <span>
              {result.status === "Open" ? (
                <>✅ {result.projectedPits}/{result.maxPits} pits used ({result.remainingAfter} left)</>
              ) : result.requiresOwnerOverride ? (
                <>🚫 Batch/Slot Full ({result.currentPits}/{result.maxPits} pits, {result.projectedPits} projected). {isOwner ? "Choose another time or approve below." : "Pick another time or ask Owner."}</>
              ) : (
                <>{capacityStatusText[result.status]} ({result.projectedPits}/{result.maxPits} pits)</>
              )}
            </span>
            {result.suggestedNextSlot && (
              <Button size="xs" type="button" variant="outline" title={result.suggestedNextSlot.label} onClick={() => {
                const slot = result.suggestedNextSlot;
                if (slot) chooseSlot(toCapacityFormTime(slot.date, slot.targetTime), toCapacityFormTime(slot.date, slot.riderDepartureTime), slot.batchCode);
              }}>Use Next Open Slot</Button>
            )}
          </div>
        ) : isError ? (
          <p className="font-semibold text-amber-900">Live pit capacity is unavailable. Capacity will be checked when you save.</p>
        ) : null}
      </div>
      {isOwner && result?.requiresOwnerOverride && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 font-semibold text-stone-900">
            <input type="checkbox" checked={capacity.approved} onChange={(event) => capacity.setApproved(event.target.checked)} />
            👑 Owner Override: {result.canFitWithOwnerSqueeze
              ? `Allow Squeeze (up to ${day?.branch.maxSqueezeBelliesPerPit ?? 4} bellies/pit, ${result.squeezedProjectedPits}/${result.maxPits} pits)`
              : "Force-Book"}
          </label>
          {capacity.approved && <Input aria-label="Override note" placeholder="Override note (optional)" maxLength={250} value={capacity.reason} onChange={(event) => capacity.setReason(event.target.value)} />}
        </div>
      )}
    </section>
  );
}
