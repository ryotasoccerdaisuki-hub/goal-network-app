// src/lib/recommendation-engine.ts
//
// RecommendationEngine は純粋関数モジュールとして実装する。
// DB アクセスは一切含めず、計算に必要なデータはすべて引数として受け取る。
// これによりモックなしでユニットテスト・プロパティベーステストが可能になる。

import { SCORING_CONFIG } from './scoring-config'

// ── 型定義 ──────────────────────────────────────────────

export type WeightLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export const WEIGHT_VALUES: Record<WeightLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

export interface ActionLinkInput {
  targetGoalId: number // GoalRequirement の場合は親 Goal の ID
  contributionWeight: WeightLevel
  goalImportance: WeightLevel
}

export interface ActionInput {
  id: number
  requiredMinutes: number
  deadline: Date | null
  actionType: 'TASK' | 'HABIT'
  actionLinks: ActionLinkInput[]
  activeGoalIds: number[] // ActionLink 先の Status=Active な Goal ID 一覧（重複なし）
}

export interface ScoringBreakdown {
  linkBreakdowns: {
    goalId: number
    importanceWeight: number
    contributionWeight: number
    product: number
  }[]
  sumImportanceContribution: number
  uniqueActiveGoalCount: number
  crossGoalBonus: number
  urgencyFactor: number
  normalizedDuration: number
  priorityScore: number
}

export interface ScoredAction {
  actionId: number
  requiredMinutes: number
  priorityScore: number
  breakdown: ScoringBreakdown
}

export interface RecommendationResult {
  recommendations: ScoredAction[]
  totalRequiredMinutes: number
  remainingMinutes: number
}

// ── 1日のミリ秒 ─────────────────────────────────────────
const MS_PER_DAY = 86_400_000

// ── calcNormalizedDuration ──────────────────────────────
// NormalizedDuration = max(1, requiredMinutes / 30)

export function calcNormalizedDuration(requiredMinutes: number): number {
  return Math.max(1, requiredMinutes / SCORING_CONFIG.normalizedDurationBase)
}

// ── calcUrgencyFactor ───────────────────────────────────
// 期限切れ=3.0 / 0〜7日=2.0 / 8〜30日=1.5 / 31日超または期限なし=1.0
//
// 残日数 d は「期限の日付 - 今日の日付」を日単位（floor）で算出する。
// 時刻成分を無視して日付ベースで比較するため、両者の 00:00:00（UTC）に正規化する。

export function calcUrgencyFactor(deadline: Date | null, today: Date): number {
  if (deadline == null) {
    return SCORING_CONFIG.urgencyFactor.noDeadline
  }

  const deadlineDay = Date.UTC(
    deadline.getUTCFullYear(),
    deadline.getUTCMonth(),
    deadline.getUTCDate()
  )
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

  const daysLeft = Math.floor((deadlineDay - todayDay) / MS_PER_DAY)

  if (daysLeft < 0) {
    return SCORING_CONFIG.urgencyFactor.overdue
  }
  if (daysLeft <= SCORING_CONFIG.urgencyThresholds.immediate) {
    return SCORING_CONFIG.urgencyFactor.within7Days
  }
  if (daysLeft <= SCORING_CONFIG.urgencyThresholds.near) {
    return SCORING_CONFIG.urgencyFactor.within30Days
  }
  return SCORING_CONFIG.urgencyFactor.noDeadline
}

// ── calcCrossGoalBonus ──────────────────────────────────
// 1Goal=1.0 / 2Goals=1.1 / 3Goals以上=1.2 / 0Goal=1.0

export function calcCrossGoalBonus(uniqueActiveGoalCount: number): number {
  if (uniqueActiveGoalCount >= 3) {
    return SCORING_CONFIG.crossGoalBonus.threeOrMoreGoals
  }
  if (uniqueActiveGoalCount === 2) {
    return SCORING_CONFIG.crossGoalBonus.twoGoals
  }
  // n = 1 または n = 0（Goal なし＝スコア0なので係数は任意だが 1.0 を返す）
  return SCORING_CONFIG.crossGoalBonus.oneGoal
}

// ── calcPriorityScore ───────────────────────────────────
// PriorityScore = Σ(ImportanceWeight × ContributionWeight) × CrossGoalBonus × UrgencyFactor ÷ NormalizedDuration
//
// Active な Goal に関連付けられていない Action（activeGoalIds が空）のスコアは常に 0。

