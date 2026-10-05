// src/app/api/actions/[id]/links/route.ts
// GET / POST /api/actions/:id/links

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ActionLinkSchema } from '@/schemas'
import {
  validationError,
  internalError,
  errorResponse,
  parseId,
  PRISMA_UNIQUE_VIOLATION,
} from '@/lib/api-helpers'

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const actionId = parseId(rawId)
    if (actionId === null) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const action = await prisma.action.findUnique({ where: { id: actionId } })
    if (!action) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const links = await prisma.actionLink.findMany({
      where: { actionId },
      include: {
        goal: { select: { id: true, title: true } },
        goalRequirement: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(links)
  } catch {
    return internalError()
  }
}

export async function POST(request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const actionId = parseId(rawId)
    if (actionId === null) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const action = await prisma.action.findUnique({ where: { id: actionId } })
    if (!action) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const body = await request.json()
    const parsed = ActionLinkSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { targetType, goalId, goalRequirementId, contributionWeight } = parsed.data

    // 関連先の存在確認（存在しない場合は 400）
    if (targetType === 'GOAL') {
      const goal = await prisma.goal.findUnique({ where: { id: goalId! } })
      if (!goal) {
        return errorResponse(400, '指定された Goal が存在しません', 'VALIDATION_ERROR', [
          { field: 'goalId', message: '指定された Goal が存在しません' },
        ])
      }
    } else {
      const requirement = await prisma.goalRequirement.findUnique({
        where: { id: goalRequirementId! },
      })
      if (!requirement) {
        return errorResponse(400, '指定された GoalRequirement が存在しません', 'VALIDATION_ERROR', [
          { field: 'goalRequirementId', message: '指定された GoalRequirement が存在しません' },
        ])
      }
    }

    try {
      const link = await prisma.actionLink.create({
        data: {
          actionId,
          targetType,
          goalId: targetType === 'GOAL' ? goalId : null,
          goalRequirementId: targetType === 'GOAL_REQUIREMENT' ? goalRequirementId : null,
          contributionWeight,
        },
      })
      return NextResponse.json(link, { status: 201 })
    } catch (e) {
      // 複合ユニーク制約違反（重複登録）
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === PRISMA_UNIQUE_VIOLATION
      ) {
        return errorResponse(
          409,
          'この関連付けは既に登録されています',
          'DUPLICATE_ACTION_LINK'
        )
      }
      throw e
    }
  } catch {
    return internalError()
  }
}
