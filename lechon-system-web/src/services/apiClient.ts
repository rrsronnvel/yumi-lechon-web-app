import axios from 'axios';
import type { ParsedOrderDraftDto } from '@/schemas/orderSchema';
import { clearAuthSession, readAuthSession } from './authSession';
export { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from './authSession';

export type ApiEnvironment = 'cloud' | 'local';

export const CLOUD_API_URL = 'https://ronnvel-001-site1.ktempurl.com/api';
export const LOCAL_API_URL = 'http://localhost:5199/api';

export const ENV_STORAGE_KEY = 'lechon_api_env';
export const LEGACY_ENV_STORAGE_KEY = 'lechon_api_environment';

export const getApiEnvironment = (): ApiEnvironment => {
  if (typeof window === 'undefined') return 'cloud';
  const saved = localStorage.getItem(ENV_STORAGE_KEY) || localStorage.getItem(LEGACY_ENV_STORAGE_KEY);
  if (saved === 'local' || saved === 'cloud') {
    return saved;
  }
  // Default to 'local' on localhost / 127.0.0.1, otherwise 'cloud'
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'local';
  }
  return 'cloud';
};

export const getApiBaseUrl = (): string => {
  return getApiEnvironment() === 'local' ? LOCAL_API_URL : CLOUD_API_URL;
};

export const setApiEnvironment = (env: ApiEnvironment): void => {
  localStorage.setItem(ENV_STORAGE_KEY, env);
  localStorage.setItem(LEGACY_ENV_STORAGE_KEY, env);
  clearAuthSession();
  window.location.reload();
};

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

function isPublicAuthRoute(method: string | undefined, url: string | undefined) {
  const path = url?.split('?')[0];
  if (method === 'get') return /^\/logistics\/settlements\/qr-session\/[^/]+$/.test(path ?? '');
  return method === 'post' && (path === '/auth/login' ||
    /^\/logistics\/settlements\/qr-session\/[^/]+\/(rider-sign|owner-approve)$/.test(path ?? ''));
}

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  // Strip redundant leading /api if present to prevent double-prefixing
  if (config.url?.startsWith('/api/')) {
    config.url = config.url.replace(/^\/api/, '');
  }
  const session = readAuthSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.token}`;
  } else if (!isPublicAuthRoute(config.method, config.url)) {
    throw new axios.CanceledError('Sign in to access this endpoint.');
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicAuthRoute(error.config?.method, error.config?.url)) {
      clearAuthSession();
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