export function calcPriorityScore(action: ActionInput, today: Date): ScoringBreakdown {
  const normalizedDuration = calcNormalizedDuration(action.requiredMinutes)
  const urgencyFactor = calcUrgencyFactor(action.deadline, today)

  // Active Goal のみを対象とする。activeGoalIds に含まれる Goal への ActionLink だけを計算に使う。
  const activeGoalIdSet = new Set(action.activeGoalIds)

  const linkBreakdowns = action.actionLinks
    .filter((link) => activeGoalIdSet.has(link.targetGoalId))
    .map((link) => {
      const importanceWeight = WEIGHT_VALUES[link.goalImportance]
      const contributionWeight = WEIGHT_VALUES[link.contributionWeight]
      return {
        goalId: link.targetGoalId,
        importanceWeight,
        contributionWeight,
        product: importanceWeight * contributionWeight,
      }
    })

  const sumImportanceContribution = linkBreakdowns.reduce((sum, b) => sum + b.product, 0)

  // ユニークな Active Goal 数（直接・間接を合算した重複なし件数）
  const uniqueActiveGoalCount = activeGoalIdSet.size

  const crossGoalBonus = calcCrossGoalBonus(uniqueActiveGoalCount)

  // Active Goal が1件も関連付けられていない場合は PriorityScore を 0 とする
  let priorityScore: number
  if (uniqueActiveGoalCount === 0 || sumImportanceContribution === 0) {
    priorityScore = 0
  } else {
    const raw =
      (sumImportanceContribution * crossGoalBonus * urgencyFactor) / normalizedDuration
    // 小数点第2位まで丸める
    priorityScore = Math.round(raw * 100) / 100
  }

  return {
    linkBreakdowns,
    sumImportanceContribution,
    uniqueActiveGoalCount,
    crossGoalBonus,
    urgencyFactor,
    normalizedDuration,
    priorityScore,
  }
}

// ── selectRecommendations ───────────────────────────────
// Step 1: PriorityScore 降順で最大 10 件に絞り込む
// Step 2: 1〜3件のすべての組み合わせを列挙する
// Step 3: 合計必要時間 ≤ availableMinutes の組み合わせを絞り込む
// Step 4: (1) スコア合計降順 → (2) ユニーク Goal 数降順 → (3) 合計時間昇順 で最良を選定する

function generateCombinations(
  items: ScoredAction[],
  minSize: number,
  maxSize: number
): ScoredAction[][] {
  const result: ScoredAction[][] = []

  function backtrack(start: number, current: ScoredAction[]) {
    if (current.length >= minSize && current.length <= maxSize && current.length > 0) {
      result.push([...current])
    }
    if (current.length === maxSize) {
      return
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }

  backtrack(0, [])
  return result
}

export function selectRecommendations(
  candidates: ScoredAction[],
  availableMinutes: number,
  config: typeof SCORING_CONFIG = SCORING_CONFIG
): RecommendationResult {
  // Step 1: PriorityScore 降順で最大 maxCandidates 件に絞り込む
  const top = [...candidates]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, config.maxCandidates)

  // Step 2: 1〜maxRecommendations 件の組み合わせを列挙する
  const combos = generateCombinations(top, 1, config.maxRecommendations)

  // Step 3: 時間制約を満たす組み合わせを絞り込む
  const validCombos = combos.filter(
    (combo) => combo.reduce((sum, a) => sum + a.requiredMinutes, 0) <= availableMinutes
  )

  if (validCombos.length === 0) {
    return { recommendations: [], totalRequiredMinutes: 0, remainingMinutes: availableMinutes }
  }

  // Step 4: 優先順位で最良の組み合わせを選定する
  const best = validCombos.sort((a, b) => {
    // (1) PriorityScore 合計降順
    const scoreA = a.reduce((s, x) => s + x.priorityScore, 0)
    const scoreB = b.reduce((s, x) => s + x.priorityScore, 0)
    if (scoreB !== scoreA) return scoreB - scoreA

    // (2) ユニーク Active Goal 数降順
    const goalsA = new Set(a.flatMap((x) => x.breakdown.linkBreakdowns.map((l) => l.goalId))).size
    const goalsB = new Set(b.flatMap((x) => x.breakdown.linkBreakdowns.map((l) => l.goalId))).size
    if (goalsB !== goalsA) return goalsB - goalsA

    // (3) 合計時間昇順
    const timeA = a.reduce((s, x) => s + x.requiredMinutes, 0)
    const timeB = b.reduce((s, x) => s + x.requiredMinutes, 0)
    return timeA - timeB
  })[0]

  const total = best.reduce((s, x) => s + x.requiredMinutes, 0)
  return {
    recommendations: best,
    totalRequiredMinutes: total,
    remainingMinutes: availableMinutes - total,
  }
}
