// src/lib/api-helpers.ts
//
// Route Handler 共通のエラーレスポンス形式・ヘルパー。
// design.md「HTTP エラーレスポンス形式」に準拠する。

import { NextResponse } from 'next/server'
import { z } from 'zod'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_ACTION_LINK'
  | 'DUPLICATE_COMPLETION'
  | 'INTERNAL_ERROR'

export interface ErrorResponse {
  error: string
  details?: { field: string; message: string }[]
  code?: ErrorCode
}

export function errorResponse(
  status: number,
  error: string,
  code?: ErrorCode,
  details?: { field: string; message: string }[]
): NextResponse<ErrorResponse> {
  return NextResponse.json({ error, code, details }, { status })
}

// Zod のバリデーションエラーを統一エラーレスポンス（400）に変換する
export function validationError(err: z.ZodError): NextResponse<ErrorResponse> {
  const details = err.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
  return errorResponse(400, '入力内容に誤りがあります', 'VALIDATION_ERROR', details)
}

// 想定外のサーバーエラー（500）
export function internalError(): NextResponse<ErrorResponse> {
  return errorResponse(500, 'サーバーエラーが発生しました', 'INTERNAL_ERROR')
}

// Prisma の既知の一意制約違反コード
export const PRISMA_UNIQUE_VIOLATION = 'P2002'

// パスパラメータの数値 ID をパースする。不正な場合は null を返す。
export function parseId(raw: string): number | null {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}
