'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import type { Action, ActionDetail, Status, ActionType } from '@/lib/types'

export function useActions(status?: Status | 'ALL', type?: ActionType | 'ALL') {
  const params = new URLSearchParams()
  if (status && status !== 'ALL') params.set('status', status)
  if (type && type !== 'ALL') params.set('type', type)
  const query = params.toString() ? `?${params.toString()}` : ''
  return useQuery({
    queryKey: ['actions', status ?? 'ALL', type ?? 'ALL'],
    queryFn: () => apiGet<Action[]>(`/api/actions${query}`),
  })
}

export function useAction(id: number | undefined) {
  return useQuery({
    queryKey: ['action', id],
    queryFn: () => apiGet<ActionDetail>(`/api/actions/${id}`),
    enabled: id != null,
  })
}

export function useCreateAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Action>('/api/actions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['actions'] }),
  })
}

export function useUpdateAction(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPatch<Action>(`/api/actions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] })
      qc.invalidateQueries({ queryKey: ['action', id] })
    },
  })
}

export function useDeleteAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/api/actions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['actions'] }),
  })
}
