'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGoals } from '@/hooks/useGoals'
import { useCreateActionLink } from '@/hooks/useActionLinks'
import { apiGet, ApiError } from '@/lib/api-client'
import type {
  ContributionWeight,
  GoalRequirement,
  LinkTargetType,
} from '@/lib/types'
import { useQuery } from '@tanstack/react-query'

export function ActionLinkDialog({ actionId }: { actionId: number }) {
  const [open, setOpen] = useState(false)
  const [targetType, setTargetType] = useState<LinkTargetType>('GOAL')
  const [goalId, setGoalId] = useState<string>('')
  const [reqId, setReqId] = useState<string>('')
  const [weight, setWeight] = useState<ContributionWeight>('MEDIUM')
  const [error, setError] = useState<string | null>(null)

  const goals = useGoals('ALL')
  const createLink = useCreateActionLink(actionId)

  // 選択中 Goal 配下の GoalRequirement を取得
  const requirements = useQuery({
    queryKey: ['goal-requirements', goalId ? Number(goalId) : undefined],
    queryFn: () => apiGet<GoalRequirement[]>(`/api/goals/${goalId}/requirements`),
    enabled: targetType === 'GOAL_REQUIREMENT' && goalId !== '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (targetType === 'GOAL' && goalId === '') {
      setError('Goal を選択してください')
      return
    }
    if (targetType === 'GOAL_REQUIREMENT' && reqId === '') {
      setError('目標要件を選択してください')
      return
    }

    const payload =
      targetType === 'GOAL'
        ? { targetType, goalId: Number(goalId), contributionWeight: weight }
        : {
            targetType,
            goalRequirementId: Number(reqId),
            contributionWeight: weight,
          }

    try {
      await createLink.mutateAsync(payload)
      toast.success('関連付けを追加しました')
      setOpen(false)
      setGoalId('')
      setReqId('')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else {
        toast.error('関連付けの追加に失敗しました')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          関連付けを追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Goal / 目標要件を関連付け</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>関連先の種別</Label>
            <Select
              value={targetType}
              onValueChange={(v) => {
                setTargetType(v as LinkTargetType)
                setReqId('')
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOAL">Goal</SelectItem>
                <SelectItem value="GOAL_REQUIREMENT">目標要件</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Goal</Label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger>
                <SelectValue placeholder="Goal を選択" />
              </SelectTrigger>
              <SelectContent>
                {goals.data?.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetType === 'GOAL_REQUIREMENT' && (
            <div className="space-y-1">
              <Label>目標要件</Label>
              <Select value={reqId} onValueChange={setReqId} disabled={goalId === ''}>
                <SelectTrigger>
                  <SelectValue placeholder="目標要件を選択" />
                </SelectTrigger>
                <SelectContent>
                  {requirements.data?.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>貢献度 *</Label>
            <Select value={weight} onValueChange={(v) => setWeight(v as ContributionWeight)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="MEDIUM">中</SelectItem>
                <SelectItem value="LOW">低</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={createLink.isPending}>
              追加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
