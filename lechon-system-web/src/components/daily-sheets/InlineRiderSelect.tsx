import { useState, type ChangeEvent } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { sameRider } from "@/utils/splitMoto";

const editOrder = "edit-order";
const riderValue = (name: string) => `rider:${name}`;

interface InlineRiderSelectProps {
  label: string;
  current: string;
  options: { name: string; label?: string }[];
  disabled?: boolean;
  editLabel: string;
  onEditOrder: () => void;
  onSelect: (name: string) => Promise<unknown>;
}

export function InlineRiderSelect({ label, current, options, disabled, editLabel, onEditOrder, onSelect }: InlineRiderSelectProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const currentOption = options.find(({ name }) => sameRider(name, current));

  const selectRider = async (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.target.value === editOrder) {
      onEditOrder();
      return;
    }

    const selected = options.find(({ name }) => riderValue(name) === event.target.value);
    if (!selected || sameRider(selected.name, current)) return;

    setSaving(selected.name);
    try {
      await onSelect(selected.name);
      toast.success("Rider assignment saved.");
    } catch (error) {
      toast.error(isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || "Could not save the rider assignment."
        : "Could not save the rider assignment.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <select
      aria-label={label}
      aria-busy={saving !== null}
      title={currentOption?.label || current || "Unassigned"}
      className="h-7 w-full min-w-0 cursor-pointer rounded border border-slate-300 bg-white px-1 text-[11px] font-bold text-blue-800 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-65"
      disabled={disabled || saving !== null}
      value={riderValue(saving ?? currentOption?.name ?? current)}
      onChange={selectRider}
    >
      {!currentOption && <option value={riderValue(current)} disabled>{current || "Unassigned"}</option>}
      {options.map(({ name, label: optionLabel }) => (
        <option key={name} value={riderValue(name)}>{optionLabel || name}</option>
      ))}
      <option value={editOrder}>{editLabel}</option>
    </select>
  );
}

export function SplitRiderButton({ hasSupport, reference, onClick }: { hasSupport: boolean; reference: string; onClick: () => void }) {
  const label = hasSupport ? "Edit Split" : "+ Split";
  return (
    <button type="button" aria-label={`${label} for order ${reference}`} onClick={onClick}
      className="w-fit rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold leading-tight text-amber-950 hover:bg-amber-100">
      {label}
    </button>
  );
}
