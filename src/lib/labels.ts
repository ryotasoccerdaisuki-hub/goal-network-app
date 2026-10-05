// src/lib/labels.ts
// 列挙型の日本語表示ラベル・バッジ variant マップ。

import type { Status, Importance, ContributionWeight, ActionType } from '@/lib/types'

export const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
}

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

export const CONTRIBUTION_LABEL: Record<ContributionWeight, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

export const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  TASK: 'Task',
  HABIT: 'Habit',
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ja-JP')
}

// input[type=date] 用に ISO 文字列を YYYY-MM-DD に変換
export function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return formatDate(iso)
}
