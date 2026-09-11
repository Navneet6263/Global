"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { CreateUserInput, UserQuery } from "@/lib/contracts/user";
import { updateUser } from "@/lib/backend-api/users";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";

export function useUsers(query: UserQuery) {
  return useQuery({
    queryKey: queryKeys.users(query),
    queryFn: () => api.users.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.users.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: "active" | "suspended" }) =>
      api.users.setStatus(input.id, input.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: string) => api.users.resetPassword(id),
  });
}

export function useUpdateUserRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      version: number;
      roleCodes: string[];
      additionalAccessConfirmed: boolean;
    }) => {
      const { id, ...body } = input;
      return updateUser(id, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["case-dispatch-preview"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
      void invalidateWorkflow(queryClient);
    },
  });
}
