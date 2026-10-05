import * as fc from 'fast-check'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDb, type TestDb } from '../helpers/test-db'

// ──────────────────────────────────────────────────────────
// Feature: goal-network-app, Property 9: AvailableDailyTime の UPSERT 冪等性
// Validates: Requirements 6.2
// ──────────────────────────────────────────────────────────
// 同一日付に複数回 UPSERT した場合、最後の値のみが保存される（冪等）ことを
// SQLite in-memory 相当（一時ファイル DB）+ Prisma で検証する。

describe('Property 9: AvailableDailyTime UPSERT 冪等性', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    await db.cleanup()
  })

  it('同一日付への複数回 UPSERT は最後の値のみを保存する', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 1440 }), { minLength: 1, maxLength: 10 }),
        async (minutesSequence) => {
          const date = '2026-01-15'

          for (const availableMinutes of minutesSequence) {
            await db.prisma.availableDailyTime.upsert({
              where: { date },
              update: { availableMinutes },
              create: { date, availableMinutes },
            })
          }

          // 同一日付のレコードは常に1件のみ
          const all = await db.prisma.availableDailyTime.findMany({ where: { date } })
          expect(all).toHaveLength(1)

          // 保存値は最後に UPSERT した値
          expect(all[0].availableMinutes).toBe(minutesSequence[minutesSequence.length - 1])

          // 次の反復のためにクリーンアップ
          await db.prisma.availableDailyTime.deleteMany({ where: { date } })
        }
      ),
      { numRuns: 50 }
    )
  })
})
