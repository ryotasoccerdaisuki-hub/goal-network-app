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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActionSchema } from '@/schemas'
import { ApiError } from '@/lib/api-client'
import type { Action, ActionType, Status } from '@/lib/types'
import { toDateInputValue } from '@/lib/labels'

interface Props {
  trigger: React.ReactNode
  initial?: Action
  title: string
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>
}

export function ActionFormDialog({ trigger, initial, title, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [titleValue, setTitleValue] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [requiredMinutes, setRequiredMinutes] = useState(
    initial ? String(initial.requiredMinutes) : '30'
  )
  const [deadline, setDeadline] = useState(toDateInputValue(initial?.deadline ?? null))
  const [actionType, setActionType] = useState<ActionType>(initial?.actionType ?? 'TASK')
  const [status, setStatus] = useState<Status>(initial?.status ?? 'ACTIVE')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const payload = {
      title: titleValue,
      description: description.trim() === '' ? undefined : description,
      requiredMinutes: Number(requiredMinutes),
      deadline: deadline === '' ? null : deadline,
      actionType,
      status,
    }

    const parsed = ActionSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(payload)
      toast.success('保存しました')
      setOpen(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '保存に失敗しました'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="action-title">タイトル *</Label>
            <Input
              id="action-title"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="action-desc">説明</Label>
            <Textarea
              id="action-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="action-minutes">必要時間（分, 1〜1440）*</Label>
            <Input
              id="action-minutes"
              type="number"
              min={1}
              max={1440}
              value={requiredMinutes}
              onChange={(e) => setRequiredMinutes(e.target.value)}
            />
            {errors.requiredMinutes && (
              <p className="text-sm text-destructive">{errors.requiredMinutes}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>ActionType *</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TASK">Task（一度きり）</SelectItem>
                <SelectItem value="HABIT">Habit（繰り返し）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="action-deadline">期限</Label>
            <Input
              id="action-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
