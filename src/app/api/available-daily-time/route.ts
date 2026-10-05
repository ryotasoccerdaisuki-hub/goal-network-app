// src/app/api/available-daily-time/route.ts
// GET / PUT /api/available-daily-time

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AvailableDailyTimeSchema } from '@/schemas'
import { validationError, internalError, errorResponse } from '@/lib/api-helpers'
import { z } from 'zod'

const dateQuerySchema = z.iso.date()

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get('date')
    if (!dateParam) {
      return errorResponse(400, 'date クエリパラメータが必要です', 'VALIDATION_ERROR', [
        { field: 'date', message: 'date は必須です（YYYY-MM-DD）' },
      ])
    }
    const parsed = dateQuerySchema.safeParse(dateParam)
    if (!parsed.success) return validationError(parsed.error)

    const record = await prisma.availableDailyTime.findUnique({
      where: { date: parsed.data },
    })
    // 未登録の場合は null を返す
    return NextResponse.json(record ?? null)
  } catch {
    return internalError()
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = AvailableDailyTimeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { date, availableMinutes } = parsed.data
    const record = await prisma.availableDailyTime.upsert({
      where: { date },
      update: { availableMinutes },
      create: { date, availableMinutes },
    })
    return NextResponse.json(record)
  } catch {
    return internalError()
  }
}
