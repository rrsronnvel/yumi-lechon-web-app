import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/services/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, User, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

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
  const { login, isAuthenticated, apiEnv, apiBaseUrl, switchApiEnv } = useAuth();

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
    <div className="min-h-screen bg-gradient-to-br from-[#181312] via-[#241A18] to-[#36221E] flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-white relative overflow-hidden">
      {/* Warm Terracotta & Golden Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-[#DDA196]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <img
            src="/yumi-logo.png"
            alt="Yumi's Lechon Official Logo"
            className="w-24 h-24 rounded-full mx-auto ring-4 ring-amber-400/50 shadow-xl mb-4 object-cover"
          />
          <h1 className="text-2xl font-extrabold tracking-wider text-amber-400 uppercase">
            Yumi&apos;s Lechon
          </h1>
          <p className="text-xs tracking-wider uppercase text-stone-300 font-medium mt-1">
            Management &amp; Operations System
          </p>
        </div>

        {/* High-Contrast Warm Espresso Login Card */}
        <Card className="border-stone-800/90 bg-[#181312]/95 backdrop-blur-xl shadow-2xl text-stone-100 rounded-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold tracking-tight text-white flex items-center justify-between">
              <span>Shift Sign-In</span>
              <span className="text-[11px] font-medium text-amber-400 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                12h Shift JWT
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-stone-400">
              Enter your staff credentials to access roasting, logistics, and store management.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Target Backend Environment Switcher Pill */}
            <div className="bg-[#120E0D] border border-stone-800 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                <span>Target Backend Environment</span>
                <span className="font-mono text-amber-400/90 text-[10px] truncate max-w-[200px]" title={apiBaseUrl}>
                  {apiBaseUrl}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchApiEnv("cloud")}
                  aria-pressed={apiEnv === "cloud"}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    apiEnv === "cloud"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-xs"
                      : "bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700"
                  }`}
                >
                  <span>☁️ Live Cloud</span>
                  {apiEnv === "cloud" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => switchApiEnv("local")}
                  aria-pressed={apiEnv === "local"}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    apiEnv === "local"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-xs"
                      : "bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700"
                  }`}
                >
                  <span>💻 Local (5199)</span>
                  {apiEnv === "local" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              </div>
            </div>
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
                  className="block text-xs font-medium text-stone-300"
                >
                  Staff Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
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
                    className="pl-9 bg-stone-950/80 border-stone-700 text-white placeholder:text-stone-500 focus-visible:border-amber-400 focus-visible:ring-amber-400/30 h-10"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="current-password"
                    className="block text-xs font-medium text-stone-300"
                  >
                    Shift Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
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
                    className="pl-9 pr-10 bg-stone-950/80 border-stone-700 text-white placeholder:text-stone-500 focus-visible:border-amber-400 focus-visible:ring-amber-400/30 h-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Single Submit Button — Yumi's Lechon Crimson */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold h-10 shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Shift...</span>
                  </>
                ) : (
                  <span>Sign In to Shift</span>
                )}
              </Button>
            </form>

            {/* Quick Helper for Test Accounts */}
            <div className="mt-5 pt-4 border-t border-stone-800 text-[11px] text-stone-400 space-y-1.5">
              <p className="font-semibold text-stone-300">Default Staff Access:</p>
              <div className="flex items-center justify-between text-stone-400 bg-stone-950/60 px-2.5 py-1.5 rounded-md border border-stone-800">
                <span>👑 Owner: <code className="text-amber-400">owner</code> / <code className="text-stone-300">OwnerPassword123!</code></span>
                <button
                  type="button"
                  className="text-amber-400 hover:underline font-medium ml-2 cursor-pointer"
                  onClick={() => {
                    setUsername("owner");
                    setPassword("OwnerPassword123!");
                  }}
                >
                  Fill
                </button>
              </div>
              <div className="flex items-center justify-between text-stone-400 bg-stone-950/60 px-2.5 py-1.5 rounded-md border border-stone-800">
                <span>🧑‍💼 Cashier: <code className="text-stone-200">cashier</code> / <code className="text-stone-300">CashierPassword123!</code></span>
                <button
                  type="button"
                  className="text-amber-400 hover:underline font-medium ml-2 cursor-pointer"
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
        <p className="text-center text-[11px] text-stone-400">
          Cavite Lechon Roasting Operations &bull; Shift Security Protected
        </p>
      </div>
    </div>
  );
}
