import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  ApiEnvironment,
  getApiEnvironment,
  getApiBaseUrl,
  setApiEnvironment,
  ENV_STORAGE_KEY,
  LEGACY_ENV_STORAGE_KEY,
} from "@/services/apiClient";
import { clearAuthSession, readAuthSession, TOKEN_STORAGE_KEY, USER_STORAGE_KEY, type UserProfile } from "@/services/authSession";
export type { UserProfile } from "@/services/authSession";

export interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  apiEnv: ApiEnvironment;
  apiBaseUrl: string;
  switchApiEnv: (env: ApiEnvironment) => void;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState(() => readAuthSession());
  const [apiEnv, setApiEnv] = useState<ApiEnvironment>(() => getApiEnvironment());

  const switchApiEnv = useCallback((env: ApiEnvironment) => {
    setApiEnv(env);
    setApiEnvironment(env);
  }, []);

  const login = useCallback((newToken: string, newUser: UserProfile) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    const authenticatedSession = readAuthSession();
    setSession(authenticatedSession);
    if (!authenticatedSession) throw new Error("The server returned an invalid shift session.");
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
    window.location.href = "/login";
  }, []);

  // Sync state if localStorage changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY || e.key === USER_STORAGE_KEY || e.key === null) {
        setSession(readAuthSession());
      } else if (e.key === ENV_STORAGE_KEY || e.key === LEGACY_ENV_STORAGE_KEY) {
        if (e.newValue === "local" || e.newValue === "cloud") {
          setApiEnv(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining > 2_147_483_647) return;
    const timeout = window.setTimeout(() => setSession(readAuthSession()), Math.max(0, remaining));
    return () => window.clearTimeout(timeout);
  }, [session]);

  const currentSession = session && Date.now() < session.expiresAt ? session : null;
  const token = currentSession?.token ?? null;
  const user = currentSession?.user ?? null;
  const isAuthenticated = currentSession !== null;
  const isOwner = user?.role === "Owner";

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        isOwner,
        apiEnv,
        apiBaseUrl: getApiBaseUrl(),
        switchApiEnv,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
