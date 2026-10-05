// src/app/api/goals/[id]/requirements/route.ts
// GET / POST /api/goals/:id/requirements

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoalRequirementSchema } from '@/schemas'
import { validationError, internalError, errorResponse, parseId } from '@/lib/api-helpers'

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const goalId = parseId(rawId)
    if (goalId === null) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const goal = await prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const requirements = await prisma.goalRequirement.findMany({
      where: { goalId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(requirements)
  } catch {
    return internalError()
  }
}

export async function POST(request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const goalId = parseId(rawId)
    if (goalId === null) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const goal = await prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) return errorResponse(404, 'Goal が見つかりません', 'NOT_FOUND')

    const body = await request.json()
    const parsed = GoalRequirementSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { title, description, status } = parsed.data
    const requirement = await prisma.goalRequirement.create({
      data: {
        goalId,
        title: title.trim(),
        description: description ?? null,
        status,
      },
    })
    return NextResponse.json(requirement, { status: 201 })
  } catch {
    return internalError()
  }
}
