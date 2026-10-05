'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActionFormDialog } from '@/components/actions/ActionFormDialog'
import { useActions, useCreateAction } from '@/hooks/useActions'
import { useCompleteAction } from '@/hooks/useCompletions'
import { STATUS_LABEL, ACTION_TYPE_LABEL, formatDate } from '@/lib/labels'
import { ApiError } from '@/lib/api-client'
import type { Status, ActionType } from '@/lib/types'

export default function ActionsPage() {
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<ActionType | 'ALL'>('ALL')
  const actions = useActions(statusFilter, typeFilter)
  const createAction = useCreateAction()
  const complete = useCompleteAction()

  function handleComplete(id: number, title: string) {
    complete.mutate(id, {
      onSuccess: () => toast.success(`「${title}」を完了にしました`),
      onError: (e) => {
        const msg = e instanceof ApiError ? e.message : '完了記録に失敗しました'
        toast.error(msg)
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">行動一覧</h1>
        <ActionFormDialog
          title="行動を新規作成"
          trigger={<Button>新規作成</Button>}
          onSubmit={(data) => createAction.mutateAsync(data)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | 'ALL')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全 Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ON_HOLD">On Hold</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ActionType | 'ALL')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全 Type</SelectItem>
              <SelectItem value="TASK">Task</SelectItem>
              <SelectItem value="HABIT">Habit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {actions.isLoading && <p className="text-muted-foreground">読み込み中...</p>}
      {actions.isError && <p className="text-destructive">読み込みに失敗しました</p>}

      <div className="grid gap-3">
        {actions.data?.map((action) => (
          <Card key={action.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <Link href={`/actions/${action.id}`}>
                <CardTitle className="text-base hover:underline">{action.title}</CardTitle>
              </Link>
              <div className="flex gap-2">
                <Badge variant="secondary">{ACTION_TYPE_LABEL[action.actionType]}</Badge>
                <Badge variant="outline">{STATUS_LABEL[action.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>必要時間: {action.requiredMinutes}分</span>
              <span>PriorityScore: {action.priorityScore ?? 0}</span>
              <span>期限: {formatDate(action.deadline)}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => handleComplete(action.id, action.title)}
                disabled={complete.isPending}
              >
                完了にする
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {actions.data && actions.data.length === 0 && (
        <p className="text-muted-foreground">行動がありません。新規作成してください。</p>
      )}
    </div>
  )
}
