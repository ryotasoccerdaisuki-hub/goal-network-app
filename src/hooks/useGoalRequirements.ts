'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import type { GoalRequirement, GoalRequirementDetail } from '@/lib/types'

export function useGoalRequirements(goalId: number | undefined) {
  return useQuery({
    queryKey: ['goal-requirements', goalId],
    queryFn: () => apiGet<GoalRequirement[]>(`/api/goals/${goalId}/requirements`),
    enabled: goalId != null,
  })
}

export function useGoalRequirement(id: number | undefined) {
  return useQuery({
    queryKey: ['goal-requirement', id],
    queryFn: () => apiGet<GoalRequirementDetail>(`/api/goal-requirements/${id}`),
    enabled: id != null,
  })
}

export function useCreateGoalRequirement(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<GoalRequirement>(`/api/goals/${goalId}/requirements`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-requirements', goalId] })
      qc.invalidateQueries({ queryKey: ['goal', goalId] })
    },
  })
}

export function useUpdateGoalRequirement(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPatch<GoalRequirement>(`/api/goal-requirements/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-requirement', id] })
      qc.invalidateQueries({ queryKey: ['goal-requirements'] })
    },
  })
}

export function useDeleteGoalRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/api/goal-requirements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-requirements'] })
    },
  })
}
