// src/lib/progress.ts
//
// 進捗率算出ロジック（純粋関数）。DB アクセスは含めない。
// Task 型 Action のみを対象とし、Habit 型は進捗率の分母・分子から除外する。

export interface GoalProgressInput {
  directTaskActions: { id: number; isCompleted: boolean }[]
  requirementTaskActions: { id: number; isCompleted: boolean }[] // 全 GoalRequirement 分
}

// ── calcGoalProgress ────────────────────────────────────
// (a) Goal に直接リンクされた Task と (b) 配下 GoalRequirement にリンクされた Task を
// actionId をキーに UNION DISTINCT で重複排除してから進捗率を算出する。
// 進捗率 = floor(completed / total * 100)。total=0 の場合は 0 を返す。

export function calcGoalProgress(input: GoalProgressInput): number {
  const allUnique = new Map<number, boolean>()
  for (const a of [...input.directTaskActions, ...input.requirementTaskActions]) {
    if (!allUnique.has(a.id)) allUnique.set(a.id, a.isCompleted)
  }
  const total = allUnique.size
  if (total === 0) return 0
  const completed = [...allUnique.values()].filter(Boolean).length
  return Math.floor((completed / total) * 100)
}

// ── calcRequirementProgress ─────────────────────────────
// 直接リンクされた Task のみ対象（Habit は呼び出し側で除外済みの前提）。
// 進捗率 = floor(completed / total * 100)。0件の場合は 0 を返す。

export function calcRequirementProgress(
  taskActions: { id: number; isCompleted: boolean }[]
): number {
  if (taskActions.length === 0) return 0
  const completed = taskActions.filter((a) => a.isCompleted).length
  return Math.floor((completed / taskActions.length) * 100)
}
