/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { toast } from 'sonner';

export interface UserListItemDto {
  id: number;
  username: string;
  fullName: string;
  role: 'Owner' | 'Cashier' | string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  role: 'Owner' | 'Cashier' | string;
}

export interface UpdateUserPasswordRequest {
  newPassword: string;
}

export interface UpdateUserStatusRequest {
  isActive: boolean;
}

export function useUsersQuery() {
  return useQuery<UserListItemDto[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<UserListItemDto[]>('/users');
      return response.data;
    },
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation<UserListItemDto, Error, CreateUserRequest>({
    mutationFn: async (payload: CreateUserRequest) => {
      const response = await apiClient.post<UserListItemDto>('/users', payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Staff Account Created', {
        description: `Successfully provisioned ${data.role} account for ${data.fullName} (@${data.username}).`,
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to create staff account.';
      toast.error('Provisioning Error', {
        description: message,
      });
    },
  });
}

export function useUpdateUserPasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, { id: number; newPassword: string }>({
    mutationFn: async ({ id, newPassword }) => {
      const response = await apiClient.put<{ message: string }>(`/users/${id}/password`, {
        newPassword,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Password Updated', {
        description: 'Shift password updated successfully.',
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to update shift password.';
      toast.error('Password Update Failed', {
        description: message,
      });
    },
  });
}

export function useToggleUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation<UserListItemDto, Error, { id: number; isActive: boolean }>({
    mutationFn: async ({ id, isActive }) => {
      const response = await apiClient.patch<UserListItemDto>(`/users/${id}/status`, {
        isActive,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const statusLabel = data.isActive ? 'activated' : 'deactivated';
      toast.success(`Account ${data.isActive ? 'Activated' : 'Deactivated'}`, {
        description: `Staff account @${data.username} is now ${statusLabel}.`,
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to toggle account status.';
      toast.error('Action Failed', {
        description: message,
      });
    },
  });
}
