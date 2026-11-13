import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil, ReceiptText, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserListItemDto, useUpdateUserProfileMutation } from "@/hooks/useUsers";

type StaffRole = "Owner" | "Cashier" | "Accountant";

export function EditUserModal({
  user,
  open,
  onOpenChange,
}: {
  user: UserListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("Cashier");
  const [validationError, setValidationError] = useState<string | null>(null);
  const updateUser = useUpdateUserProfileMutation();

  useEffect(() => {
    if (user && open) {
      setFullName(user.fullName);
      setRole((user.role === "Owner" || user.role === "Accountant" ? user.role : "Cashier") as StaffRole);
      setValidationError(null);
    }
  }, [user, open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      setValidationError("Full Name is required.");
      return;
    }
    updateUser.mutate(
      { id: user.id, payload: { fullName: fullName.trim(), role } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  if (!user) return null;

  const roleOptions = [
    { role: "Cashier" as const, icon: User, title: "🧑‍💼 Cashier", color: "blue" },
    { role: "Owner" as const, icon: ShieldCheck, title: "👑 Owner", color: "purple" },
    { role: "Accountant" as const, icon: ReceiptText, title: "📒 Accountant", color: "emerald" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-stone-200 bg-white shadow-xl sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Edit Staff Account</DialogTitle>
              <DialogDescription>Update the display name and access boundary for @{user.username}.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          {validationError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{validationError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="edit-staff-name">Full Name</Label>
            <Input id="edit-staff-name" value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={updateUser.isPending} />
          </div>
          <div className="space-y-1.5">
            <Label>Account Role &amp; Permissions</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const selected = role === option.role;
                const selectedClass = option.color === "blue"
                  ? "border-blue-400 bg-blue-50 ring-blue-400"
                  : option.color === "purple"
                    ? "border-purple-400 bg-purple-50 ring-purple-400"
                    : "border-emerald-400 bg-emerald-50 ring-emerald-400";
                return (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => setRole(option.role)}
                    className={`rounded-lg border p-3 text-left transition-all ${selected ? `${selectedClass} ring-1` : "border-stone-200 bg-stone-50 hover:border-stone-300"}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-stone-900"><Icon className="h-3.5 w-3.5" />{option.title}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-stone-500">
                      {option.role === "Accountant" ? "Expenses only; no revenue, profit, orders, or dispatch." : option.role === "Owner" ? "Full reports, settings, and governance." : "POS and daily operations."}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateUser.isPending}>Cancel</Button>
            <Button type="submit" disabled={updateUser.isPending} className="bg-[#C81E1E] text-white hover:bg-[#A81818]">
              {updateUser.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Pencil className="mr-1.5 h-4 w-4" />}
              Save Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
