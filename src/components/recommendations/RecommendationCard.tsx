'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCompleteAction } from '@/hooks/useCompletions'
import { ApiError } from '@/lib/api-client'
import { ACTION_TYPE_LABEL } from '@/lib/labels'
import type { Recommendation } from '@/lib/types'

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false)
  const complete = useCompleteAction()

  function handleComplete() {
    complete.mutate(rec.action.id, {
      onSuccess: () => toast.success(`「${rec.action.title}」を完了にしました`),
      onError: (e) => {
        const msg = e instanceof ApiError ? e.message : '完了記録に失敗しました'
        toast.error(msg)
      },
    })
  }

  const b = rec.breakdown

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Badge>{rec.rank}位</Badge>
          <CardTitle className="text-base">{rec.action.title}</CardTitle>
        </div>
        <Badge variant="secondary">{ACTION_TYPE_LABEL[rec.action.actionType]}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span>必要時間: {rec.action.requiredMinutes}分</span>
          <span>PriorityScore: {rec.priorityScore}</span>
        </div>

        <p className="font-medium">{rec.reasonText}</p>

        {rec.relatedGoals.length > 0 && (
          <div>
            <span className="text-muted-foreground">関連目標: </span>
            {rec.relatedGoals.map((g) => (
              <Badge key={g.id} variant="outline" className="mr-1">
                {g.title}
              </Badge>
            ))}
          </div>
        )}

        {rec.relatedRequirements.length > 0 && (
          <div>
            <span className="text-muted-foreground">関連目標要件: </span>
            {rec.relatedRequirements.map((r) => (
              <Badge key={r.id} variant="outline" className="mr-1">
                {r.title}
              </Badge>
            ))}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm text-muted-foreground underline"
          >
            {open ? '計算根拠を隠す' : '計算根拠を表示'}
          </button>
          {open && (
            <div className="mt-2 space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
              <ul className="space-y-0.5">
                {b.linkBreakdowns.map((l, i) => (
                  <li key={i}>
                    Goal #{l.goalId}: 重要度 {l.importanceWeight} × 貢献度{' '}
                    {l.contributionWeight} = {l.product}
                  </li>
                ))}
              </ul>
              <div>Σ(重要度×貢献度) = {b.sumImportanceContribution}</div>
              <div>
                ユニーク Active Goal 数 = {b.uniqueActiveGoalCount}（CrossGoalBonus ={' '}
                {b.crossGoalBonus}）
              </div>
              <div>UrgencyFactor = {b.urgencyFactor}</div>
              <div>NormalizedDuration = {b.normalizedDuration}</div>
              <div className="font-semibold">PriorityScore = {b.priorityScore}</div>
            </div>
          )}
        </div>

        <Button onClick={handleComplete} disabled={complete.isPending} size="sm">
          完了にする
        </Button>
      </CardContent>
    </Card>
  )
}
