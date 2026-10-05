// src/lib/api-client.ts
//
// フロントエンド用の軽量 fetch ラッパー。
// 統一エラーレスポンス（ErrorResponse）を受け取り、ApiError として投げる。

import type { ErrorResponse } from '@/lib/api-helpers'

export class ApiError extends Error {
  status: number
  code?: string
  details?: { field: string; message: string }[]

  constructor(status: number, body: ErrorResponse) {
    super(body.error || 'リクエストに失敗しました')
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

async function parseError(res: Response): Promise<never> {
  let body: ErrorResponse = { error: 'リクエストに失敗しました' }
  try {
    body = (await res.json()) as ErrorResponse
  } catch {
    // JSON でない場合はデフォルトメッセージ
  }
  throw new ApiError(res.status, body)
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) return parseError(res)
  return res.json() as Promise<T>
}

async function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', 'X-Timezone': tz },
    body: body !== undefined ? JSON.stringify({ ...body, timezone: tz }) : undefined,
  })
  if (!res.ok) return parseError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const apiPost = <T>(url: string, body?: unknown) => sendJson<T>('POST', url, body)
export const apiPut = <T>(url: string, body?: unknown) => sendJson<T>('PUT', url, body)
export const apiPatch = <T>(url: string, body?: unknown) => sendJson<T>('PATCH', url, body)
export const apiDelete = <T>(url: string) => sendJson<T>('DELETE', url)
