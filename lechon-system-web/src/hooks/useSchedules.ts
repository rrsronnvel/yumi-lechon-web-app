/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient'; 

// 1. We create a TypeScript blueprint so it knows 'tahiStartTime' is a string
export interface RoastingScheduleItem {
  id: number;
  tahiStartTime: string;
  salangStartTime: string;
  packagingStartTime: string;
  targetDeliveryTime: string;
  // We can add the other fields later, this is enough to satisfy the sorter!
  [key: string]: any; // This tells TS to accept any other properties that come with the object
}

export function useRoastingRoster() {
  // 1. Dynamically calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = tomorrow.toISOString().split('T')[0]; // Formats to "YYYY-MM-DD"

  return useQuery({
    // 2. Add targetDate to the queryKey so the cache knows exactly which day it is holding
    queryKey: ['roster', targetDate], 
    queryFn: async () => {
      // 3. Attach the date to the URL! Now the C# backend knows what to filter.
      const response = await apiClient.get(`/schedules/roster?date=${targetDate}`);
      return response.data;
    },
    select: (data: RoastingScheduleItem[]) => {
      // 4. Added safe sorting. If a time is missing, it won't crash the sort.
      return data.sort((a, b) => {
        const timeA = a.tahiStartTime ? new Date(a.tahiStartTime).getTime() : 0;
        const timeB = b.tahiStartTime ? new Date(b.tahiStartTime).getTime() : 0;
        return timeA - timeB;
      });
    }
  });
}