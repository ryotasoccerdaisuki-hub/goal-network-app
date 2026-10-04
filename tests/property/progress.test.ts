import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import {
  calcGoalProgress,
  calcRequirementProgress,
  type GoalProgressInput,
} from '@/lib/progress'

const taskActionArb = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  isCompleted: fc.boolean(),
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 7: Goal 進捗率の UNION DISTINCT による重複排除
// Validates: Requirements 9.4, 9.5
// ──────────────────────────────────────────────────────────
describe('Property 7: calcGoalProgress UNION DISTINCT', () => {
  it('直接リンクと GoalRequirement 経由の両方に同一 actionId があっても1件として数える', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(taskActionArb, { selector: (a) => a.id, minLength: 0, maxLength: 20 }),
        fc.uniqueArray(taskActionArb, { selector: (a) => a.id, minLength: 0, maxLength: 20 }),
        (directTaskActions, requirementTaskActions) => {
          const input: GoalProgressInput = { directTaskActions, requirementTaskActions }
          const progress = calcGoalProgress(input)

          // 参照：actionId をキーに重複排除した件数で算出
          const unique = new Map<number, boolean>()
          for (const a of [...directTaskActions, ...requirementTaskActions]) {
            if (!unique.has(a.id)) unique.set(a.id, a.isCompleted)
          }
          const total = unique.size
          const expected =
            total === 0
              ? 0
              : Math.floor(([...unique.values()].filter(Boolean).length / total) * 100)

          expect(progress).toBe(expected)
          expect(progress).toBeGreaterThanOrEqual(0)
          expect(progress).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('同一 actionId が両方のリストに現れても重複カウントされない', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(taskActionArb, { selector: (a) => a.id, minLength: 1, maxLength: 15 }),
        (actions) => {
          // 直接リンクと要件経由に同じ内容を渡す（完全重複）
          const input: GoalProgressInput = {
            directTaskActions: actions,
            requirementTaskActions: actions,
          }
          const progress = calcGoalProgress(input)

          // 重複排除されるので actions 単体での進捗率と一致するはず
          const completed = actions.filter((a) => a.isCompleted).length
          const expected = Math.floor((completed / actions.length) * 100)
          expect(progress).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('対象 Task が0件のとき 0 を返す', () => {
    expect(calcGoalProgress({ directTaskActions: [], requirementTaskActions: [] })).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 8: GoalRequirement 進捗率（切り捨て）
// Validates: Requirements 9.1, 9.2
// ──────────────────────────────────────────────────────────
describe('Property 8: calcRequirementProgress', () => {
  it('floor(completed / total * 100) に一致する', () => {
    fc.assert(
      fc.property(
        fc.array(taskActionArb, { minLength: 0, maxLength: 30 }),
        (taskActions) => {
          const progress = calcRequirementProgress(taskActions)

          if (taskActions.length === 0) {
            expect(progress).toBe(0)
          } else {
            const completed = taskActions.filter((a) => a.isCompleted).length
            const expected = Math.floor((completed / taskActions.length) * 100)
            expect(progress).toBe(expected)
          }
          expect(progress).toBeGreaterThanOrEqual(0)
          expect(progress).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('全完了なら100、未完了のみなら0を返す', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (n) => {
        const allCompleted = Array.from({ length: n }, (_, i) => ({ id: i + 1, isCompleted: true }))
        const noneCompleted = Array.from({ length: n }, (_, i) => ({
          id: i + 1,
          isCompleted: false,
        }))
        expect(calcRequirementProgress(allCompleted)).toBe(100)
        expect(calcRequirementProgress(noneCompleted)).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
