import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import {
  calcPriorityScore,
  calcUrgencyFactor,
  calcCrossGoalBonus,
  calcNormalizedDuration,
  selectRecommendations,
  WEIGHT_VALUES,
  type ActionInput,
  type ScoredAction,
  type WeightLevel,
} from '@/lib/recommendation-engine'
import { SCORING_CONFIG } from '@/lib/scoring-config'

const MS_PER_DAY = 86_400_000

// 固定の「今日」（UTC 00:00:00）
const TODAY = new Date(Date.UTC(2026, 0, 1))

// 残日数 d から deadline を生成するヘルパー（UTC 日付境界）
function deadlineFromDaysLeft(d: number): Date {
  return new Date(TODAY.getTime() + d * MS_PER_DAY)
}

const weightArb = fc.constantFrom<WeightLevel>('HIGH', 'MEDIUM', 'LOW')

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 2: UrgencyFactor は残日数の閾値に従って決定される
// Validates: Requirements 5.5, 5.6, 5.7, 5.8
// ──────────────────────────────────────────────────────────
describe('Property 2: calcUrgencyFactor', () => {
  it('残日数の閾値に従って正しい係数を返す', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3650, max: 3650 }), (daysLeft) => {
        const deadline = deadlineFromDaysLeft(daysLeft)
        const factor = calcUrgencyFactor(deadline, TODAY)

        if (daysLeft < 0) {
          expect(factor).toBe(SCORING_CONFIG.urgencyFactor.overdue)
        } else if (daysLeft <= 7) {
          expect(factor).toBe(SCORING_CONFIG.urgencyFactor.within7Days)
        } else if (daysLeft <= 30) {
          expect(factor).toBe(SCORING_CONFIG.urgencyFactor.within30Days)
        } else {
          expect(factor).toBe(SCORING_CONFIG.urgencyFactor.noDeadline)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('期限なし（null）は常に 1.0 を返す', () => {
    fc.assert(
      fc.property(fc.date(), (today) => {
        expect(calcUrgencyFactor(null, today)).toBe(SCORING_CONFIG.urgencyFactor.noDeadline)
      }),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 3: CrossGoalBonus は Active Goal 数のみに依存する
// Validates: Requirements 5.4, 4.6
// ──────────────────────────────────────────────────────────
describe('Property 3: calcCrossGoalBonus', () => {
  it('Active Goal 数に従って正しいボーナス係数を返す', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
        const bonus = calcCrossGoalBonus(n)
        if (n >= 3) {
          expect(bonus).toBe(SCORING_CONFIG.crossGoalBonus.threeOrMoreGoals)
        } else if (n === 2) {
          expect(bonus).toBe(SCORING_CONFIG.crossGoalBonus.twoGoals)
        } else {
          // n = 0 または n = 1
          expect(bonus).toBe(SCORING_CONFIG.crossGoalBonus.oneGoal)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 1: PriorityScore 計算式の正確性
// Validates: Requirements 5.1, 5.2, 5.3, 5.9, 5.10, 10.4
// ──────────────────────────────────────────────────────────

// 有効な ActionInput を生成する Arbitrary。
// activeGoalIds と actionLinks.targetGoalId を整合させるため、
// まず Goal ID 群を生成し、そこから ActionLink と activeGoalIds を導出する。
const validActionInputArb: fc.Arbitrary<ActionInput> = fc
  .record({
    id: fc.integer({ min: 1, max: 10000 }),
    requiredMinutes: fc.integer({ min: 1, max: 1440 }),
    deadline: fc.option(fc.integer({ min: -365, max: 365 }).map(deadlineFromDaysLeft), {
      nil: null,
    }),
    actionType: fc.constantFrom<'TASK' | 'HABIT'>('TASK', 'HABIT'),
    goalIds: fc.uniqueArray(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 5 }),
  })
  .chain((base) => {
    // 各 Goal に対して ActionLink を1つ生成する
    const linksArb = fc.tuple(
      ...base.goalIds.map((goalId) =>
        fc.record({
          targetGoalId: fc.constant(goalId),
          contributionWeight: weightArb,
          goalImportance: weightArb,
        })
      )
    )
    // activeGoalIds は全 Goal がアクティブなケースと一部のみのケースの両方をカバーする
    return fc.record({
      id: fc.constant(base.id),
      requiredMinutes: fc.constant(base.requiredMinutes),
      deadline: fc.constant(base.deadline),
      actionType: fc.constant(base.actionType),
      actionLinks: linksArb,
      activeGoalIds: fc.subarray(base.goalIds),
    })
  })

// 参照実装：仕様の計算式をそのまま計算する
function computeExpectedScore(action: ActionInput, today: Date): number {
  const activeSet = new Set(action.activeGoalIds)
  const activeLinks = action.actionLinks.filter((l) => activeSet.has(l.targetGoalId))

  const uniqueActiveGoalCount = activeSet.size
  if (uniqueActiveGoalCount === 0) return 0

  const sumProduct = activeLinks.reduce(
    (s, l) => s + WEIGHT_VALUES[l.goalImportance] * WEIGHT_VALUES[l.contributionWeight],
    0
  )
  if (sumProduct === 0) return 0

  const crossGoalBonus = calcCrossGoalBonus(uniqueActiveGoalCount)
  const urgencyFactor = calcUrgencyFactor(action.deadline, today)
  const normalizedDuration = calcNormalizedDuration(action.requiredMinutes)

  const raw = (sumProduct * crossGoalBonus * urgencyFactor) / normalizedDuration
  return Math.round(raw * 100) / 100
}

describe('Property 1: calcPriorityScore', () => {
  it('任意の有効な ActionInput に対して計算式と一致する', () => {
    fc.assert(
      fc.property(validActionInputArb, (action) => {
        const breakdown = calcPriorityScore(action, TODAY)
        const expected = computeExpectedScore(action, TODAY)
        expect(Math.abs(breakdown.priorityScore - expected)).toBeLessThan(0.005)
      }),
      { numRuns: 200 }
    )
  })

  it('Active Goal が0件の場合は常にスコア0を返す', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          requiredMinutes: fc.integer({ min: 1, max: 1440 }),
          deadline: fc.option(fc.date(), { nil: null }),
          actionType: fc.constantFrom<'TASK' | 'HABIT'>('TASK', 'HABIT'),
          actionLinks: fc.array(
            fc.record({
              targetGoalId: fc.integer({ min: 1, max: 50 }),
              contributionWeight: weightArb,
              goalImportance: weightArb,
            }),
            { maxLength: 5 }
          ),
          activeGoalIds: fc.constant<number[]>([]),
        }),
        (action) => {
          const breakdown = calcPriorityScore(action, TODAY)
          expect(breakdown.priorityScore).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────
// selectRecommendations 用の ScoredAction Arbitrary
// ──────────────────────────────────────────────────────────
const scoredActionArb: fc.Arbitrary<ScoredAction> = fc
  .record({
    actionId: fc.integer({ min: 1, max: 10000 }),
    requiredMinutes: fc.integer({ min: 1, max: 300 }),
    priorityScore: fc.double({ min: 0, max: 100, noNaN: true }),
    goalIds: fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 0, maxLength: 4 }),
  })
  .map((r) => ({
    actionId: r.actionId,
    requiredMinutes: r.requiredMinutes,
    priorityScore: r.priorityScore,
    breakdown: {
      linkBreakdowns: r.goalIds.map((goalId) => ({
        goalId,
        importanceWeight: 1,
        contributionWeight: 1,
        product: 1,
      })),
      sumImportanceContribution: r.goalIds.length,
      uniqueActiveGoalCount: r.goalIds.length,
      crossGoalBonus: 1,
      urgencyFactor: 1,
      normalizedDuration: 1,
      priorityScore: r.priorityScore,
    },
  }))

const candidatesArb = fc.uniqueArray(scoredActionArb, {
  minLength: 0,
  maxLength: 15,
  selector: (a) => a.actionId,
})

// 参照：全候補から時間制約を満たす 1〜3 件の組み合わせを全探索して最大スコアを求める
function bruteForceBestScore(candidates: ScoredAction[], availableMinutes: number): number {
  // selectRecommendations と同じく上位 maxCandidates 件に絞る
  const top = [...candidates]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, SCORING_CONFIG.maxCandidates)

  let best = -1
  const n = top.length
  for (let i = 0; i < n; i++) {
    // 1件
    if (top[i].requiredMinutes <= availableMinutes) {
      best = Math.max(best, top[i].priorityScore)
    }
    for (let j = i + 1; j < n; j++) {
      // 2件
      if (top[i].requiredMinutes + top[j].requiredMinutes <= availableMinutes) {
        best = Math.max(best, top[i].priorityScore + top[j].priorityScore)
      }
      for (let k = j + 1; k < n; k++) {
        // 3件
        const t = top[i].requiredMinutes + top[j].requiredMinutes + top[k].requiredMinutes
        if (t <= availableMinutes) {
          best = Math.max(
            best,
            top[i].priorityScore + top[j].priorityScore + top[k].priorityScore
          )
        }
      }
    }
  }
  return best
}

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 4: 推奨選定の時間制約不変条件
// Validates: Requirements 7.2
// ──────────────────────────────────────────────────────────
describe('Property 4: selectRecommendations 時間制約', () => {
  it('推奨の合計必要時間は availableMinutes を超えない', () => {
    fc.assert(
      fc.property(candidatesArb, fc.integer({ min: 1, max: 1440 }), (candidates, available) => {
        const result = selectRecommendations(candidates, available)
        expect(result.totalRequiredMinutes).toBeLessThanOrEqual(available)
        const sum = result.recommendations.reduce((s, a) => s + a.requiredMinutes, 0)
        expect(sum).toBeLessThanOrEqual(available)
        expect(result.recommendations.length).toBeLessThanOrEqual(
          SCORING_CONFIG.maxRecommendations
        )
      }),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 5: 推奨選定はスコア合計最大の組み合わせを選ぶ
// Validates: Requirements 7.2
// ──────────────────────────────────────────────────────────
describe('Property 5: selectRecommendations スコア最大', () => {
  it('返す組み合わせのスコア合計は全探索の最大値と一致する', () => {
    fc.assert(
      fc.property(candidatesArb, fc.integer({ min: 1, max: 1440 }), (candidates, available) => {
        const result = selectRecommendations(candidates, available)
        const actual = result.recommendations.reduce((s, a) => s + a.priorityScore, 0)
        const best = bruteForceBestScore(candidates, available)

        if (best < 0) {
          // 時間制約を満たす組み合わせが存在しない
          expect(result.recommendations).toHaveLength(0)
        } else {
          expect(Math.abs(actual - best)).toBeLessThan(1e-6)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 6: 完了済み Task・当日完了済み Habit は推奨候補に含まれない
// Validates: Requirements 7.1, 8.2, 8.3
// ──────────────────────────────────────────────────────────
// selectRecommendations は候補セットのみを扱う純粋関数のため、
// 「除外済みの候補は結果に現れない」ことを検証する。
// （完了済み Task・当日完了済み Habit の除外は Route Handler が候補生成時に行う前提）
describe('Property 6: 除外済み候補は推奨に含まれない', () => {
  it('候補セットに含まれない actionId は推奨結果にも含まれない', () => {
    fc.assert(
      fc.property(candidatesArb, fc.integer({ min: 1, max: 1440 }), (candidates, available) => {
        const candidateIds = new Set(candidates.map((c) => c.actionId))
        const result = selectRecommendations(candidates, available)
        for (const rec of result.recommendations) {
          expect(candidateIds.has(rec.actionId)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('除外した actionId は推奨結果に現れない', () => {
    fc.assert(
      fc.property(
        candidatesArb,
        fc.integer({ min: 1, max: 1440 }),
        fc.integer({ min: 1, max: 10000 }),
        (candidates, available, excludedId) => {
          // excludedId を候補から除外したセットを作る
          const filtered = candidates.filter((c) => c.actionId !== excludedId)
          const result = selectRecommendations(filtered, available)
          for (const rec of result.recommendations) {
            expect(rec.actionId).not.toBe(excludedId)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
