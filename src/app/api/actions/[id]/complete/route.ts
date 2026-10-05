// src/app/api/actions/[id]/complete/route.ts
// POST /api/actions/:id/complete（CompletionRecord 作成）

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { internalError, errorResponse, parseId } from '@/lib/api-helpers'
import { localDateString, localDayRangeUtc } from '@/lib/date-utils'

type Params = Promise<{ id: string }>

export async function POST(request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    const action = await prisma.action.findUnique({ where: { id } })
    if (!action) return errorResponse(404, 'Action が見つかりません', 'NOT_FOUND')

    // タイムゾーンの取得: リクエストボディ優先、なければ X-Timezone ヘッダー、既定は UTC
    let timezone = 'UTC'
    try {
      const body = await request.json()
      if (body && typeof body.timezone === 'string' && body.timezone.length > 0) {
        timezone = body.timezone
      }
    } catch {
      // ボディなしは許容する
    }
    if (timezone === 'UTC') {
      const headersList = await headers()
      const headerTz = headersList.get('X-Timezone')
      if (headerTz) timezone = headerTz
    }

    const now = new Date()

    if (action.actionType === 'TASK') {
      // TASK: 既に CompletionRecord が1件でも存在すれば重複
      const existing = await prisma.completionRecord.findFirst({ where: { actionId: id } })
      if (existing) {
        return errorResponse(
          409,
          'このタスクは既に完了済みです',
          'DUPLICATE_COMPLETION'
        )
      }
    } else {
      // HABIT: 同日（ローカルタイムゾーン基準）の CompletionRecord が存在すれば重複
      const dateStr = localDateString(timezone, now)
      const { start, end } = localDayRangeUtc(timezone, dateStr)
      const existing = await prisma.completionRecord.findFirst({
        where: { actionId: id, completedAt: { gte: start, lte: end } },
      })
      if (existing) {
        return errorResponse(
          409,
          'この習慣は本日すでに完了済みです',
          'DUPLICATE_COMPLETION'
        )
      }
    }

    const record = await prisma.completionRecord.create({
      data: { actionId: id, completedAt: now },
    })
    return NextResponse.json(record, { status: 201 })
  } catch {
    return internalError()
  }
}
