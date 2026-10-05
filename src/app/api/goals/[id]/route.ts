// src/app/api/goals/[id]/route.ts
// GET / PATCH / DELETE /api/goals/:id

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoalSchema } from '@/schemas'
import { validationError, internalError, errorResponse, parseId } from '@/lib/api-helpers'
import { calcGoalProgress } from '@/lib/progress'
import { dateStringToUtcDate } from '@/lib/date-utils'

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        requirements: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!goal) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    // 進捗率算出用: Goal に直接リンクされた Task 型 Action
    const directLinks = await prisma.actionLink.findMany({
      where: { goalId: id, action: { actionType: 'TASK' } },
      include: { action: { include: { completionRecords: { take: 1 } } } },
    })
    // 配下 GoalRequirement 経由の Task 型 Action
    const requirementLinks = await prisma.actionLink.findMany({
      where: { goalRequirement: { goalId: id }, action: { actionType: 'TASK' } },
      include: { action: { include: { completionRecords: { take: 1 } } } },
    })

    const progress = calcGoalProgress({
      directTaskActions: directLinks.map((l) => ({
        id: l.actionId,
        isCompleted: l.action.completionRecords.length > 0,
      })),
      requirementTaskActions: requirementLinks.map((l) => ({
        id: l.actionId,
        isCompleted: l.action.completionRecords.length > 0,
      })),
    })

    // Habit 型 Action の実行回数・最終実行日時（直接リンク + 要件経由）
    const habitLinks = await prisma.actionLink.findMany({
      where: {
        action: { actionType: 'HABIT' },
        OR: [{ goalId: id }, { goalRequirement: { goalId: id } }],
      },
      include: {
        action: {
          include: {
            completionRecords: { orderBy: { completedAt: 'desc' } },
          },
        },
      },
    })

    const habitMap = new Map<
      number,
      { id: number; title: string; executionCount: number; lastExecutedAt: Date | null }
    >()
    for (const link of habitLinks) {
      if (habitMap.has(link.actionId)) continue
      const records = link.action.completionRecords
      habitMap.set(link.actionId, {
        id: link.action.id,
        title: link.action.title,
        executionCount: records.length,
        lastExecutedAt: records[0]?.completedAt ?? null,
      })
    }

    return NextResponse.json({
      ...goal,
      progress,
      habitActions: [...habitMap.values()],
    })
  } catch {
    return internalError()
  }
}

export async function PATCH(request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const existing = await prisma.goal.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const body = await request.json()
    const parsed = GoalSchema.partial().safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const data = parsed.data
    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.importance !== undefined ? { importance: data.importance } : {}),
        ...(data.deadline !== undefined
          ? { deadline: data.deadline ? dateStringToUtcDate(data.deadline) : null }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    })
    return NextResponse.json(goal)
  } catch {
    return internalError()
  }
}

export async function DELETE(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const existing = await prisma.goal.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    // CASCADE により GoalRequirement・ActionLink も削除される
    await prisma.goal.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalError()
  }
}
