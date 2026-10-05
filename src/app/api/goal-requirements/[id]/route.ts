// src/app/api/goal-requirements/[id]/route.ts
// GET / PATCH / DELETE /api/goal-requirements/:id

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoalRequirementSchema } from '@/schemas'
import { validationError, internalError, errorResponse, parseId } from '@/lib/api-helpers'
import { calcRequirementProgress } from '@/lib/progress'

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'GoalRequirement が見つかりません', 'NOT_FOUND')

    const requirement = await prisma.goalRequirement.findUnique({ where: { id } })
    if (!requirement) {
      return errorResponse(404, 'GoalRequirement が見つかりません', 'NOT_FOUND')
    }

    // 進捗率: この GoalRequirement に直接リンクされた Task 型 Action のみ
    const taskLinks = await prisma.actionLink.findMany({
      where: { goalRequirementId: id, action: { actionType: 'TASK' } },
      include: { action: { include: { completionRecords: { take: 1 } } } },
    })
    const progress = calcRequirementProgress(
      taskLinks.map((l) => ({
        id: l.actionId,
        isCompleted: l.action.completionRecords.length > 0,
      }))
    )

    // Habit 型 Action の実行回数・最終実行日時
    const habitLinks = await prisma.actionLink.findMany({
      where: { goalRequirementId: id, action: { actionType: 'HABIT' } },
      include: {
        action: { include: { completionRecords: { orderBy: { completedAt: 'desc' } } } },
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
      ...requirement,
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
    if (id === null) return errorResponse(404, 'GoalRequirement が見つかりません', 'NOT_FOUND')

    const existing = await prisma.goalRequirement.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse(404, 'GoalRequirement が見つかりません', 'NOT_FOUND')
    }

    const body = await request.json()
    const parsed = GoalRequirementSchema.partial().safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const data = parsed.data
    const requirement = await prisma.goalRequirement.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    })
    return NextResponse.json(requirement)
  } catch {
    return internalError()
  }
}

export async function DELETE(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'GoalRequirement が見つかりません', 'NOT_FOUND')

    const existing = await prisma.goalRequirement.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse(404, 'GoalRequirement が見つかりません', 'NOT_FOUND')
    }

    // CASCADE により関連 ActionLink も削除される
    await prisma.goalRequirement.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalError()
  }
}
