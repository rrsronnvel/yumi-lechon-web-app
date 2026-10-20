import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  setActiveToken,
  registerUnauthorizedHandler,
  ApiEnvironment,
  getApiEnvironment,
  setApiEnvironment,
  hydrateApiEnvironment,
} from '../services/apiClient';

export interface UserProfile {
  id?: number;
  username: string;
  fullName: string;
  role: 'Owner' | 'Cashier' | string;
}

interface LoginResponse {
  token: string;
  username: string;
  fullName: string;
  role: string;
  expiresAt: string;
}

export interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isLoading: boolean;
  apiEnv: ApiEnvironment;
  switchApiEnv: (mode: ApiEnvironment) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiEnv, setApiEnvState] = useState<ApiEnvironment>(getApiEnvironment());

  const clearSessionState = useCallback(() => {
    setActiveToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearSessionState();
    });
    return () => {
      registerUnauthorizedHandler(null);
    };
  }, [clearSessionState]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const hydratedEnv = await hydrateApiEnvironment();
        const savedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
        const savedUserJson = await SecureStore.getItemAsync(USER_STORAGE_KEY);

        if (!isMounted) return;
        setApiEnvState(hydratedEnv);

        if (savedToken && savedUserJson) {
          try {
            const parsedUser = JSON.parse(savedUserJson) as UserProfile;
            setActiveToken(savedToken);
            setToken(savedToken);
            setUser(parsedUser);
          } catch {
            await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
            await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.warn('Error hydrating auth session from SecureStore:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const switchApiEnv = useCallback(async (mode: ApiEnvironment) => {
    await setApiEnvironment(mode);
    setApiEnvState(mode);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const trimmedUser = username.trim();
    const response = await apiClient.post<LoginResponse>('/auth/login', {
      username: trimmedUser,
      password,
    });

    const data = response.data;
    const newUser: UserProfile = {
      username: data.username,
      fullName: data.fullName,
      role: data.role,
    };

    setActiveToken(data.token);
    setToken(data.token);
    setUser(newUser);

    try {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, data.token);
      await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(newUser));
    } catch (err) {
      console.warn('Failed to persist credentials to SecureStore:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    clearSessionState();
    try {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed clearing SecureStore on logout:', err);
    }
  }, [clearSessionState]);

  const isAuthenticated = Boolean(token && user);
  const isOwner = user?.role === 'Owner';

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        isOwner,
        isLoading,
        apiEnv,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
