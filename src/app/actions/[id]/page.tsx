'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusSelect } from '@/components/status-select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ActionFormDialog } from '@/components/actions/ActionFormDialog'
import { ActionLinkDialog } from '@/components/actions/ActionLinkDialog'
import { useAction, useUpdateAction, useDeleteAction } from '@/hooks/useActions'
import { useDeleteActionLink } from '@/hooks/useActionLinks'
import { useCompleteAction, useUncompleteAction } from '@/hooks/useCompletions'
import {
  STATUS_LABEL,
  ACTION_TYPE_LABEL,
  CONTRIBUTION_LABEL,
  formatDate,
  formatDateTime,
} from '@/lib/labels'
import { ApiError } from '@/lib/api-client'
import type { Status } from '@/lib/types'

export default function ActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const actionId = Number(id)
  const router = useRouter()

  const action = useAction(actionId)
  const updateAction = useUpdateAction(actionId)
  const deleteAction = useDeleteAction()
  const deleteLink = useDeleteActionLink(actionId)
  const complete = useCompleteAction()
  const uncomplete = useUncompleteAction()

  if (action.isLoading) return <p className="text-muted-foreground">読み込み中...</p>
  if (action.isError || !action.data)
    return <p className="text-destructive">行動が見つかりません</p>

  const a = action.data

  function handleStatusChange(status: Status) {
    updateAction.mutate(
      { status },
      {
        onSuccess: () => toast.success('Status を更新しました'),
        onError: () => toast.error('更新に失敗しました'),
      }
    )
  }

  function handleDelete() {
    return deleteAction
      .mutateAsync(actionId)
      .then(() => {
        toast.success('行動を削除しました')
        router.push('/actions')
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : '削除に失敗しました'
        toast.error(msg)
      })
  }

  function handleComplete() {
    complete.mutate(actionId, {
      onSuccess: () => toast.success('完了にしました'),
      onError: (e) => {
        const msg = e instanceof ApiError ? e.message : '完了記録に失敗しました'
        toast.error(msg)
      },
    })
  }

  return (
    <div className="space-y-6">
      <Link href="/actions" className="text-sm text-muted-foreground hover:underline">
        ← 行動一覧へ
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{a.title}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary">{ACTION_TYPE_LABEL[a.actionType]}</Badge>
              <Badge variant="outline">{STATUS_LABEL[a.status]}</Badge>
              <span>必要時間: {a.requiredMinutes}分</span>
              <span>期限: {formatDate(a.deadline)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <ActionFormDialog
              title="行動を編集"
              initial={a}
              trigger={
                <Button variant="outline" size="sm">
                  編集
                </Button>
              }
              onSubmit={(data) => updateAction.mutateAsync(data)}
            />
            <ConfirmDialog
              title="この行動を削除しますか？"
              description="関連する ActionLink・完了記録もまとめて削除されます。"
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
          {a.description && <p className="text-sm">{a.description}</p>}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status 変更:</span>
            <StatusSelect value={a.status} onChange={handleStatusChange} />
            <Button size="sm" onClick={handleComplete} disabled={complete.isPending}>
              完了にする
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">関連付け（ActionLink）</CardTitle>
          <ActionLinkDialog actionId={actionId} />
        </CardHeader>
        <CardContent className="space-y-2">
          {a.actionLinks.length === 0 && (
            <p className="text-sm text-muted-foreground">関連付けがありません。</p>
          )}
          {a.actionLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {link.targetType === 'GOAL' ? 'Goal' : '目標要件'}
                </Badge>
                <span>{link.goal?.title ?? link.goalRequirement?.title}</span>
                <span className="text-muted-foreground">
                  貢献度: {CONTRIBUTION_LABEL[link.contributionWeight]}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  deleteLink.mutate(link.id, {
                    onSuccess: () => toast.success('関連付けを削除しました'),
                    onError: () => toast.error('削除に失敗しました'),
                  })
                }
              >
                削除
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">完了記録（最新100件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {a.completionRecords.length === 0 && (
            <p className="text-sm text-muted-foreground">完了記録がありません。</p>
          )}
          {a.completionRecords.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <span>{formatDateTime(rec.completedAt)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  uncomplete.mutate(rec.id, {
                    onSuccess: () => toast.success('完了を取り消しました'),
                    onError: () => toast.error('取り消しに失敗しました'),
                  })
                }
              >
                完了を取り消す
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
