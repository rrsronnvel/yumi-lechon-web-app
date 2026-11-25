import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { payrollError } from "@/hooks/usePayroll";

export const payrollSelect = "h-8 w-full rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60";

export function PayrollSection({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-stone-900">{title}</h2>
          {description && <p className="mt-1 max-w-prose text-sm text-stone-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function PayrollField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium text-stone-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PayrollEmpty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-7 text-center text-sm text-stone-600">{children}</p>;
}

export function PayrollQueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
      <p>{payrollError(error)}</p>
      <Button type="button" variant="outline" onClick={retry}>Retry</Button>
    </div>
  );
}
