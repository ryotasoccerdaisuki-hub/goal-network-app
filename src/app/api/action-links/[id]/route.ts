// src/app/api/action-links/[id]/route.ts
// DELETE /api/action-links/:id（ActionLink 単体削除）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError, errorResponse, parseId } from '@/lib/api-helpers'

type Params = Promise<{ id: string }>

export async function DELETE(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'ActionLink が見つかりません', 'NOT_FOUND')

    const existing = await prisma.actionLink.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, 'ActionLink が見つかりません', 'NOT_FOUND')

    // ActionLink のみを削除する（Action・Goal・GoalRequirement は削除しない）
    await prisma.actionLink.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalError()
  }
}
