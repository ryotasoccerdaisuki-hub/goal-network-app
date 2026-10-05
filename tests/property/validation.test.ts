import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { GoalSchema, GoalRequirementSchema, ActionSchema } from '@/schemas'

// Goal/GoalRequirement/Action それぞれに有効な title を差し込んで safeParse するヘルパー。
// title 以外のフィールドは有効な値で固定する。
function parseGoalTitle(title: string) {
  return GoalSchema.safeParse({ title, importance: 'HIGH' })
}
function parseRequirementTitle(title: string) {
  return GoalRequirementSchema.safeParse({ title })
}
function parseActionTitle(title: string) {
  return ActionSchema.safeParse({ title, requiredMinutes: 30, actionType: 'TASK' })
}

const parsers = [
  { name: 'Goal', parse: parseGoalTitle },
  { name: 'GoalRequirement', parse: parseRequirementTitle },
  { name: 'Action', parse: parseActionTitle },
]

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 10: タイトルバリデーション（空白文字列の拒否）
// Validates: Requirements 1.3, 2.4, 3.3
// ──────────────────────────────────────────────────────────
describe('Property 10: 空白のみのタイトルは拒否される', () => {
  const whitespaceArb = fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r', '\u3000'), { minLength: 1, maxLength: 50 })
    .map((chars) => chars.join(''))

  it.each(parsers)('$name スキーマは空白のみタイトルを reject する', ({ parse }) => {
    fc.assert(
      fc.property(whitespaceArb, (title) => {
        const result = parse(title)
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 11: タイトルバリデーション（101文字以上の拒否）
// Validates: Requirements 1.4
// ──────────────────────────────────────────────────────────
describe('Property 11: 101文字以上のタイトルは拒否される', () => {
  // 非空白文字を最低1つ含む 101 文字以上の文字列を生成する
  const longTitleArb = fc
    .string({ minLength: 101, maxLength: 300, unit: 'grapheme' })
    .map((s) => {
      // trim 後に残る非空白文字を保証しつつ長さ101以上を維持する
      const base = s.replace(/\s/g, 'あ')
      return base.length >= 101 ? base : base.padEnd(101, 'あ')
    })

  it.each(parsers)('$name スキーマは101文字以上のタイトルを reject する', ({ parse }) => {
    fc.assert(
      fc.property(longTitleArb, (title) => {
        expect(title.length).toBeGreaterThanOrEqual(101)
        const result = parse(title)
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it.each(parsers)('$name スキーマは1〜100文字の有効タイトルを accept する', ({ parse }) => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (len) => {
        const title = 'あ'.repeat(len)
        const result = parse(title)
        expect(result.success).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
