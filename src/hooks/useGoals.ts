'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import type { Goal, GoalDetail, Status } from '@/lib/types'

export function useGoals(status?: Status | 'ALL') {
  const query = status && status !== 'ALL' ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['goals', status ?? 'ALL'],
    queryFn: () => apiGet<Goal[]>(`/api/goals${query}`),
  })
}

export function useGoal(id: number | undefined) {
  return useQuery({
    queryKey: ['goal', id],
    queryFn: () => apiGet<GoalDetail>(`/api/goals/${id}`),
    enabled: id != null,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Goal>('/api/goals', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPatch<Goal>(`/api/goals/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['goal', id] })
    },
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/api/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}
