import axios from 'axios';
import { ParsedOrderDraftDto } from '@/schemas/orderSchema';

export type ApiEnvironment = 'cloud' | 'local';

export const CLOUD_API_URL = 'https://ronnvel-001-site1.ktempurl.com/api';
export const LOCAL_API_URL = 'http://localhost:5199/api';

export const ENV_STORAGE_KEY = 'lechon_api_environment';
export const TOKEN_STORAGE_KEY = 'lechon_auth_token';
export const USER_STORAGE_KEY = 'lechon_auth_user';

export const getApiEnvironment = (): ApiEnvironment => {
  if (typeof window === 'undefined') return 'cloud';
  const saved = localStorage.getItem(ENV_STORAGE_KEY);
  if (saved === 'local' || saved === 'cloud') {
    return saved;
  }
  return 'cloud';
};

export const getApiBaseUrl = (): string => {
  return getApiEnvironment() === 'local' ? LOCAL_API_URL : CLOUD_API_URL;
};

export const setApiEnvironment = (env: ApiEnvironment): void => {
  localStorage.setItem(ENV_STORAGE_KEY, env);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  window.location.reload();
};

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  // Strip redundant leading /api if present to prevent double-prefixing
  if (config.url?.startsWith('/api/')) {
    config.url = config.url.replace(/^\/api/, '');
  }
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const parseOrderScreenshot = async (file: File): Promise<ParsedOrderDraftDto> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<ParsedOrderDraftDto>('/orders/parse-screenshot', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export default apiClient;
