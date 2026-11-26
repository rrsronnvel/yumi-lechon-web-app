import type { KitchenCapacityDay } from "@/hooks/useKitchenCapacity";
import { capacityStatusText, capacityTone, formatCapacityTime } from "@/utils/kitchenCapacity";
import { cn } from "@/lib/utils";

interface KitchenCapacityMonitorProps {
  day?: KitchenCapacityDay;
  branches: KitchenCapacityDay["activeBranches"];
  selectedBranch?: string;
  onBranchChange: (branch: string) => void;
  isError: boolean;
}

export function KitchenCapacityMonitor({ day, branches, selectedBranch, onBranchChange, isError }: KitchenCapacityMonitorProps) {
  const continuous = day?.mode === "Continuous";
  const blocks = continuous ? day.timeBlocks : day?.batches;
  return (
    <section aria-label="Kitchen capacity" className="mb-3 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-stone-900">🔥 {day ? `${day.branch.totalPits}-Pit` : "Kitchen"} Capacity {day && `· ${day.branch.name}`}</h2>
        {branches.length > 1 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            Roasting branch
            <select className="rounded border border-stone-300 bg-white px-2 py-1" value={selectedBranch} onChange={(event) => onBranchChange(event.target.value)}>
              {branches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {!day && <p className="text-xs text-stone-600">{isError ? "Could not load live pit capacity." : "Loading pit capacity…"}</p>}
      {day?.isHalfDayHoliday && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-bold text-amber-950">Dec 25 Half-Day Ops (Cooking until 12:00 NN)</p>}
      {continuous && (
        <div className="grid gap-1.5 text-xs font-bold text-stone-800 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
          <span>Peak concurrent load · {day.peakConcurrentPits}/{day.branch.totalPits} pits</span>
          <progress aria-label="Peak concurrent pit load" max={day.branch.totalPits} value={day.peakConcurrentPits} className="h-2 w-full accent-amber-600" />
        </div>
      )}
      {blocks && blocks.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:[grid-template-columns:repeat(auto-fit,minmax(135px,1fr))]">
          {blocks.map((block) => (
            <div key={block.batchCode || block.label} className={cn("rounded-md border px-2.5 py-2 text-xs", capacityTone[block.status])}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 font-bold">
                <span>{day?.mode === "PeakHoliday" ? formatCapacityTime(block.anchorTime) : block.label}</span>
                <span className="whitespace-nowrap tabular-nums">{block.usedPits}/{block.maxPits} pits</span>
              </div>
              <p className="mt-0.5 tabular-nums">{block.wholeCount} whole · {block.bellyCount} belly</p>
              {block.status !== "Open" && (
                <p className={cn("mt-1 font-black", (block.status === "LastSlot" || block.status === "Full") && "motion-safe:animate-pulse")}>{capacityStatusText[block.status]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
