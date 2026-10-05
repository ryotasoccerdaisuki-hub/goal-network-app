// src/app/api/completion-records/[id]/route.ts
// DELETE /api/completion-records/:id（完了取り消し）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError, errorResponse, parseId } from '@/lib/api-helpers'

type Params = Promise<{ id: string }>

export async function DELETE(_request: NextRequest, segmentData: { params: Params }) {
  try {
    const { id: rawId } = await segmentData.params
    const id = parseId(rawId)
    if (id === null) return errorResponse(404, 'CompletionRecord が見つかりません', 'NOT_FOUND')

    const existing = await prisma.completionRecord.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse(404, 'CompletionRecord が見つかりません', 'NOT_FOUND')
    }

    // 削除により当該 Action は翌回の推奨計算に戻る
    await prisma.completionRecord.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalError()
  }
}
