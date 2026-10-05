import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/services/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, User, Eye, EyeOff, Loader2, ShieldCheck, Flame } from "lucide-react";

interface LoginResponse {
  token: string;
  username: string;
  fullName: string;
  role: string;
  expiresAt: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated, redirect to target or root
  React.useEffect(() => {
    if (isAuthenticated) {
      const destination = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage("Please enter both username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post<LoginResponse>("/auth/login", {
        username: trimmedUser,
        password: password,
      });

      const data = response.data;
      login(data.token, {
        username: data.username,
        fullName: data.fullName,
        role: data.role,
      });

      toast.success(`Welcome back, ${data.fullName}!`, {
        description: `Logged in as ${data.role}. Your 12-hour shift session is active.`,
      });

      const destination = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";
      navigate(destination, { replace: true });
    } catch (error: unknown) {
      console.error("Login failed:", error);
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError.response?.status === 401) {
        setErrorMessage("Invalid credentials. Please verify your username and password.");
      } else {
        setErrorMessage(
          axiosError.response?.data?.message || "Failed to sign in. Please check your connection."
        );
      }
      toast.error("Authentication Failed", {
        description: "Please check your login credentials and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-white relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-inner mb-1">
            <Flame className="w-8 h-8 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase">
            Yumi's Lechon
          </h1>
          <p className="text-xs tracking-wider uppercase text-slate-400 font-medium">
            Management & Operations System
          </p>
        </div>

        {/* High-Contrast Login Card */}
        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-slate-100">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold tracking-tight text-white flex items-center justify-between">
              <span>Shift Sign-In</span>
              <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                12h Shift JWT
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Enter your staff credentials to access roasting, logistics, and store management.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 text-xs bg-rose-950/50 border border-rose-800/80 text-rose-300 rounded-lg animate-in fade-in"
                >
                  {errorMessage}
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-xs font-medium text-slate-300"
                >
                  Staff Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    enterKeyHint="next"
                    required
                    disabled={isLoading}
                    placeholder="e.g. owner or cashier"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/30 h-10"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="current-password"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Shift Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="current-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    required
                    disabled={isLoading}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/30 h-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Single Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold h-10 shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Shift...</span>
                  </>
                ) : (
                  <span>Start 12-Hour Shift</span>
                )}
              </Button>
            </form>

            {/* Quick Helper for Test Accounts */}
            <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <p className="font-semibold text-slate-300">Default Staff Access:</p>
              <div className="flex items-center justify-between text-slate-400 bg-slate-950/40 px-2.5 py-1 rounded border border-slate-800/80">
                <span>👑 Owner: <code className="text-amber-400">owner</code> / <code className="text-slate-300">OwnerPassword123!</code></span>
                <button
                  type="button"
                  className="text-amber-500 hover:underline ml-2"
                  onClick={() => {
                    setUsername("owner");
                    setPassword("OwnerPassword123!");
                  }}
                >
                  Fill
                </button>
              </div>
              <div className="flex items-center justify-between text-slate-400 bg-slate-950/40 px-2.5 py-1 rounded border border-slate-800/80">
                <span>🧑‍💼 Cashier: <code className="text-blue-400">cashier</code> / <code className="text-slate-300">CashierPassword123!</code></span>
                <button
                  type="button"
                  className="text-blue-400 hover:underline ml-2"
                  onClick={() => {
                    setUsername("cashier");
                    setPassword("CashierPassword123!");
                  }}
                >
                  Fill
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500">
          Cavite Lechon Roasting Operations &bull; Shift Security Protected
        </p>
      </div>
    </div>
  );
}
