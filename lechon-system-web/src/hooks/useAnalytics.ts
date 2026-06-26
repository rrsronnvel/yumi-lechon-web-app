import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// 1. Define the shapes of the data based on our .NET DTOs
export interface SalesData {
  date: string;
  revenue: number;
}

export interface DeliveryPerformanceData {
  date: string;
  averageTransitTimeMinutes: number;
}

export interface WastageData {
  category: string;
  weightLostKg: number;
}

// 2. Export the custom hooks to fetch the data
export const useSalesAnalytics = () => {
  return useQuery({
    queryKey: ['analytics', 'sales'],
    queryFn: async () => {
      const { data } = await axios.get<SalesData[]>('/api/analytics/sales');
      return data;
    }
  });
};

export const useDeliveryPerformance = () => {
  return useQuery({
    queryKey: ['analytics', 'delivery-performance'],
    queryFn: async () => {
      const { data } = await axios.get<DeliveryPerformanceData[]>('/api/analytics/delivery-performance');
      return data;
    }
  });
};

export const useWastageAnalytics = () => {
  return useQuery({
    queryKey: ['analytics', 'wastage'],
    queryFn: async () => {
      const { data } = await axios.get<WastageData[]>('/api/analytics/wastage');
      return data;
    }
  });
};