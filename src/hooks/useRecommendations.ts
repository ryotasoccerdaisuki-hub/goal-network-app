'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import type { RecommendationResponse } from '@/lib/types'

export function useRecommendations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (availableMinutes: number) =>
      apiPost<RecommendationResponse>('/api/recommendations', { availableMinutes }),
    onSuccess: (data) => {
      qc.setQueryData(['recommendations'], data)
    },
  })
}
