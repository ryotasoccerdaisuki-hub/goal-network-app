// src/lib/reason-text.ts
//
// 推奨理由テキストをテンプレートで生成する純粋関数。
// design.md「推奨理由テキスト生成」に準拠する。

import { WEIGHT_VALUES, type WeightLevel, type ScoringBreakdown } from './recommendation-engine'

const MS_PER_DAY = 86_400_000

export interface ReasonTextInput {
  deadline: Date | null
  // 関連先 Goal の importance 一覧（Active Goal に限らず、関連する全 Goal の重要度）
  goalImportances: WeightLevel[]
}

export function generateReasonText(
  input: ReasonTextInput,
  breakdown: ScoringBreakdown,
  today: Date
): string {
  const parts: string[] = []

  // 関連目標の数（2つ以上で明示）
  if (breakdown.uniqueActiveGoalCount >= 2) {
    parts.push(`${breakdown.uniqueActiveGoalCount}つの目標に貢献`)
  }

  // 期限の緊急度
  if (input.deadline) {
    const deadlineDay = Date.UTC(
      input.deadline.getUTCFullYear(),
      input.deadline.getUTCMonth(),
      input.deadline.getUTCDate()
    )
    const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const daysLeft = Math.floor((deadlineDay - todayDay) / MS_PER_DAY)
    if (daysLeft < 0) {
      parts.push(`期限切れ（${Math.abs(daysLeft)}日超過）`)
    } else {
      parts.push(`期限まで${daysLeft}日`)
    }
  }

  // 重要度の最高値
  if (input.goalImportances.length > 0) {
    const maxImportance = Math.max(...input.goalImportances.map((i) => WEIGHT_VALUES[i]))
    if (maxImportance === 3) parts.push('重要度：高')
    else if (maxImportance === 2) parts.push('重要度：中')
  }

  return parts.join(' / ') || '関連する目標への貢献行動'
}
