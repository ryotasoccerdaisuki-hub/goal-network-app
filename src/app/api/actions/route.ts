// src/app/api/actions/route.ts
// GET /api/actions（status・type フィルタ対応、PriorityScore 降順）/ POST /api/actions

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ActionSchema, StatusEnum, ActionTypeEnum } from '@/schemas'
import { validationError, internalError } from '@/lib/api-helpers'
import { dateStringToUtcDate } from '@/lib/date-utils'
import { toActionInput, actionScoringInclude, type ActionWithRelations } from '@/lib/action-scoring'
import { calcPriorityScore } from '@/lib/recommendation-engine'

export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get('status')
    const typeParam = request.nextUrl.searchParams.get('type')

    const where: {
      status?: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
      actionType?: 'TASK' | 'HABIT'
    } = {}

    if (statusParam) {
      const parsed = StatusEnum.safeParse(statusParam)
      if (!parsed.success) return validationError(parsed.error)
      where.status = parsed.data
    }
    if (typeParam) {
      const parsed = ActionTypeEnum.safeParse(typeParam)
      if (!parsed.success) return validationError(parsed.error)
      where.actionType = parsed.data
    }

    const actions = await prisma.action.findMany({
      where,
      include: actionScoringInclude,
      orderBy: { createdAt: 'desc' },
    })

    const today = new Date()
    const withScore = actions.map((action) => {
      const input = toActionInput(action as unknown as ActionWithRelations)
      const breakdown = calcPriorityScore(input, today)
      return {
        id: action.id,
        title: action.title,
        description: action.description,
        requiredMinutes: action.requiredMinutes,
        deadline: action.deadline,
        actionType: action.actionType,
        status: action.status,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
        priorityScore: breakdown.priorityScore,
      }
    })

    // PriorityScore 降順
    withScore.sort((a, b) => b.priorityScore - a.priorityScore)

    return NextResponse.json(withScore)
  } catch {
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { title, description, requiredMinutes, deadline, actionType, status } = parsed.data
    const action = await prisma.action.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        requiredMinutes,
        deadline: deadline ? dateStringToUtcDate(deadline) : null,
        actionType,
        status,
      },
    })
    return NextResponse.json(action, { status: 201 })
  } catch {
    return internalError()
  }
}
