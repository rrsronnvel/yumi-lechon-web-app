import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useRidersQuery } from "@/hooks/useRiders";
import { useUpdateOrderRiders } from "@/hooks/useLogistics";
import { cn } from "@/lib/utils";
import { countWholeHeads, defaultBackupHeads, namedRider, sameRider, type RiderAssignmentOrder } from "@/utils/splitMoto";

const selectClass = "h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm";

function RiderAssignmentForm({ order, onClose }: { order: RiderAssignmentOrder; onClose: () => void }) {
  const { data: riders = [], isPending: loadingRiders } = useRidersQuery();
  const update = useUpdateOrderRiders();
  const wholeHeads = countWholeHeads(order.orderItems);
  const currentLead = namedRider(order.assignedRiderName);
  const currentSupport = namedRider(order.supportRiderName);
  const canSplit = wholeHeads > 2 || Boolean(currentSupport);
  const [leadChoice, setLeadChoice] = useState(currentLead);
  const [customLead, setCustomLead] = useState("");
  const [support, setSupport] = useState(currentSupport);
  const [heads, setHeads] = useState(order.supportRiderHeads || defaultBackupHeads(wholeHeads));
  const [fee, setFee] = useState(String((currentSupport ? order.supportRiderFee : null) ?? order.deliveryFee ?? 0));
  const [showSplit, setShowSplit] = useState(canSplit);
  const lead = namedRider(customLead || leadChoice);
  const maximumHeads = Math.max(1, wholeHeads - 1);
  const activeNames = riders.filter((rider) => rider.isActive).map((rider) => rider.fullName);
  const leadNames = [...new Set([...activeNames, currentLead])].filter(Boolean);
  const supportNames = [...new Set([...activeNames, currentSupport])].filter((name) => name && (!sameRider(name, lead) || name === support));
  const invalidSupport = Boolean(support) && (
    !lead || sameRider(lead, support) || !Number.isInteger(heads) || heads < 1 || heads > maximumHeads ||
    !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(fee) || !Number.isFinite(Number(fee))
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead || invalidSupport || update.isPending) return;
    update.mutate({
      orderId: order.id,
      riderName: lead,
      supportRiderName: support || null,
      supportRiderHeads: support ? heads : undefined,
      supportRiderFee: support ? Number(fee) : undefined,
    }, {
      onSuccess: () => {
        toast.success("Rider assignment saved.");
        onClose();
      },
      onError: (error) => toast.error(isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || "Could not save the rider assignment."
        : "Could not save the rider assignment."),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1 text-sm font-semibold text-stone-900">
        Lead Rider (Collects Cash)
        <select className={selectClass} value={leadChoice} onChange={(event) => {
          setLeadChoice(event.target.value);
          if (event.target.value) setCustomLead("");
        }}>
          <option value="">{loadingRiders ? "Loading riders…" : "Select registered rider"}</option>
          {leadNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <Input aria-label="Custom lead rider name" placeholder="Or enter a custom rider name" value={customLead} maxLength={100} onChange={(event) => {
        setCustomLead(event.target.value);
        if (event.target.value) setLeadChoice("");
      }} />
      <section
        className={cn(
          "rounded-lg border",
          showSplit ? "space-y-2 p-3" : "w-fit px-2 py-1",
          canSplit ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50",
        )}
        aria-label="Split motorcycle rider"
      >
        <button type="button" aria-expanded={showSplit} className="text-left text-sm font-bold text-amber-950" onClick={() => setShowSplit((open) => !open)}>
          {showSplit ? "− Split Moto Rider (Backup / Store-Shouldered)" : "+ Split Moto Rider"}
        </button>
        {showSplit && wholeHeads > 2 && !currentSupport && <p className="text-xs font-medium text-amber-900">Consider a backup rider for {wholeHeads} whole lechon heads.</p>}
        {showSplit && !canSplit && <p className="text-xs text-stone-600">Split delivery is available for orders with more than two whole lechon heads.</p>}
        {showSplit && canSplit && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold sm:col-span-2">
              Backup Rider (Collects ₱0)
              <select className={selectClass} value={support} onChange={(event) => setSupport(event.target.value)}>
                <option value="">No backup rider</option>
                {supportNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Heads Carried
              <Input type="number" inputMode="numeric" min={1} max={maximumHeads} step={1} disabled={!support} value={Number.isNaN(heads) ? "" : heads} onChange={(event) => setHeads(event.target.valueAsNumber)} />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Store-Shouldered Fee (₱)
              <Input type="number" inputMode="decimal" min={0} step="0.01" disabled={!support} value={fee} onChange={(event) => setFee(event.target.value)} />
            </label>
            {support && sameRider(lead, support) && <p className="text-xs text-red-800 sm:col-span-2">Choose a different backup rider.</p>}
          </div>
        )}
      </section>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
        <Button type="submit" disabled={!lead || invalidSupport || update.isPending}>{update.isPending ? "Saving…" : "Save Riders"}</Button>
      </DialogFooter>
    </form>
  );
}

export function RiderAssignmentDialog({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const order = useOrderDetails(orderId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign / Change Rider</DialogTitle>
          <DialogDescription>Order #{order.data?.orderReference || orderId}</DialogDescription>
        </DialogHeader>
        {order.data ? <RiderAssignmentForm key={orderId} order={order.data} onClose={onClose} />
          : <p className="text-sm text-stone-600">{order.isError ? "Could not load the order." : "Loading riders for this order…"}</p>}
      </DialogContent>
    </Dialog>
  );
}
