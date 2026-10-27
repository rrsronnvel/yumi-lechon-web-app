import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PrintLayout from "@/components/daily-sheets/PrintLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KitchenViewTab } from "@/components/daily-sheets/KitchenViewTab";
import { RiderViewTab } from "@/components/daily-sheets/RiderViewTab";
import { Button } from "@/components/ui/button";
import { useDailySheets } from "@/hooks/useSchedules";
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Printer,
  Sparkles,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string | null): value is string {
  if (!value || !ISO_DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getPhilippineDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateParts: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") dateParts[part.type] = part.value;
  }

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatIsoDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export default function DailySheetsPage() {
  const [mode, setMode] = useState<"edit" | "clean">("edit");
  const [activeTab, setActiveTab] = useState<string>("kitchen");
  const [searchParams, setSearchParams] = useSearchParams();
  const philippineToday = useMemo(() => getPhilippineDate(), []);
  const requestedDate = searchParams.get("date");
  const selectedDate = isValidIsoDate(requestedDate) ? requestedDate : philippineToday;
  const tomorrow = addDays(philippineToday, 1);
  const { data: dailySheets } = useDailySheets(selectedDate);
  const formattedDate =
    dailySheets?.targetDate === selectedDate
      ? dailySheets.formattedDate
      : formatIsoDate(selectedDate);

  useEffect(() => {
    if (requestedDate === selectedDate) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("date", selectedDate);
    setSearchParams(nextParams, { replace: true });
  }, [requestedDate, searchParams, selectedDate, setSearchParams]);

  const selectDate = (date: string) => {
    if (!isValidIsoDate(date)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("date", date);
    setSearchParams(nextParams);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <PrintLayout>
      <div className="mb-4 space-y-3 border-b border-stone-200 pb-3 print:hidden">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          {mode === "edit" ? (
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/yumi-logo.png"
                alt="Yumi's Lechon Logo"
                className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-amber-400/80"
              />
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-stone-900 sm:text-2xl">
                  <Sparkles className="h-5 w-5 text-amber-600" /> Daily Dispatch Planner
                </h1>
                <p className="mt-0.5 text-xs font-medium text-stone-500">
                  Scheduled Date: <span className="font-bold text-stone-800">{formattedDate}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <img
                src="/yumi-logo.png"
                alt="Yumi's Lechon Logo"
                className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-amber-400/80"
              />
              <span className="inline-flex items-center gap-1.5 rounded bg-[#181312] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white">
                <Camera className="h-3.5 w-3.5 text-amber-400" /> Clean Screenshot View
              </span>
              <span className="text-xs font-medium text-stone-600">
                Zero-scroll high-contrast view • Ready to capture for Group Chat
              </span>
            </div>
          )}

          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
            {mode === "clean" && (
              <div className="flex items-center rounded-lg border border-stone-300 bg-stone-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("kitchen")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-all ${
                    activeTab === "kitchen"
                      ? "border border-stone-200 bg-white text-stone-900 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Kitchen Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("rider")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-all ${
                    activeTab === "rider"
                      ? "border border-stone-200 bg-white text-stone-900 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <Truck className="h-3.5 w-3.5" /> Rider Sheet
                </button>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-8 border-stone-300 px-2.5 text-xs font-semibold"
              title="Print or Save as PDF"
            >
              <Printer className="mr-1 h-3.5 w-3.5" /> Print / PDF
            </Button>

            <div className="inline-flex rounded-lg border border-stone-300 bg-stone-100 p-0.5 shadow-xs">
              <Button
                type="button"
                size="sm"
                variant={mode === "edit" ? "default" : "ghost"}
                onClick={() => setMode("edit")}
                className={`h-7 px-2.5 text-xs font-bold ${
                  mode === "edit"
                    ? "bg-[#C81E1E] text-white shadow-xs hover:bg-[#A81818]"
                    : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                }`}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit Mode
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "clean" ? "default" : "ghost"}
                onClick={() => setMode("clean")}
                className={`h-7 px-2.5 text-xs font-bold ${
                  mode === "clean"
                    ? "bg-[#181312] text-white shadow-xs"
                    : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                }`}
              >
                <Camera className="mr-1 h-3.5 w-3.5" /> Clean View
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 sm:px-3">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-600">
            <CalendarDays className="h-4 w-4 text-amber-700" /> Dispatch Date
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-9 border-stone-300 p-0"
            aria-label="Previous day"
            title="Previous day"
            onClick={() => selectDate(addDays(selectedDate, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <label htmlFor="dispatch-date" className="sr-only">
            Selected dispatch date
          </label>
          <input
            id="dispatch-date"
            type="date"
            value={selectedDate}
            onChange={(event) => selectDate(event.target.value)}
            className="h-9 min-w-[145px] flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-900 shadow-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 sm:max-w-[180px] sm:flex-none sm:px-3"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-9 border-stone-300 p-0"
            aria-label="Next day"
            title="Next day"
            onClick={() => selectDate(addDays(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex w-full items-center justify-center gap-1.5 border-t border-stone-300 pt-2 sm:ml-1 sm:w-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
            <Button
              type="button"
              size="sm"
              variant={selectedDate === philippineToday ? "default" : "outline"}
              className="h-8 px-3 text-xs font-bold"
              onClick={() => selectDate(philippineToday)}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedDate === tomorrow ? "default" : "outline"}
              className="h-8 px-3 text-xs font-bold"
              onClick={() => selectDate(tomorrow)}
            >
              Tomorrow
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full bg-white">
        {mode === "clean" && (
          <div className="mb-4 flex flex-col items-start justify-between gap-2 border-b-2 border-black pb-3 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-xs bg-black px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                  YUMI LECHON
                </span>
                <h1 className="text-xl font-black uppercase tracking-tight text-black sm:text-2xl">
                  {activeTab === "kitchen" ? "Kitchen Production Roster" : "Rider Logistics & Settlement Manifest"}
                </h1>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-700">
                Target Operations: <span className="font-extrabold text-black">{formattedDate}</span> • Printed: {formatIsoDate(philippineToday)}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block border-2 border-black bg-slate-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-black">
                {activeTab === "kitchen" ? "Roasting Pit Copy" : "Logistics Settlement Copy"}
              </span>
            </div>
          </div>
        )}

        {mode === "edit" && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <div className="flex min-w-0 items-start gap-2">
              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Edit Mode
              </span>
              <span>
                Click on any <strong>Tahi</strong>, <strong>Salang</strong>, <strong>Departure / Pickup</strong>, <strong>Remarks</strong>, or <strong>Rider Name</strong> cell to level production or assign riders.
              </span>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {mode === "edit" && (
            <TabsList className="mx-auto mb-4 grid h-auto w-full max-w-md grid-cols-2 gap-1.5 rounded-xl bg-stone-200/60 p-1.5">
              <TabsTrigger
                value="kitchen"
                className="min-w-0 px-2 py-1.5 text-[11px] font-semibold text-stone-600 transition-all data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm sm:px-4 sm:text-xs"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" /> Kitchen View (Timings)
              </TabsTrigger>
              <TabsTrigger
                value="rider"
                className="min-w-0 px-2 py-1.5 text-[11px] font-semibold text-stone-600 transition-all data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm sm:px-4 sm:text-xs"
              >
                <Truck className="h-3.5 w-3.5" /> Rider View (Cash Splits)
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="kitchen" className="mt-0 focus-visible:outline-none">
            <KitchenViewTab mode={mode} selectedDate={selectedDate} />
          </TabsContent>

          <TabsContent value="rider" className="mt-0 focus-visible:outline-none">
            <RiderViewTab mode={mode} selectedDate={selectedDate} />
          </TabsContent>
        </Tabs>
      </div>
    </PrintLayout>
  );
}
