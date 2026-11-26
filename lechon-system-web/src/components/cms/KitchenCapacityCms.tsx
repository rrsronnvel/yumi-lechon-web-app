import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type KitchenBatchPreset,
  type KitchenBranch,
  useChangeKitchenCapacityConfig,
  useKitchenCapacityConfig,
} from "@/hooks/useKitchenCapacity";
import { formatCapacityTime } from "@/utils/kitchenCapacity";

const selectClass = "h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm";
const types = { PeakHoliday: "Dec 24 & 31 Peak Batches", Weekend: "Weekend Slots" };

export default function KitchenCapacityCms() {
  const config = useKitchenCapacityConfig();
  const change = useChangeKitchenCapacityConfig();
  const [editingBatch, setEditingBatch] = useState<KitchenBatchPreset | null>(null);

  if (config.isPending) return <p className="p-4 text-sm text-stone-600">Loading kitchen configuration…</p>;
  if (!config.data) return <p className="p-4 text-sm text-red-800">Could not load kitchen configuration.</p>;

  const { branches, batches } = config.data;
  const save = async (payload: Parameters<typeof change.mutateAsync>[0]) => {
    try {
      await change.mutateAsync(payload);
      toast.success("Kitchen capacity settings saved.");
      return true;
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
      toast.error(message || "Could not save kitchen settings.");
      return false;
    }
  };

  const saveBranch = (event: FormEvent<HTMLFormElement>, branch: KitchenBranch) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void save({ kind: "branch", value: {
      ...branch,
      name: String(values.get("name")).trim(),
      totalPits: Number(values.get("totalPits")),
      safeBelliesPerPit: Number(values.get("safeBelliesPerPit")),
      maxSqueezeBelliesPerPit: Number(values.get("maxSqueezeBelliesPerPit")),
      postDepartureBufferMinutes: Number(values.get("postDepartureBufferMinutes")),
      isActive: values.has("isActive"),
      isDefault: values.has("isDefault"),
    } });
  };

  const saveBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBatch) return;
    const values = new FormData(event.currentTarget);
    const time = (key: string) => `${String(values.get(key)).slice(0, 5)}:00`;
    const saved = await save({ kind: "batch", value: {
      id: editingBatch.id,
      branchCode: String(values.get("branchCode") ?? editingBatch.branchCode),
      scheduleType: String(values.get("scheduleType") ?? editingBatch.scheduleType) as KitchenBatchPreset["scheduleType"],
      batchCode: String(values.get("batchCode")).trim(),
      label: String(values.get("label")).trim(),
      startTime: time("startTime"),
      endTime: time("endTime"),
      anchorTime: time("anchorTime"),
      maxPits: Number(values.get("maxPits")),
      sortOrder: Number(values.get("sortOrder")),
      isActive: values.has("isActive"),
    } });
    if (saved) setEditingBatch(null);
  };

  const addBatch = () => {
    const branch = branches.find((item) => item.isDefault) ?? branches[0];
    if (!branch) return;
    setEditingBatch({
      id: 0, branchCode: branch.code, scheduleType: "PeakHoliday", batchCode: "", label: "",
      startTime: "07:00:00", endTime: "08:30:00", anchorTime: "07:00:00",
      maxPits: branch.totalPits, sortOrder: 1, isActive: false,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Roasting Branches</CardTitle></CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">
          {branches.map((branch) => (
            <form key={JSON.stringify(branch)} onSubmit={(event) => saveBranch(event, branch)} className="space-y-3 rounded-lg border border-stone-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-stone-950">{branch.name}</h3>
                <div className="flex gap-3 text-xs font-semibold">
                  <label className="flex items-center gap-1.5"><input type="checkbox" name="isActive" defaultChecked={branch.isActive} /> Active</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" name="isDefault" defaultChecked={branch.isDefault} /> Default</label>
                </div>
              </div>
              <label className="block space-y-1 text-xs font-semibold">Branch name<Input name="name" defaultValue={branch.name} maxLength={100} required /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-semibold">Total pits<Input name="totalPits" type="number" min={1} defaultValue={branch.totalPits} required /></label>
                <label className="space-y-1 text-xs font-semibold">Safe bellies per pit<Input name="safeBelliesPerPit" type="number" min={1} defaultValue={branch.safeBelliesPerPit} required /></label>
                <label className="space-y-1 text-xs font-semibold">Max squeeze bellies per pit<Input name="maxSqueezeBelliesPerPit" type="number" min={1} defaultValue={branch.maxSqueezeBelliesPerPit} required /></label>
                <label className="space-y-1 text-xs font-semibold">Post-departure buffer (min)<Input name="postDepartureBufferMinutes" type="number" min={0} defaultValue={branch.postDepartureBufferMinutes} required /></label>
              </div>
              <Button type="submit" size="sm" disabled={change.isPending}>Save {branch.name}</Button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Batch Presets</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addBatch}>Add Batch</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingBatch && (
            <form key={editingBatch.id} onSubmit={saveBatch} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <h3 className="font-bold text-stone-950">{editingBatch.id ? `Edit ${editingBatch.label}` : "New Batch"}</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-xs font-semibold">Branch<select name="branchCode" className={selectClass} defaultValue={editingBatch.branchCode} disabled={editingBatch.id !== 0}>{branches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}</select></label>
                <label className="space-y-1 text-xs font-semibold">Schedule type<select name="scheduleType" className={selectClass} defaultValue={editingBatch.scheduleType} disabled={editingBatch.id !== 0}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="space-y-1 text-xs font-semibold">Batch code<Input name="batchCode" defaultValue={editingBatch.batchCode} maxLength={50} readOnly={editingBatch.id !== 0} required /></label>
                <label className="space-y-1 text-xs font-semibold">Label<Input name="label" defaultValue={editingBatch.label} maxLength={100} required /></label>
                <label className="space-y-1 text-xs font-semibold">Window start<Input name="startTime" type="time" defaultValue={editingBatch.startTime.slice(0, 5)} required /></label>
                <label className="space-y-1 text-xs font-semibold">Window end<Input name="endTime" type="time" defaultValue={editingBatch.endTime.slice(0, 5)} required /></label>
                <label className="space-y-1 text-xs font-semibold">Anchor time<Input name="anchorTime" type="time" defaultValue={editingBatch.anchorTime.slice(0, 5)} required /></label>
                <label className="space-y-1 text-xs font-semibold">Maximum pits<Input name="maxPits" type="number" min={1} defaultValue={editingBatch.maxPits} required /></label>
                <label className="space-y-1 text-xs font-semibold">Sort order<Input name="sortOrder" type="number" min={0} defaultValue={editingBatch.sortOrder} required /></label>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" name="isActive" defaultChecked={editingBatch.isActive} /> Active</label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={change.isPending}>Save Batch</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingBatch(null)}>Cancel</Button>
              </div>
            </form>
          )}
          {Object.entries(types).map(([type, title]) => (
            <section key={type} className="space-y-2">
              <h3 className="text-sm font-bold text-stone-900">{title}</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {batches.filter((batch) => batch.scheduleType === type).map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2.5 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-stone-900">{batch.label}</div>
                      <div className="text-stone-600">{branches.find((branch) => branch.code === batch.branchCode)?.name ?? batch.branchCode} · {batch.maxPits} pits · {batch.isActive ? "Active" : "Inactive"}</div>
                      <div className="text-stone-600">{formatCapacityTime(batch.startTime)}–{formatCapacityTime(batch.endTime)} · Anchor {formatCapacityTime(batch.anchorTime)}</div>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingBatch(batch)}>Edit</Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
