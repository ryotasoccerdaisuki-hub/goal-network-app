'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/progress-bar'
import { StatusSelect } from '@/components/status-select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RequirementFormDialog } from '@/components/goals/RequirementFormDialog'
import {
  useGoalRequirement,
  useUpdateGoalRequirement,
  useDeleteGoalRequirement,
} from '@/hooks/useGoalRequirements'
import { STATUS_LABEL, formatDateTime } from '@/lib/labels'
import { ApiError } from '@/lib/api-client'
import type { Status } from '@/lib/types'

export default function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>
}) {
  const { id, rid } = use(params)
  const goalId = Number(id)
  const reqId = Number(rid)
  const router = useRouter()

  const req = useGoalRequirement(reqId)
  const updateReq = useUpdateGoalRequirement(reqId)
  const deleteReq = useDeleteGoalRequirement()

  if (req.isLoading) return <p className="text-muted-foreground">読み込み中...</p>
  if (req.isError || !req.data)
    return <p className="text-destructive">目標要件が見つかりません</p>

  const r = req.data

  function handleStatusChange(status: Status) {
    updateReq.mutate(
      { status },
      {
        onSuccess: () => toast.success('Status を更新しました'),
        onError: () => toast.error('更新に失敗しました'),
      }
    )
  }

  function handleDelete() {
    return deleteReq
      .mutateAsync(reqId)
      .then(() => {
        toast.success('目標要件を削除しました')
        router.push(`/goals/${goalId}`)
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : '削除に失敗しました'
        toast.error(msg)
      })
  }

  return (
    <div className="space-y-6">
      <Link href={`/goals/${goalId}`} className="text-sm text-muted-foreground hover:underline">
        ← 目標詳細へ
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{r.title}</CardTitle>
            <div className="mt-2">
              <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <RequirementFormDialog
              title="目標要件を編集"
              initial={r}
              trigger={
                <Button variant="outline" size="sm">
                  編集
                </Button>
              }
              onSubmit={(data) => updateReq.mutateAsync(data)}
            />
            <ConfirmDialog
              title="この目標要件を削除しますか？"
              description="関連する ActionLink もまとめて削除されます。"
              trigger={
                <Button variant="destructive" size="sm">
                  削除
                </Button>
              }
              onConfirm={handleDelete}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {r.description && <p className="text-sm">{r.description}</p>}

          <div className="space-y-1">
            <p className="text-sm font-medium">進捗率（Task 型のみ）</p>
            <ProgressBar value={r.progress} />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status 変更:</span>
            <StatusSelect value={r.status} onChange={handleStatusChange} />
          </div>

          {r.habitActions.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Habit 型 Action</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {r.habitActions.map((h) => (
                  <li key={h.id}>
                    {h.title} — 実行回数: {h.executionCount}、最終実行:{' '}
                    {formatDateTime(h.lastExecutedAt)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
