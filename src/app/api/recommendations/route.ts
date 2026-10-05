// src/app/api/recommendations/route.ts
// POST /api/recommendations（推奨行動算出）

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { RecommendationRequestSchema } from '@/schemas'
import { validationError, internalError } from '@/lib/api-helpers'
import { localDateString, localDayRangeUtc } from '@/lib/date-utils'
import {
  toActionInput,
  actionScoringInclude,
  type ActionWithRelations,
} from '@/lib/action-scoring'
import {
  calcPriorityScore,
  selectRecommendations,
  type ScoredAction,
  type WeightLevel,
} from '@/lib/recommendation-engine'
import { generateReasonText } from '@/lib/reason-text'

export async function POST(request: NextRequest) {
  try {
    // タイムゾーン取得（ボディ優先 → X-Timezone ヘッダー → UTC）
    const body = await request.json().catch(() => ({}))
    const parsed = RecommendationRequestSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const { availableMinutes } = parsed.data

    let timezone = 'UTC'
    if (body && typeof body.timezone === 'string' && body.timezone.length > 0) {
      timezone = body.timezone
    } else {
      const headersList = await headers()
      const headerTz = headersList.get('X-Timezone')
      if (headerTz) timezone = headerTz
    }

    const now = new Date()
    const dateStr = localDateString(timezone, now)
    const { start, end } = localDayRangeUtc(timezone, dateStr)

    // Status=ACTIVE の Action を関連情報付きで取得
    const actions = await prisma.action.findMany({
      where: { status: 'ACTIVE' },
      include: {
        ...actionScoringInclude,
        completionRecords: true,
      },
    })

    // 除外: 完了済み Task（CompletionRecord が1件でも存在）・当日完了済み Habit
    const candidates: ScoredAction[] = []
    // 関連 Goal / GoalRequirement のタイトル・重要度を保持するためのマップ
    const metaMap = new Map<
      number,
      {
        title: string
        requiredMinutes: number
        actionType: 'TASK' | 'HABIT'
        deadline: Date | null
        relatedGoals: { id: number; title: string }[]
        relatedRequirements: { id: number; title: string }[]
        goalImportances: WeightLevel[]
      }
    >()

    for (const action of actions) {
      const records = action.completionRecords
      if (action.actionType === 'TASK') {
        if (records.length > 0) continue // 完了済み Task は恒久除外
      } else {
        // 当日完了済み Habit は除外
        const completedToday = records.some(
          (r) => r.completedAt >= start && r.completedAt <= end
        )
        if (completedToday) continue
      }

      const input = toActionInput(action as unknown as ActionWithRelations)
      const breakdown = calcPriorityScore(input, now)

      // Active Goal に関連しない Action（スコア0）は推奨対象外
      if (breakdown.uniqueActiveGoalCount === 0 || breakdown.priorityScore === 0) continue

      candidates.push({
        actionId: action.id,
        requiredMinutes: action.requiredMinutes,
        priorityScore: breakdown.priorityScore,
        breakdown,
      })

      // メタ情報（関連 Goal / GoalRequirement）
      const relatedGoals: { id: number; title: string }[] = []
      const relatedRequirements: { id: number; title: string }[] = []
      const goalImportances: WeightLevel[] = []
      const seenGoal = new Set<number>()
      const seenReq = new Set<number>()
      for (const link of action.actionLinks) {
        if (link.targetType === 'GOAL' && link.goal) {
          if (!seenGoal.has(link.goal.id)) {
            seenGoal.add(link.goal.id)
            relatedGoals.push({ id: link.goal.id, title: link.goal.title })
          }
          goalImportances.push(link.goal.importance as WeightLevel)
        } else if (link.targetType === 'GOAL_REQUIREMENT' && link.goalRequirement) {
          if (!seenReq.has(link.goalRequirement.id)) {
            seenReq.add(link.goalRequirement.id)
            relatedRequirements.push({
              id: link.goalRequirement.id,
              title: link.goalRequirement.title,
            })
          }
          goalImportances.push(link.goalRequirement.goal.importance as WeightLevel)
        }
      }

      metaMap.set(action.id, {
        title: action.title,
        requiredMinutes: action.requiredMinutes,
        actionType: action.actionType,
        deadline: action.deadline,
        relatedGoals,
        relatedRequirements,
        goalImportances,
      })
    }

    const result = selectRecommendations(candidates, availableMinutes)

    const recommendations = result.recommendations.map((scored, index) => {
      const meta = metaMap.get(scored.actionId)!
      const reasonText = generateReasonText(
        { deadline: meta.deadline, goalImportances: meta.goalImportances },
        scored.breakdown,
        now
      )
      return {
        rank: index + 1,
        action: {
          id: scored.actionId,
          title: meta.title,
          requiredMinutes: meta.requiredMinutes,
          actionType: meta.actionType,
          deadline: meta.deadline ? meta.deadline.toISOString() : null,
        },
        priorityScore: scored.priorityScore,
        relatedGoals: meta.relatedGoals,
        relatedRequirements: meta.relatedRequirements,
        reasonText,
        breakdown: scored.breakdown,
      }
    })

    return NextResponse.json({
      recommendations,
      totalRequiredMinutes: result.totalRequiredMinutes,
      remainingMinutes: result.remainingMinutes,
      ...(recommendations.length === 0
        ? { noResultMessage: '条件を満たす行動がありません' }
        : {}),
    })
  } catch {
    return internalError()
  }
}
