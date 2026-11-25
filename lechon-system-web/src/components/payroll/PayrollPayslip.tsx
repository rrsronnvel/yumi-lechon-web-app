import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PayrollItem, PayrollPeriod } from "@/hooks/usePayroll";
import { displayDate, displayPeriod, money } from "./payrollDisplay";
import "./payrollPrint.css";

export function PayrollPayslip({ period, item, onClose }: { period: PayrollPeriod; item: PayrollItem; onClose: () => void }) {
  const paper = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!paper.current) return;
    setDownloading(true);
    try {
      const url = await toPng(paper.current, { pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true });
      const link = document.createElement("a");
      const employee = item.employeeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.download = `payslip-${employee || item.employeeId}-${period.endDate}.png`;
      link.href = url;
      link.click();
    } catch {
      toast.error("The payslip image could not be downloaded. Try again or use Print.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !downloading) onClose(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Employee payslip</DialogTitle>
          <DialogDescription>{item.employeeName} · {displayPeriod(period)}</DialogDescription>
        </DialogHeader>
        <div ref={paper} className="overflow-hidden rounded-lg border border-stone-300">
          <PayslipPaper item={item} period={period} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
          <Button type="button" onClick={download} disabled={downloading}><Download /> {downloading ? "Downloading…" : "Download PNG"}</Button>
        </DialogFooter>
        {createPortal(<div className="payroll-print-sheet" aria-hidden="true"><PayslipPaper item={item} period={period} /></div>, document.body)}
      </DialogContent>
    </Dialog>
  );
}

function PayslipPaper({ period, item }: { period: PayrollPeriod; item: PayrollItem }) {
  const partihan = item.partihanIncentivePay ?? 0;
  const milestone = item.milestoneIncentivePay ?? 0;
  const legacyBonus = Math.round((item.roastingIncentivePay - partihan - milestone) * 100) / 100;
  const payslipLines = [
    { label: "Days Worked", amount: item.daysWorked.toFixed(1) },
    { label: "Base Pay", amount: money(item.basePay), note: `${money(item.dailyRateSnapshot)} per day` },
    { label: "Overtime Pay", amount: money(item.overtimePay) },
    ...(item.holidayPremiumPay > 0 ? [{ label: "Holiday Pay", amount: money(item.holidayPremiumPay) }] : []),
    { label: "Partihan", amount: money(partihan) },
    { label: "Milestone Bonus", amount: money(milestone) },
    ...(legacyBonus > 0 ? [{ label: "Legacy Roasting Bonus", amount: money(legacyBonus) }] : []),
    { label: "Other Bonus", amount: money(item.otherBonus), note: item.otherBonusRemarks },
    ...(item.lateDeduction > 0 ? [{ label: "Late Deduction", amount: money(-item.lateDeduction) }] : []),
    { label: "Vale Deducted", amount: money(-item.valeDeducted || 0), note: `Remaining Vale Balance ${money(item.valeBalanceAfter)}` },
    { label: "Other Deductions", amount: money(-item.otherDeduction || 0), note: item.otherDeductionRemarks },
  ];

  return (
    <article className="bg-white p-4 text-[#1c1917] sm:p-6" style={{ fontFamily: "Arial, sans-serif" }}>
      <header className="border-b-2 border-[#292524] pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#57534e]">Yumi’s Lechon</p>
          <p className="rounded border border-[#d6d3d1] px-2 py-0.5 text-xs font-semibold">{period.status}</p>
        </div>
        <h2 className="mt-2 break-words text-xl font-extrabold">{item.employeeName}</h2>
        <p className="mt-1 text-sm">{displayPeriod(period)}</p>
        <p className="text-xs text-[#57534e]">Payday: {displayDate(period.payDate, true)}</p>
      </header>
      <dl className="my-3 divide-y divide-[#e7e5e4] text-sm">
        {payslipLines.map(({ label, amount, note }) => (
          <div className="grid grid-cols-[1fr_auto] items-start gap-3 py-2" key={label}>
            <dt className="min-w-0 font-semibold">{label}{note && <span className="block wrap-break-word text-xs font-normal text-[#57534e]">{note}</span>}</dt>
            <dd className="font-medium tabular-nums">{amount}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-[#292524] px-3 py-2.5">
        <p className="font-bold">Net Take-Home Pay</p>
        <p className="text-xl font-extrabold tabular-nums">{money(item.netPay)}</p>
      </div>
    </article>
  );
}
