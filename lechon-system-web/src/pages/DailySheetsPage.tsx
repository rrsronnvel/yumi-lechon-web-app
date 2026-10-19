import { useState } from "react";
import PrintLayout from "@/components/daily-sheets/PrintLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KitchenViewTab } from "@/components/daily-sheets/KitchenViewTab";
import { RiderViewTab } from "@/components/daily-sheets/RiderViewTab";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera, Pencil, UtensilsCrossed, Truck, Printer } from "lucide-react";

export default function DailySheetsPage() {
  const [mode, setMode] = useState<"edit" | "clean">("edit");
  const [activeTab, setActiveTab] = useState<string>("kitchen");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = tomorrow.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <PrintLayout>
      {/* 1. Mode Switcher & Top Control Banner (Hidden in Print) */}
      <div className="mb-4 flex flex-col md:flex-row items-center justify-between gap-3 pb-3 border-b border-stone-200 print:hidden">
        {mode === "edit" ? (
          <div className="flex items-center gap-3">
            <img
              src="/yumi-logo.png"
              alt="Yumi's Lechon Logo"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/80 shadow-sm shrink-0"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" /> Daily Dispatch Planner
              </h1>
              <p className="text-xs font-medium text-stone-500 mt-0.5">
                Scheduled Date: <span className="font-bold text-stone-800">{formattedDate}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <img
              src="/yumi-logo.png"
              alt="Yumi's Lechon Logo"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/80 shadow-sm shrink-0"
            />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#181312] text-white text-xs font-black uppercase tracking-wider">
              <Camera className="w-3.5 h-3.5 text-amber-400" /> Clean Screenshot View
            </span>
            <span className="text-xs font-medium text-stone-600">
              Zero-scroll high-contrast view • Ready to capture for Group Chat
            </span>
          </div>
        )}

        {/* Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher in Clean Mode */}
          {mode === "clean" && (
            <div className="flex items-center border border-stone-300 rounded-lg p-0.5 bg-stone-100 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("kitchen")}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 text-xs ${
                  activeTab === "kitchen"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" /> Kitchen Sheet
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("rider")}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 text-xs ${
                  activeTab === "rider"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> Rider Sheet
              </button>
            </div>
          )}

          {/* Print Button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 text-xs font-semibold px-2.5 border-stone-300"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print / PDF
          </Button>

          {/* Mode Toggle */}
          <div className="inline-flex rounded-lg border border-stone-300 bg-stone-100 p-0.5 shadow-xs">
            <Button
              type="button"
              size="sm"
              variant={mode === "edit" ? "default" : "ghost"}
              onClick={() => setMode("edit")}
              className={`h-7 text-xs font-bold px-2.5 ${
                mode === "edit"
                  ? "bg-[#C81E1E] hover:bg-[#A81818] text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
              }`}
            >
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Mode
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "clean" ? "default" : "ghost"}
              onClick={() => setMode("clean")}
              className={`h-7 text-xs font-bold px-2.5 ${
                mode === "clean"
                  ? "bg-[#181312] text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
              }`}
            >
              <Camera className="w-3.5 h-3.5 mr-1" /> Clean View
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Document Container with Border (Perfect for Snipping Tool) */}
      <div className="w-full bg-white">
        {/* Document Header in Clean Mode */}
        {mode === "clean" && (
          <div className="border-b-2 border-black pb-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-black text-white font-black text-[10px] px-2 py-0.5 uppercase tracking-widest rounded-xs">
                  YUMI LECHON
                </span>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
                  {activeTab === "kitchen" ? "Kitchen Production Roster" : "Rider Logistics & Settlement Manifest"}
                </h1>
              </div>
              <p className="text-xs font-bold text-slate-700 mt-1">
                Target Operations: <span className="text-black font-extrabold">{formattedDate}</span> • Printed: {new Date().toLocaleDateString("en-PH")}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black px-2.5 py-1 border-2 border-black uppercase tracking-wide text-black inline-block bg-slate-50">
                {activeTab === "kitchen" ? "Roasting Pit Copy" : "Logistics Settlement Copy"}
              </span>
            </div>
          </div>
        )}

        {/* Helper Tip in Edit Mode */}
        {mode === "edit" && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                Edit Mode
              </span>
              <span>
                Click on any <strong>Tahi</strong>, <strong>Salang</strong>, <strong>Packaging</strong>, <strong>Remarks</strong>, or <strong>Rider Name</strong> cell to level production or assign riders.
              </span>
            </div>
          </div>
        )}

        {/* Tab Switcher & Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {mode === "edit" && (
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-auto p-1.5 gap-1.5 bg-stone-200/60 rounded-xl mb-4">
              <TabsTrigger
                value="kitchen"
                className="font-semibold flex items-center justify-center gap-1.5 text-xs py-1.5 px-4 rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" /> Kitchen View (Timings)
              </TabsTrigger>
              <TabsTrigger
                value="rider"
                className="font-semibold flex items-center justify-center gap-1.5 text-xs py-1.5 px-4 rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
              >
                <Truck className="w-3.5 h-3.5" /> Rider View (Cash Splits)
              </TabsTrigger>
            </TabsList>
          )}

          {/* Tab 1: Kitchen View */}
          <TabsContent value="kitchen" className="mt-0 focus-visible:outline-none">
            <KitchenViewTab mode={mode} />
          </TabsContent>

          {/* Tab 2: Rider View */}
          <TabsContent value="rider" className="mt-0 focus-visible:outline-none">
            <RiderViewTab mode={mode} />
          </TabsContent>
        </Tabs>
      </div>
    </PrintLayout>
  );
}