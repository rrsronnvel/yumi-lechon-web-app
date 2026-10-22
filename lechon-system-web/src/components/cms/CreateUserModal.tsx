import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreateUserMutation } from "@/hooks/useUsers";
import { Eye, EyeOff, UserPlus, Loader2, ShieldCheck, User } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"Cashier" | "Owner">("Cashier");
  const [validationError, setValidationError] = useState<string | null>(null);

  const createUserMutation = useCreateUserMutation();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setFullName("");
      setUsername("");
      setPassword("");
      setShowPassword(false);
      setRole("Cashier");
      setValidationError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedFullName = fullName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedFullName) {
      setValidationError("Full Name is required.");
      return;
    }

    if (!normalizedUsername || !/^[a-z0-9]{3,}$/.test(normalizedUsername)) {
      setValidationError("Username must be at least 3 lowercase alphanumeric characters (a-z, 0-9).");
      return;
    }

    if (!password || password.length < 6) {
      setValidationError("Initial password must be at least 6 characters.");
      return;
    }

    createUserMutation.mutate(
      {
        fullName: trimmedFullName,
        username: normalizedUsername,
        password,
        role,
      },
      {
        onSuccess: () => {
          handleClose(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border-stone-200 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-stone-900">
                Add Staff Account
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Provision a new operator or terminal login for counter shifts and POS operations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {validationError && (
            <div className="p-2.5 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {validationError}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="create-fullname" className="text-xs font-semibold text-stone-700">
              Full Name
            </Label>
            <Input
              id="create-fullname"
              placeholder="e.g. Maria Santos"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={createUserMutation.isPending}
              required
              className="bg-stone-50 border-stone-300 text-stone-900 focus-visible:ring-amber-500"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="create-username" className="text-xs font-semibold text-stone-700">
              Staff Username
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-stone-400">
                @
              </span>
              <Input
                id="create-username"
                placeholder="maria"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                disabled={createUserMutation.isPending}
                required
                className="pl-7 bg-stone-50 border-stone-300 font-mono text-xs text-stone-900 focus-visible:ring-amber-500"
              />
            </div>
            <p className="text-[11px] text-stone-500">
              Lowercase alphanumeric only (min 3 characters, e.g. <span className="font-mono">maria</span>).
            </p>
          </div>

          {/* Initial Password */}
          <div className="space-y-1.5">
            <Label htmlFor="create-password" className="text-xs font-semibold text-stone-700">
              Initial Password
            </Label>
            <div className="relative">
              <Input
                id="create-password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={createUserMutation.isPending}
                required
                className="pr-10 bg-stone-50 border-stone-300 text-stone-900 focus-visible:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-stone-700">
              Account Role &amp; Permissions
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("Cashier")}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  role === "Cashier"
                    ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
                    : "bg-stone-50 border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>🧑‍💼 Cashier</span>
                </div>
                <span className="text-[10px] text-stone-500 mt-0.5">
                  POS orders, logistics manifests, and kitchen viewing.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole("Owner")}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  role === "Owner"
                    ? "bg-purple-50 border-purple-400 ring-1 ring-purple-400"
                    : "bg-stone-50 border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>👑 Owner</span>
                </div>
                <span className="text-[10px] text-stone-500 mt-0.5">
                  Full administrative CMS, user provisioning &amp; pricing governance.
                </span>
              </button>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={createUserMutation.isPending}
              className="border-stone-300 text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createUserMutation.isPending}
              className="bg-[#C81E1E] hover:bg-[#A81818] text-white"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <span>Provision Account</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
