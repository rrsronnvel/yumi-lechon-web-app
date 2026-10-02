import axios from 'axios';
import { ParsedOrderDraftDto } from '@/schemas/orderSchema';

// This creates a reusable "phone line" that already knows the backend's number
const apiClient = axios.create({
    baseURL: 'http://localhost:5199/api', // Double check your actual .NET port!
    headers: {
        'Content-Type': 'application/json'
    }
});

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