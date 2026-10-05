// src/lib/action-scoring.ts
//
// DB から取得した Action（ActionLink + 関連 Goal/GoalRequirement を include）を
// RecommendationEngine の ActionInput に変換するアダプタ。
// Route Handler から呼び出す（純粋なエンジンと DB の橋渡し）。

import type {
  ActionInput,
  ActionLinkInput,
  WeightLevel,
} from './recommendation-engine'

// Prisma から include で取得する Action の形（必要なフィールドのみ）
export interface ActionWithRelations {
  id: number
  requiredMinutes: number
  deadline: Date | null
  actionType: 'TASK' | 'HABIT'
  actionLinks: {
    targetType: 'GOAL' | 'GOAL_REQUIREMENT'
    contributionWeight: WeightLevel
    goal: { id: number; importance: WeightLevel; status: string } | null
    goalRequirement: {
      id: number
      status: string
      goal: { id: number; importance: WeightLevel; status: string }
    } | null
  }[]
}

// ActionLink から「貢献先の親 Goal」を特定する。
// GOAL の場合はその Goal、GOAL_REQUIREMENT の場合は親 Goal。
// Active 判定: Goal が ACTIVE であること。GoalRequirement 経由の場合は
// GoalRequirement 自身も ACTIVE であることを条件とする（要件10.4）。
function resolveLink(
  link: ActionWithRelations['actionLinks'][number]
): { goalId: number; goalImportance: WeightLevel; isActive: boolean } | null {
  if (link.targetType === 'GOAL' && link.goal) {
    return {
      goalId: link.goal.id,
      goalImportance: link.goal.importance,
      isActive: link.goal.status === 'ACTIVE',
    }
  }
  if (link.targetType === 'GOAL_REQUIREMENT' && link.goalRequirement) {
    const parentGoal = link.goalRequirement.goal
    return {
      goalId: parentGoal.id,
      goalImportance: parentGoal.importance,
      isActive:
        parentGoal.status === 'ACTIVE' && link.goalRequirement.status === 'ACTIVE',
    }
  }
  return null
}

export function toActionInput(action: ActionWithRelations): ActionInput {
  const actionLinks: ActionLinkInput[] = []
  const activeGoalIds = new Set<number>()

  for (const link of action.actionLinks) {
    const resolved = resolveLink(link)
    if (!resolved) continue

    actionLinks.push({
      targetGoalId: resolved.goalId,
      contributionWeight: link.contributionWeight,
      goalImportance: resolved.goalImportance,
    })

    if (resolved.isActive) {
      activeGoalIds.add(resolved.goalId)
    }
  }

  return {
    id: action.id,
    requiredMinutes: action.requiredMinutes,
    deadline: action.deadline,
    actionType: action.actionType,
    actionLinks,
    activeGoalIds: [...activeGoalIds],
  }
}

// Action 詳細取得時に使う Prisma include 定義（共通化）
export const actionScoringInclude = {
  actionLinks: {
    include: {
      goal: true,
      goalRequirement: { include: { goal: true } },
    },
  },
} as const
