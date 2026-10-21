import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  ApiEnvironment,
  getApiEnvironment,
  getApiBaseUrl,
  setApiEnvironment,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  ENV_STORAGE_KEY,
} from "@/services/apiClient";

export interface UserProfile {
  id?: number;
  username: string;
  fullName: string;
  role: "Owner" | "Cashier" | string;
}

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
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser) as UserProfile;
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
  });

  const [apiEnv, setApiEnv] = useState<ApiEnvironment>(() => getApiEnvironment());

  const switchApiEnv = useCallback((env: ApiEnvironment) => {
    setApiEnv(env);
    setApiEnvironment(env);
  }, []);

  const login = useCallback((newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    window.location.href = "/login";
  }, []);

  // Sync state if localStorage changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY) {
        setToken(e.newValue);
      } else if (e.key === USER_STORAGE_KEY) {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } else if (e.key === ENV_STORAGE_KEY) {
        if (e.newValue === "local" || e.newValue === "cloud") {
          setApiEnv(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isAuthenticated = Boolean(token && user);
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
