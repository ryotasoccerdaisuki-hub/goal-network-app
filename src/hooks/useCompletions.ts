'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiDelete } from '@/lib/api-client'
import type { CompletionRecord } from '@/lib/types'

export function useCompleteAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (actionId: number) =>
      apiPost<CompletionRecord>(`/api/actions/${actionId}/complete`, {}),
    onSuccess: (_data, actionId) => {
      qc.invalidateQueries({ queryKey: ['actions'] })
      qc.invalidateQueries({ queryKey: ['action', actionId] })
      qc.invalidateQueries({ queryKey: ['recommendations'] })
      qc.invalidateQueries({ queryKey: ['goal'] })
      qc.invalidateQueries({ queryKey: ['goal-requirement'] })
    },
  })
}

export function useUncompleteAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: number) => apiDelete<void>(`/api/completion-records/${recordId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] })
      qc.invalidateQueries({ queryKey: ['action'] })
      qc.invalidateQueries({ queryKey: ['recommendations'] })
      qc.invalidateQueries({ queryKey: ['goal'] })
      qc.invalidateQueries({ queryKey: ['goal-requirement'] })
    },
  })
}
