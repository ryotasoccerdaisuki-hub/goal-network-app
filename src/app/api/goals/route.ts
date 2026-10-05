// src/app/api/goals/route.ts
// GET /api/goals（Status フィルタ対応）/ POST /api/goals

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoalSchema, StatusEnum } from '@/schemas'
import { validationError, internalError } from '@/lib/api-helpers'
import { dateStringToUtcDate } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get('status')
    const where: { status?: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' } = {}

    if (statusParam) {
      const parsed = StatusEnum.safeParse(statusParam)
      if (!parsed.success) {
        return validationError(parsed.error)
      }
      where.status = parsed.data
    }

    const goals = await prisma.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(goals)
  } catch {
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = GoalSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const { title, description, importance, deadline, status } = parsed.data
    const goal = await prisma.goal.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        importance,
        deadline: deadline ? dateStringToUtcDate(deadline) : null,
        status,
      },
    })
    return NextResponse.json(goal, { status: 201 })
  } catch {
    return internalError()
  }
}
