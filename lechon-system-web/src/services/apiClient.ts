import axios from 'axios';
import { ParsedOrderDraftDto } from '@/schemas/orderSchema';

// This creates a reusable "phone line" that already knows the backend's number
const apiClient = axios.create({
    baseURL: "https://ronnvel-001-site1.ktempurl.com/api",// Double check your actual .NET port!
    headers: {
        'Content-Type': 'application/json'
    }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("lechon_auth_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("lechon_auth_token");
      localStorage.removeItem("lechon_auth_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
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