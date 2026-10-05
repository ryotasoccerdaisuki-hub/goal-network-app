// src/lib/date-utils.ts
//
// タイムゾーン処理ヘルパー。
// CompletionRecord.completedAt は UTC で保存し、クライアントから受け取った
// ローカルタイムゾーン文字列（例: "Asia/Tokyo"）を使って当日日付範囲を算出する。

import { fromZonedTime, toZonedTime } from 'date-fns-tz'

// 指定タイムゾーンにおける「現在のローカル日付文字列」（YYYY-MM-DD）を返す
export function localDateString(timezone: string, now: Date = new Date()): string {
  const zoned = toZonedTime(now, timezone)
  const y = zoned.getFullYear()
  const m = String(zoned.getMonth() + 1).padStart(2, '0')
  const d = String(zoned.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 指定タイムゾーンの当日（localDateString）の開始・終了を UTC の Date で返す。
// completedAt は UTC 保存のため、この範囲で Prisma の gte/lte 絞り込みに使う。
export function localDayRangeUtc(
  timezone: string,
  dateStr: string
): { start: Date; end: Date } {
  // ローカルタイムゾーンの 00:00:00.000 と 23:59:59.999 を UTC に変換する
  const start = fromZonedTime(`${dateStr}T00:00:00.000`, timezone)
  const end = fromZonedTime(`${dateStr}T23:59:59.999`, timezone)
  return { start, end }
}

// Deadline（DateTime? / 日付のみ使用）用。YYYY-MM-DD 文字列を UTC 00:00 の Date にする。
export function dateStringToUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}
