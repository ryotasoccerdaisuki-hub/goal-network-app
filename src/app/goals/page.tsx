'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { GoalFormDialog } from '@/components/goals/GoalFormDialog'
import { useGoals, useCreateGoal } from '@/hooks/useGoals'
import { STATUS_LABEL, IMPORTANCE_LABEL, formatDate } from '@/lib/labels'
import type { Status } from '@/lib/types'

export default function GoalsPage() {
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL')
  const goals = useGoals(filter)
  const createGoal = useCreateGoal()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">目標一覧</h1>
        <GoalFormDialog
          title="目標を新規作成"
          trigger={<Button>新規作成</Button>}
          onSubmit={(data) => createGoal.mutateAsync(data)}
        />
      </div>

      <div className="w-48">
        <Select value={filter} onValueChange={(v) => setFilter(v as Status | 'ALL')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全表示</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ON_HOLD">On Hold</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {goals.isLoading && <p className="text-muted-foreground">読み込み中...</p>}
      {goals.isError && <p className="text-destructive">読み込みに失敗しました</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.data?.map((goal) => (
          <Link key={goal.id} href={`/goals/${goal.id}`}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{goal.title}</CardTitle>
                <Badge variant="secondary">{STATUS_LABEL[goal.status]}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>重要度: {IMPORTANCE_LABEL[goal.importance]}</span>
                <span>期限: {formatDate(goal.deadline)}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {goals.data && goals.data.length === 0 && (
        <p className="text-muted-foreground">目標がありません。新規作成してください。</p>
      )}
    </div>
  )
}
