// src/lib/scoring-config.ts
//
// MVP における係数管理方針:
// - すべての係数・閾値をこのファイルに集約し、1か所の変更で全体に反映できるようにする
// - 環境変数・管理画面からの動的変更は MVP 対象外
// - 将来的に動的変更が必要になった場合は DB 管理や環境変数対応への移行を想定する
//
// 変更が必要な場合はこのファイルを直接編集すること。

export const SCORING_CONFIG = {
  urgencyFactor: {
    overdue: 3.0, // 期限切れ
    within7Days: 2.0, // 0〜7日以内
    within30Days: 1.5, // 8〜30日以内
    noDeadline: 1.0, // 期限なし / 31日超
  },
  urgencyThresholds: {
    immediate: 7, // 日数
    near: 30, // 日数
  },
  crossGoalBonus: {
    oneGoal: 1.0,
    twoGoals: 1.1,
    threeOrMoreGoals: 1.2,
  },
  normalizedDurationBase: 30, // 分
  maxRecommendations: 3,
  maxCandidates: 10,
} as const
