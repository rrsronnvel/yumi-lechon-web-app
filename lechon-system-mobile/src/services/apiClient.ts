import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export type ApiEnvironment = 'cloud' | 'local';

export const CLOUD_API_URL = 'https://ronnvel-001-site1.ktempurl.com/api';
export const LOCAL_API_URL = 'http://10.0.2.2:5199/api';

export const TOKEN_STORAGE_KEY = 'lechon_auth_token';
export const USER_STORAGE_KEY = 'lechon_auth_user';
export const ENV_STORAGE_KEY = 'lechon_api_env';

let activeEnv: ApiEnvironment = 'cloud';
let activeToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const getApiEnvironment = (): ApiEnvironment => activeEnv;

export const getApiBaseUrl = (): string => {
  return activeEnv === 'local' ? LOCAL_API_URL : CLOUD_API_URL;
};

const apiClient = axios.create({
  baseURL: CLOUD_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

export const setApiEnvironment = async (mode: ApiEnvironment): Promise<void> => {
  activeEnv = mode;
  apiClient.defaults.baseURL = getApiBaseUrl();
  try {
    await SecureStore.setItemAsync(ENV_STORAGE_KEY, mode);
  } catch (err) {
    console.warn('Failed to persist API environment to SecureStore:', err);
  }
};

export const hydrateApiEnvironment = async (): Promise<ApiEnvironment> => {
  try {
    const saved = await SecureStore.getItemAsync(ENV_STORAGE_KEY);
    if (saved === 'local' || saved === 'cloud') {
      activeEnv = saved;
      apiClient.defaults.baseURL = getApiBaseUrl();
    }
  } catch (err) {
    console.warn('Failed to read API environment from SecureStore:', err);
  }
  return activeEnv;
};

export const setActiveToken = (token: string | null): void => {
  activeToken = token;
};

export const getActiveToken = (): string | null => activeToken;

export const registerUnauthorizedHandler = (handler: (() => void) | null): void => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  if (activeToken && config.headers) {
    config.headers.Authorization = `Bearer ${activeToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      activeToken = null;
      try {
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
        await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
      } catch (e) {
        console.warn('Failed clearing SecureStore on 401:', e);
      }
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
