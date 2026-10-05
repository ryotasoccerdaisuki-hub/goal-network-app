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
import { GoalFormDialog } from '@/components/goals/GoalFormDialog'
import { RequirementFormDialog } from '@/components/goals/RequirementFormDialog'
import { useGoal, useUpdateGoal, useDeleteGoal } from '@/hooks/useGoals'
import { useCreateGoalRequirement } from '@/hooks/useGoalRequirements'
import { STATUS_LABEL, IMPORTANCE_LABEL, formatDate, formatDateTime } from '@/lib/labels'
import { ApiError } from '@/lib/api-client'
import type { Status } from '@/lib/types'

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const goalId = Number(id)
  const router = useRouter()

  const goal = useGoal(goalId)
  const updateGoal = useUpdateGoal(goalId)
  const deleteGoal = useDeleteGoal()
  const createReq = useCreateGoalRequirement(goalId)

  if (goal.isLoading) return <p className="text-muted-foreground">読み込み中...</p>
  if (goal.isError || !goal.data)
    return <p className="text-destructive">目標が見つかりません</p>

  const g = goal.data

  function handleStatusChange(status: Status) {
    updateGoal.mutate(
      { status },
      {
        onSuccess: () => toast.success('Status を更新しました'),
        onError: () => toast.error('更新に失敗しました'),
      }
    )
  }

  function handleDelete() {
    return deleteGoal
      .mutateAsync(goalId)
      .then(() => {
        toast.success('目標を削除しました')
        router.push('/goals')
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : '削除に失敗しました'
        toast.error(msg)
      })
  }

  return (
    <div className="space-y-6">
      <Link href="/goals" className="text-sm text-muted-foreground hover:underline">
        ← 目標一覧へ
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{g.title}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary">{STATUS_LABEL[g.status]}</Badge>
              <span>重要度: {IMPORTANCE_LABEL[g.importance]}</span>
              <span>期限: {formatDate(g.deadline)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <GoalFormDialog
              title="目標を編集"
              initial={g}
              trigger={
                <Button variant="outline" size="sm">
                  編集
                </Button>
              }
              onSubmit={(data) => updateGoal.mutateAsync(data)}
            />
            <ConfirmDialog
              title="この目標を削除しますか？"
              description="関連する目標要件・ActionLink もまとめて削除されます。"
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
          {g.description && <p className="text-sm">{g.description}</p>}

          <div className="space-y-1">
            <p className="text-sm font-medium">進捗率（Task 型のみ）</p>
            <ProgressBar value={g.progress} />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status 変更:</span>
            <StatusSelect value={g.status} onChange={handleStatusChange} />
          </div>

          {g.habitActions.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Habit 型 Action</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {g.habitActions.map((h) => (
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">目標要件</CardTitle>
          <RequirementFormDialog
            title="目標要件を新規作成"
            trigger={
              <Button size="sm" variant="outline">
                追加
              </Button>
            }
            onSubmit={(data) => createReq.mutateAsync(data)}
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {g.requirements.length === 0 && (
            <p className="text-sm text-muted-foreground">目標要件がありません。</p>
          )}
          {g.requirements.map((req) => (
            <Link
              key={req.id}
              href={`/goals/${goalId}/requirements/${req.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
            >
              <span>{req.title}</span>
              <Badge variant="secondary">{STATUS_LABEL[req.status]}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
