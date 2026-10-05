'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import type { ActionLink } from '@/lib/types'

export function useActionLinks(actionId: number | undefined) {
  return useQuery({
    queryKey: ['action-links', actionId],
    queryFn: () => apiGet<ActionLink[]>(`/api/actions/${actionId}/links`),
    enabled: actionId != null,
  })
}

export function useCreateActionLink(actionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<ActionLink>(`/api/actions/${actionId}/links`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-links', actionId] })
      qc.invalidateQueries({ queryKey: ['action', actionId] })
    },
  })
}

export function useDeleteActionLink(actionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: number) => apiDelete<void>(`/api/action-links/${linkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-links', actionId] })
      qc.invalidateQueries({ queryKey: ['action', actionId] })
    },
  })
}
