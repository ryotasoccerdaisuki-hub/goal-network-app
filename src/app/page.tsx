'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecommendationCard } from '@/components/recommendations/RecommendationCard'
import { useAvailableDailyTime, useUpsertAvailableDailyTime } from '@/hooks/useAvailableDailyTime'
import { useRecommendations } from '@/hooks/useRecommendations'
import { RecommendationRequestSchema } from '@/schemas'
import { ApiError } from '@/lib/api-client'

function todayLocalDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function HomePage() {
  const [date] = useState(todayLocalDateString)
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const saved = useAvailableDailyTime(date)
  const upsert = useUpsertAvailableDailyTime()
  const recommend = useRecommendations()

  // 当日保存済み値を自動表示
  useEffect(() => {
    if (saved.data && minutes === '') {
      setMinutes(String(saved.data.availableMinutes))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.data])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // 空欄・非数値・小数・範囲外を Zod で検証
    const num = Number(minutes)
    const parsed = RecommendationRequestSchema.safeParse({ availableMinutes: num })
    if (minutes.trim() === '' || Number.isNaN(num) || !parsed.success) {
      setError('利用可能時間は1〜1440の整数で入力してください')
      return
    }

    const availableMinutes = parsed.data.availableMinutes

    // 当日の利用可能時間を保存（UPSERT）してから推奨算出
    upsert.mutate(
      { date, availableMinutes },
      {
        onError: () => toast.error('利用可能時間の保存に失敗しました'),
      }
    )
    recommend.mutate(availableMinutes, {
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : '推奨の取得に失敗しました'
        toast.error(msg)
      },
    })
  }

  const result = recommend.data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">今日の推奨行動</h1>
        <p className="text-sm text-muted-foreground">
          今日使える時間を入力すると、最も効果的な行動を最大3件提案します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">利用可能時間</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="minutes">分（1〜1440）</Label>
              <Input
                id="minutes"
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-40"
                placeholder="例: 120"
              />
            </div>
            <Button type="submit" disabled={recommend.isPending}>
              {recommend.isPending ? '算出中...' : '推奨を取得'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.recommendations.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>合計所要時間: {result.totalRequiredMinutes}分</span>
                <span>残り時間: {result.remainingMinutes}分</span>
              </div>
              <div className="grid gap-4">
                {result.recommendations.map((rec) => (
                  <RecommendationCard key={rec.action.id} rec={rec} />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {result.noResultMessage ?? '条件を満たす行動がありません'}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
