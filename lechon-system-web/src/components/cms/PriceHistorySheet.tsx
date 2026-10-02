import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { usePriceHistory, ItemCategory } from "@/hooks/useCms";
import { History, TrendingUp, TrendingDown, Clock, UserCheck } from "lucide-react";

interface PriceHistorySheetProps {
  category: ItemCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceHistorySheet({
  category,
  open,
  onOpenChange,
}: PriceHistorySheetProps) {
  const { data: history = [], isLoading } = usePriceHistory(
    open && category ? category.id : null
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getWeightSubtitle = () => {
    if (!category) return "";
    if (category.minimumWeightKg > 0) {
      return `Weight Bracket: ${category.minimumWeightKg} kg – ${category.maximumWeightKg} kg`;
    }
    return "Lightweight Add-On / Side Item";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-slate-50 p-6">
        <SheetHeader className="pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-xl font-bold text-slate-900">
                {category?.name ?? "Item"} Price History
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {getWeightSubtitle()}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 bg-white rounded-lg border border-slate-200 animate-pulse space-y-2"
                >
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-6 bg-slate-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-300">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-700">
                No Price Adjustments Logged
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                This item has maintained its base rate of ₱
                {category?.basePrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}{" "}
                since creation.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {history.map((log) => {
                const isHike = log.delta > 0;
                const isDrop = log.delta < 0;

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline bullet dot */}
                    <div
                      className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                        isHike
                          ? "border-amber-500 ring-2 ring-amber-100"
                          : isDrop
                            ? "border-emerald-500 ring-2 ring-emerald-100"
                            : "border-slate-400"
                      }`}
                    />

                    {/* Timeline Card */}
                    <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500">
                          {formatDate(log.dateChanged)}
                        </span>

                        <Badge
                          variant="outline"
                          className={
                            isHike
                              ? "bg-amber-50 text-amber-700 border-amber-200 font-semibold"
                              : isDrop
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                          }
                        >
                          {isHike && <TrendingUp className="w-3 h-3 mr-1" />}
                          {isDrop && <TrendingDown className="w-3 h-3 mr-1" />}
                          {log.delta > 0 ? "+" : ""}₱
                          {Math.abs(log.delta).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </Badge>
                      </div>

                      {/* Price Transition */}
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xs text-slate-400 line-through">
                          ₱
                          {log.oldPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-xs text-slate-400">→</span>
                        <span className="text-base font-bold text-slate-900">
                          ₱
                          {log.newPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {/* User Signature */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-slate-400" />
                          Changed by:
                        </span>
                        <span className="font-medium text-slate-700">
                          {log.changedBy || "System"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
