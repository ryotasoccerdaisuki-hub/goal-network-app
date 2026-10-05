// src/app/api/actions/[id]/route.ts
// GET / PATCH / DELETE /api/actions/:id

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ActionSchema } from '@/schemas'
import { validationError, internalError, errorResponse, parseId } from '@/lib/api-helpers'
import { dateStringToUtcDate } from '@/lib/date-utils'

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const action = await prisma.action.findUnique({
      where: { id },
      include: {
        actionLinks: {
          include: {
            goal: { select: { id: true, title: true } },
            goalRequirement: { select: { id: true, title: true } },
          },
        },
        completionRecords: {
          orderBy: { completedAt: 'desc' },
          take: 100,
        },
      },
    })
    if (!action) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    return NextResponse.json(action)
  } catch {
    return internalError()
  }
}

export async function PATCH(request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const existing = await prisma.action.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const body = await request.json()
    const parsed = ActionSchema.partial().safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const data = parsed.data
    const action = await prisma.action.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.requiredMinutes !== undefined ? { requiredMinutes: data.requiredMinutes } : {}),
        ...(data.deadline !== undefined
          ? { deadline: data.deadline ? dateStringToUtcDate(data.deadline) : null }
          : {}),
        ...(data.actionType !== undefined ? { actionType: data.actionType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    })
    return NextResponse.json(action)
  } catch {
    return internalError()
  }
}

export async function DELETE(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const existing = await prisma.action.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    // CASCADE により ActionLink・CompletionRecord も削除される
    await prisma.action.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalError()
  }
}
