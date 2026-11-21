import { useMemo, useState } from "react";
import { Edit, Gift, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PromoPackage,
  PromoPackageInput,
  useCreatePromo,
  useDeletePromo,
  usePromos,
  useUpdatePromo,
} from "@/hooks/usePromos";
import { formatPromoIncludedItems, parsePromoIncludedItems } from "@/utils/freebiesHelper";

const ITEM_KEYS = [
  "Sarsa",
  "Pancit",
  "Palabok",
  "Spaghetti",
  "Dinuguan",
  "Puto",
  "1.5L Coke",
  "Fried Chicken",
  "Shanghai",
  "Bopis",
];

const emptyPromo = (): PromoPackageInput => ({
  code: "",
  groupName: "Option 1",
  name: "",
  description: "",
  seasonScope: "DecemberRegular",
  discountAmount: 0,
  includedItemsJson: "{}",
  allowOnPeakDates: false,
  isActive: true,
  sortOrder: 100,
});

export default function PromoPackagesCms() {
  const { data: promos = [], isLoading } = usePromos();
  const createPromo = useCreatePromo();
  const updatePromo = useUpdatePromo();
  const deletePromo = useDeletePromo();
  const [editing, setEditing] = useState<PromoPackage | null>(null);
  const [draft, setDraft] = useState<PromoPackageInput | null>(null);
  const [items, setItems] = useState<Record<string, number>>({});

  const sections = useMemo(
    () => [
      { label: "Regular", promos: promos.filter((promo) => promo.seasonScope === "Regular") },
      { label: "December Promo (Option 1 / 2 / 3)", promos: promos.filter((promo) => promo.seasonScope === "DecemberRegular") },
      { label: "Dec 24 & 31 Peak Freebies", promos: promos.filter((promo) => promo.seasonScope === "DecemberPeak") },
      { label: "All Dates", promos: promos.filter((promo) => promo.seasonScope === "AllDates") },
    ].filter((section) => section.promos.length > 0),
    [promos],
  );

  const openEditor = (promo?: PromoPackage) => {
    setEditing(promo ?? null);
    setDraft(promo ? { ...promo } : emptyPromo());
    setItems(promo ? parsePromoIncludedItems(promo.includedItemsJson) : {});
  };

  const save = async () => {
    if (!draft?.code.trim() || !draft.name.trim()) return;
    const payload = { ...draft, code: draft.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_"), includedItemsJson: JSON.stringify(items) };
    if (editing) await updatePromo.mutateAsync({ ...payload, id: editing.id });
    else await createPromo.mutateAsync(payload);
    setDraft(null);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-stone-950"><Gift className="h-5 w-5 text-amber-700" /> 🎁 Promo Packages CMS</h2>
          <p className="mt-1 text-xs text-stone-600">Seasonal whole-lechon freebies, cash discounts, and kitchen prep inclusions.</p>
        </div>
        <Button onClick={() => openEditor()} className="bg-[#C81E1E] text-white hover:bg-[#A81818]"><Plus className="mr-1.5 h-4 w-4" /> Add Promo Package</Button>
      </div>

      {isLoading ? <p className="p-6 text-center text-stone-500">Loading promo packages…</p> : sections.map((section) => (
        <section key={section.label} className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-stone-600">{section.label}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {section.promos.map((promo) => (
              <div key={promo.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-stone-950">{promo.name}</h4>
                      <Badge variant="outline">{promo.seasonScope}</Badge>
                      <Badge className={promo.discountAmount > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}>
                        {promo.discountAmount > 0 ? `-₱${promo.discountAmount.toLocaleString()}` : "₱0"}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-stone-400">{promo.code}</p>
                  </div>
                  <Switch checked={promo.isActive} onCheckedChange={(isActive) => updatePromo.mutate({ ...promo, isActive })} aria-label={`Toggle ${promo.name}`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {formatPromoIncludedItems(parsePromoIncludedItems(promo.includedItemsJson)).map((label) => <span key={label} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-950">{label}</span>)}
                </div>
                {promo.code === "DEC_OPT3_LESS_2K" && (
                  <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-bold text-amber-950">
                    <span>Allow on Dec 24 &amp; 31 Peak Dates</span>
                    <Switch checked={promo.allowOnPeakDates} onCheckedChange={(allowOnPeakDates) => updatePromo.mutate({ ...promo, allowOnPeakDates })} />
                  </label>
                )}
                <div className="mt-3 flex justify-end gap-2 border-t border-stone-100 pt-3">
                  <Button size="sm" variant="outline" onClick={() => openEditor(promo)}><Edit className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => window.confirm(`Delete ${promo.name}?`) && deletePromo.mutate(promo.id)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Promo Package" : "Add Promo Package"}</DialogTitle><DialogDescription>Configure the customer label, date scope, discount, and kitchen quantities per Whole Lechon.</DialogDescription></DialogHeader>
          {draft && <div className="grid gap-4 py-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold">Name<Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold">Unique Code<Input disabled={Boolean(editing)} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></label>
            <label className="space-y-1 text-xs font-bold">Group<select className="h-10 w-full rounded-md border px-3" value={draft.groupName} onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}>{["Regular", "Option 1", "Option 2", "Option 3", "Dec 24 & 31 Peak"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="space-y-1 text-xs font-bold">Season Scope<select className="h-10 w-full rounded-md border px-3" value={draft.seasonScope} onChange={(e) => setDraft({ ...draft, seasonScope: e.target.value })}>{["Regular", "DecemberRegular", "DecemberPeak", "AllDates"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="space-y-1 text-xs font-bold">Discount Amount<Input type="number" min={0} value={draft.discountAmount} onChange={(e) => setDraft({ ...draft, discountAmount: Math.max(0, Number(e.target.value) || 0) })} /></label>
            <label className="space-y-1 text-xs font-bold">Sort Order<Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} /></label>
            <label className="space-y-1 text-xs font-bold sm:col-span-2">Description<Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="sm:col-span-2"><p className="mb-2 text-xs font-black uppercase text-stone-500">Included Kitchen Items / Whole Lechon</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ITEM_KEYS.map((key) => <label key={key} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs font-semibold"><span>{key}</span><Input className="h-8 w-16" type="number" min={0} value={items[key] ?? 0} onChange={(e) => setItems({ ...items, [key]: Math.max(0, Number(e.target.value) || 0) })} /></label>)}</div></div>
            <label className="flex items-center justify-between rounded-lg border p-3 text-xs font-bold"><span>Active</span><Switch checked={draft.isActive} onCheckedChange={(isActive) => setDraft({ ...draft, isActive })} /></label>
            <label className="flex items-center justify-between rounded-lg border p-3 text-xs font-bold"><span>Allow on Dec 24 &amp; 31</span><Switch checked={draft.allowOnPeakDates} onCheckedChange={(allowOnPeakDates) => setDraft({ ...draft, allowOnPeakDates })} /></label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save} disabled={!draft?.name.trim() || !draft?.code.trim() || createPromo.isPending || updatePromo.isPending}>Save Promo Package</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
