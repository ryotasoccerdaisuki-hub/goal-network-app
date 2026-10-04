// src/schemas/index.ts
//
// 共有 Zod スキーマ定義（フロントエンドフォーム・バックエンド Route Handler の両方で使用する）。
// バリデーションロジックを2か所に書かないため、必ずこのファイルのスキーマを import して使うこと。
//
// 注意: Zod v4 では error customization が統一された `error` パラメータに変更され、
// `required_error` / `invalid_type_error` は廃止された。日付文字列（YYYY-MM-DD）の検証は
// `z.iso.date()` を使用する（`z.string().date()` は非推奨）。

import { z } from 'zod'

// ── 共通の列挙型 ────────────────────────────────────────

export const StatusEnum = z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED'])
export const ImportanceEnum = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export const ContributionWeightEnum = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export const ActionTypeEnum = z.enum(['TASK', 'HABIT'])
export const LinkTargetTypeEnum = z.enum(['GOAL', 'GOAL_REQUIREMENT'])

// ── 共通のフィールド部品 ────────────────────────────────

// タイトル: 1〜100文字、trim 後に空白のみは拒否する
const titleSchema = z
  .string()
  .min(1, 'タイトルは必須です')
  .max(100, 'タイトルは100文字以内で入力してください')
  .refine((s) => s.trim().length > 0, 'タイトルに空白のみは入力できません')

// ── Goal ────────────────────────────────────────────────

export const GoalSchema = z.object({
  title: titleSchema,
  description: z
    .string()
    .max(1000, '説明は1000文字以内で入力してください')
    .optional(),
  importance: ImportanceEnum,
  deadline: z.iso.date('期限は YYYY-MM-DD 形式で入力してください').optional().nullable(),
  status: StatusEnum.default('ACTIVE'),
})

export type GoalInput = z.infer<typeof GoalSchema>

// ── GoalRequirement ─────────────────────────────────────

export const GoalRequirementSchema = z.object({
  title: titleSchema,
  description: z
    .string()
    .max(500, '説明は500文字以内で入力してください')
    .optional(),
  status: StatusEnum.default('ACTIVE'),
})

export type GoalRequirementInput = z.infer<typeof GoalRequirementSchema>

// ── Action ──────────────────────────────────────────────

export const ActionSchema = z.object({
  title: titleSchema,
  description: z
    .string()
    .max(1000, '説明は1000文字以内で入力してください')
    .optional(),
  requiredMinutes: z
    .int('必要時間は整数で入力してください')
    .min(1, '必要時間は1分以上で入力してください')
    .max(1440, '必要時間は1440分（24時間）以内で入力してください'),
  deadline: z.iso.date('期限は YYYY-MM-DD 形式で入力してください').optional().nullable(),
  actionType: ActionTypeEnum,
  status: StatusEnum.default('ACTIVE'),
})

export type ActionInput = z.infer<typeof ActionSchema>

// ── ActionLink ──────────────────────────────────────────
//
// targetType が GOAL の場合は goalId、GOAL_REQUIREMENT の場合は goalRequirementId を
// 使用する。貢献度（contributionWeight）は必須。

export const ActionLinkSchema = z
  .object({
    targetType: LinkTargetTypeEnum,
    goalId: z.int().positive().optional(),
    goalRequirementId: z.int().positive().optional(),
    contributionWeight: ContributionWeightEnum,
  })
  .refine(
    (data) =>
      data.targetType === 'GOAL'
        ? data.goalId != null && data.goalRequirementId == null
        : data.goalRequirementId != null && data.goalId == null,
    {
      error:
        'targetType に対応する ID（GOAL は goalId、GOAL_REQUIREMENT は goalRequirementId）を指定してください',
      path: ['targetType'],
    }
  )

export type ActionLinkInput = z.infer<typeof ActionLinkSchema>

// ── AvailableDailyTime ──────────────────────────────────

export const AvailableDailyTimeSchema = z.object({
  availableMinutes: z
    .int('利用可能時間は整数で入力してください')
    .min(1, '利用可能時間は1分以上で入力してください')
    .max(1440, '利用可能時間は1440分（24時間）以内で入力してください'),
  date: z.iso.date('日付は YYYY-MM-DD 形式で入力してください'),
})

export type AvailableDailyTimeInput = z.infer<typeof AvailableDailyTimeSchema>

// ── RecommendationRequest ───────────────────────────────

export const RecommendationRequestSchema = z.object({
  availableMinutes: z
    .int('利用可能時間は整数で入力してください')
    .min(1, '利用可能時間は1分以上で入力してください')
    .max(1440, '利用可能時間は1440分（24時間）以内で入力してください'),
})

export type RecommendationRequestInput = z.infer<typeof RecommendationRequestSchema>
