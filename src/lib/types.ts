// src/lib/types.ts
//
// フロントエンドで使う API レスポンスの型。
// バックエンドのレスポンス形状に合わせて定義する（API は変更しない）。

export type Status = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
export type Importance = 'HIGH' | 'MEDIUM' | 'LOW'
export type ContributionWeight = 'HIGH' | 'MEDIUM' | 'LOW'
export type ActionType = 'TASK' | 'HABIT'
export type LinkTargetType = 'GOAL' | 'GOAL_REQUIREMENT'

export interface Goal {
  id: number
  title: string
  description: string | null
  importance: Importance
  deadline: string | null
  status: Status
  createdAt: string
  updatedAt: string
}

export interface GoalRequirement {
  id: number
  goalId: number
  title: string
  description: string | null
  status: Status
  createdAt: string
  updatedAt: string
}

export interface HabitSummary {
  id: number
  title: string
  executionCount: number
  lastExecutedAt: string | null
}

export interface GoalDetail extends Goal {
  requirements: GoalRequirement[]
  progress: number
  habitActions: HabitSummary[]
}

export interface GoalRequirementDetail extends GoalRequirement {
  progress: number
  habitActions: HabitSummary[]
}

export interface Action {
  id: number
  title: string
  description: string | null
  requiredMinutes: number
  deadline: string | null
  actionType: ActionType
  status: Status
  createdAt: string
  updatedAt: string
  priorityScore?: number
}

export interface ActionLink {
  id: number
  actionId: number
  targetType: LinkTargetType
  goalId: number | null
  goalRequirementId: number | null
  contributionWeight: ContributionWeight
  createdAt: string
  goal: { id: number; title: string } | null
  goalRequirement: { id: number; title: string } | null
}

export interface CompletionRecord {
  id: number
  actionId: number
  completedAt: string
}

export interface ActionDetail extends Action {
  actionLinks: ActionLink[]
  completionRecords: CompletionRecord[]
}

export interface AvailableDailyTime {
  id: number
  date: string
  availableMinutes: number
  createdAt: string
  updatedAt: string
}

export interface ScoringBreakdown {
  linkBreakdowns: {
    goalId: number
    importanceWeight: number
    contributionWeight: number
    product: number
  }[]
  sumImportanceContribution: number
  uniqueActiveGoalCount: number
  crossGoalBonus: number
  urgencyFactor: number
  normalizedDuration: number
  priorityScore: number
}

export interface Recommendation {
  rank: number
  action: {
    id: number
    title: string
    requiredMinutes: number
    actionType: ActionType
    deadline: string | null
  }
  priorityScore: number
  relatedGoals: { id: number; title: string }[]
  relatedRequirements: { id: number; title: string }[]
  reasonText: string
  breakdown: ScoringBreakdown
}

export interface RecommendationResponse {
  recommendations: Recommendation[]
  totalRequiredMinutes: number
  remainingMinutes: number
  noResultMessage?: string
}
