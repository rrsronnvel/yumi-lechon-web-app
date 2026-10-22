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
import { useUpdateUserPasswordMutation, UserListItemDto } from "@/hooks/useUsers";
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";

interface ResetPasswordModalProps {
  user: UserListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordModal({ user, open, onOpenChange }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const updatePasswordMutation = useUpdateUserPasswordMutation();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setNewPassword("");
      setShowPassword(false);
      setValidationError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setValidationError(null);

    if (!newPassword || newPassword.length < 6) {
      setValidationError("New password must be at least 6 characters.");
      return;
    }

    updatePasswordMutation.mutate(
      {
        id: user.id,
        newPassword,
      },
      {
        onSuccess: () => {
          handleClose(false);
        },
      }
    );
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border-stone-200 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-stone-900">
                Reset Shift Password
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Override the authentication credentials for this staff member.
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

          {/* User Target Card */}
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-900">{user.fullName}</p>
              <p className="text-xs font-mono text-stone-500">@{user.username}</p>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                user.role === "Owner"
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}
            >
              {user.role === "Owner" ? "👑 Owner" : "🧑‍💼 Cashier"}
            </span>
          </div>

          {/* New Password Input */}
          <div className="space-y-1.5">
            <Label htmlFor="reset-new-password" className="text-xs font-semibold text-stone-700">
              New Shift Password
            </Label>
            <div className="relative">
              <Input
                id="reset-new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={updatePasswordMutation.isPending}
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
            <p className="text-[11px] text-stone-500">
              The staff member will be required to use this new password on their next sign-in.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={updatePasswordMutation.isPending}
              className="border-stone-300 text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updatePasswordMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {updatePasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>🔑 Update Password</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
