// tests/integration/api.test.ts
//
// Route Handler の統合テスト。
// @/lib/prisma を一時ファイル DB の PrismaClient に差し替えて、実際のハンドラ関数を呼び出す。

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestDb, type TestDb } from '../helpers/test-db'

let db: TestDb

// @/lib/prisma を差し替える（モジュールの prisma 名前付きエクスポートがテスト DB を指すようにする）
vi.mock('@/lib/prisma', () => ({
  get prisma() {
    return db.prisma
  },
}))

// next/headers は Route Handler の外（テスト）では使えないためスタブする
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

// ハンドラは mock 定義後に import する
const { POST: createGoal } = await import('@/app/api/goals/route')
const { POST: createLink } = await import('@/app/api/actions/[id]/links/route')
const { POST: completeAction } = await import('@/app/api/actions/[id]/complete/route')
const { POST: getRecommendations } = await import('@/app/api/recommendations/route')

function jsonRequest(url: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

beforeAll(async () => {
  db = await createTestDb()
})

afterAll(async () => {
  await db.cleanup()
})

beforeEach(async () => {
  // 各テスト前にテーブルを空にする
  await db.prisma.completionRecord.deleteMany()
  await db.prisma.actionLink.deleteMany()
  await db.prisma.goalRequirement.deleteMany()
  await db.prisma.action.deleteMany()
  await db.prisma.goal.deleteMany()
  await db.prisma.availableDailyTime.deleteMany()
})

describe('POST /api/goals', () => {
  it('有効な入力で 201 を返し Goal を保存する', async () => {
    const res = await createGoal(jsonRequest('/api/goals', { title: 'テスト目標', importance: 'HIGH' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('テスト目標')
    expect(body.importance).toBe('HIGH')
  })

  it('空白のみのタイトルは 400 を返す', async () => {
    const res = await createGoal(jsonRequest('/api/goals', { title: '   ', importance: 'HIGH' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/actions/:id/links', () => {
  it('重複登録で 409 DUPLICATE_ACTION_LINK を返す', async () => {
    const goal = await db.prisma.goal.create({
      data: { title: 'G', importance: 'HIGH', status: 'ACTIVE' },
    })
    const action = await db.prisma.action.create({
      data: { title: 'A', requiredMinutes: 30, actionType: 'TASK', status: 'ACTIVE' },
    })

    const linkBody = {
      targetType: 'GOAL',
      goalId: goal.id,
      contributionWeight: 'HIGH',
    }
    const res1 = await createLink(jsonRequest(`/api/actions/${action.id}/links`, linkBody), params(action.id))
    expect(res1.status).toBe(201)

    const res2 = await createLink(jsonRequest(`/api/actions/${action.id}/links`, linkBody), params(action.id))
    expect(res2.status).toBe(409)
    const body = await res2.json()
    expect(body.code).toBe('DUPLICATE_ACTION_LINK')
  })

  it('存在しない Goal を指定すると 400 を返す', async () => {
    const action = await db.prisma.action.create({
      data: { title: 'A', requiredMinutes: 30, actionType: 'TASK', status: 'ACTIVE' },
    })
    const res = await createLink(
      jsonRequest(`/api/actions/${action.id}/links`, {
        targetType: 'GOAL',
        goalId: 99999,
        contributionWeight: 'HIGH',
      }),
      params(action.id)
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/actions/:id/complete', () => {
  it('同日 Habit の重複完了で 409 DUPLICATE_COMPLETION を返す', async () => {
    const habit = await db.prisma.action.create({
      data: { title: 'H', requiredMinutes: 15, actionType: 'HABIT', status: 'ACTIVE' },
    })
    const res1 = await completeAction(
      jsonRequest(`/api/actions/${habit.id}/complete`, { timezone: 'Asia/Tokyo' }),
      params(habit.id)
    )
    expect(res1.status).toBe(201)

    const res2 = await completeAction(
      jsonRequest(`/api/actions/${habit.id}/complete`, { timezone: 'Asia/Tokyo' }),
      params(habit.id)
    )
    expect(res2.status).toBe(409)
    const body = await res2.json()
    expect(body.code).toBe('DUPLICATE_COMPLETION')
  })

  it('完了済み Task の再完了で 409 を返す', async () => {
    const task = await db.prisma.action.create({
      data: { title: 'T', requiredMinutes: 15, actionType: 'TASK', status: 'ACTIVE' },
    })
    const res1 = await completeAction(
      jsonRequest(`/api/actions/${task.id}/complete`, { timezone: 'Asia/Tokyo' }),
      params(task.id)
    )
    expect(res1.status).toBe(201)
    const res2 = await completeAction(
      jsonRequest(`/api/actions/${task.id}/complete`, { timezone: 'Asia/Tokyo' }),
      params(task.id)
    )
    expect(res2.status).toBe(409)
  })
})

describe('POST /api/recommendations', () => {
  async function seedScenario() {
    const goal = await db.prisma.goal.create({
      data: { title: '転職', importance: 'HIGH', status: 'ACTIVE' },
    })
    // 3件の Active な Task を作成し Goal にリンクする
    for (let i = 0; i < 3; i++) {
      const action = await db.prisma.action.create({
        data: {
          title: `行動${i}`,
          requiredMinutes: 30,
          actionType: 'TASK',
          status: 'ACTIVE',
        },
      })
      await db.prisma.actionLink.create({
        data: {
          actionId: action.id,
          targetType: 'GOAL',
          goalId: goal.id,
          contributionWeight: 'HIGH',
        },
      })
    }
  }

  it('有効な時間で最大3件の推奨が返る', async () => {
    await seedScenario()
    const res = await getRecommendations(
      jsonRequest('/api/recommendations', { availableMinutes: 120, timezone: 'Asia/Tokyo' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations.length).toBeGreaterThan(0)
    expect(body.recommendations.length).toBeLessThanOrEqual(3)
    expect(body.totalRequiredMinutes).toBeLessThanOrEqual(120)
  })

  it('条件を満たす Action が0件のとき noResultMessage を返す', async () => {
    // Goal/Action なし
    const res = await getRecommendations(
      jsonRequest('/api/recommendations', { availableMinutes: 60, timezone: 'Asia/Tokyo' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(0)
    expect(body.noResultMessage).toBe('条件を満たす行動がありません')
  })

  it('無効な時間（0）で 400 を返す', async () => {
    const res = await getRecommendations(
      jsonRequest('/api/recommendations', { availableMinutes: 0, timezone: 'Asia/Tokyo' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })
})
