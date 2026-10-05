'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api-client'
import type { AvailableDailyTime } from '@/lib/types'

export function useAvailableDailyTime(date: string | undefined) {
  return useQuery({
    queryKey: ['available-daily-time', date],
    queryFn: () => apiGet<AvailableDailyTime | null>(`/api/available-daily-time?date=${date}`),
    enabled: date != null,
  })
}

export function useUpsertAvailableDailyTime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { date: string; availableMinutes: number }) =>
      apiPut<AvailableDailyTime>('/api/available-daily-time', data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['available-daily-time', vars.date] })
    },
  })
}
