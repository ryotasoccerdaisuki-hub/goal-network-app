---
inclusion: always
---

# Goal Network App — Technology Stack & Conventions

## 技術スタック

| レイヤー | 採用技術 | バージョン |
|---------|---------|----------|
| フレームワーク | Next.js (App Router) + TypeScript | 15.x |
| UI | shadcn/ui + Tailwind CSS | latest |
| サーバー状態管理 | TanStack Query | v5 |
| ORM | Prisma | v6 |
| データベース | SQLite（ローカル実行・デモ用途） | — |
| バリデーション | Zod | latest |
| テスト | Vitest + fast-check | latest |
| 日付処理 | date-fns + date-fns-tz | latest |

> **SQLite の運用方針**: ローカル実行・デモ用途を前提として採用。将来的に公開運用へ移行する場合は PostgreSQL 等のサーバー DB への移行を想定する。Prisma を ORM として使用しているため、`datasource db { provider }` の変更とマイグレーション再実行で移行可能。

## パッケージマネージャー

`pnpm` を使用する。

## 重要な設計原則

### RecommendationEngine は純粋関数として実装する

`src/lib/recommendation-engine.ts` の関数群は **DB アクセスを含まない純粋関数** として実装する。
Route Handler 側で Prisma を使ってデータを取得し、エンジンに引数として渡す設計にすること。
これにより、モックなしでユニットテスト・プロパティベーステストが可能になる。

```typescript
// ✅ 正しい: 純粋関数
export function calcPriorityScore(action: ActionInput, today: Date): ScoringBreakdown { ... }

// ❌ 誤り: DB アクセスを含む
export async function calcPriorityScore(actionId: number): Promise<ScoringBreakdown> {
  const action = await prisma.action.findUnique(...); // NG
}
```

### スコア係数は scoring-config.ts に集約する

すべてのスコア係数・閾値は `src/lib/scoring-config.ts` の `SCORING_CONFIG` 定数に集約する。
**環境変数・管理画面からの動的変更は MVP 対象外**。変更が必要な場合はこのファイルを直接編集する。

```typescript
// src/lib/scoring-config.ts
export const SCORING_CONFIG = {
  urgencyFactor: { overdue: 3.0, within7Days: 2.0, within30Days: 1.5, noDeadline: 1.0 },
  urgencyThresholds: { immediate: 7, near: 30 },
  crossGoalBonus: { oneGoal: 1.0, twoGoals: 1.1, threeOrMoreGoals: 1.2 },
  normalizedDurationBase: 30,
  maxRecommendations: 3,
  maxCandidates: 10,
} as const;
```

### Zod スキーマはフロント・バック両方で共有する

`src/schemas/index.ts` に定義したスキーマを Route Handler とフロントエンドフォームの両方で使用する。
バリデーションロジックを2か所に書かない。

### タイムゾーン処理

- `CompletionRecord.completedAt` は **UTC で SQLite に保存**する
- クライアントは `X-Timezone` ヘッダーまたはリクエストボディでローカルタイムゾーン文字列（例: `"Asia/Tokyo"`）を送信する
- Route Handler 側で `date-fns-tz` を使って UTC↔ローカル変換を行う
- `AvailableDailyTime.date` は `"YYYY-MM-DD"` 形式の文字列として保存する（SQLite に DATE 型がないため）

### エラーレスポンス形式

すべての API エラーは以下の統一形式で返す:

```typescript
interface ErrorResponse {
  error: string;
  details?: { field: string; message: string }[];
  code?: string; // "VALIDATION_ERROR" | "NOT_FOUND" | "DUPLICATE_ACTION_LINK" | "DUPLICATE_COMPLETION" | "INTERNAL_ERROR"
}
```

| HTTP ステータス | 用途 |
|--------------|------|
| 400 | バリデーション失敗 |
| 404 | リソース未発見 |
| 409 | 重複登録（ActionLink / CompletionRecord） |
| 500 | DB/サーバーエラー |

## テスト戦略

### プロパティベーステスト（PBT）

`fast-check` を使用。`tests/property/` ディレクトリに配置する。

```typescript
// 各テストのタグコメント形式
// Feature: goal-network-app, Property N: プロパティ名
it('description', () => {
  fc.assert(fc.property(...arbitraries, (...args) => { /* assertion */ }), { numRuns: 100 });
});
```

実装対象プロパティ（11件）:

| # | 対象関数 | ファイル |
|---|---------|---------|
| 1 | `calcPriorityScore` | `tests/property/recommendation-engine.test.ts` |
| 2 | `calcUrgencyFactor` | 同上 |
| 3 | `calcCrossGoalBonus` | 同上 |
| 4〜6 | `selectRecommendations` | 同上 |
| 7 | `calcGoalProgress` | `tests/property/progress.test.ts` |
| 8 | `calcRequirementProgress` | 同上 |
| 9 | AvailableDailyTime UPSERT | `tests/property/available-daily-time.test.ts` |
| 10〜11 | Zod スキーマ（タイトルバリデーション） | `tests/property/validation.test.ts` |

### テスト種別と配置

```
tests/
├── unit/        # 推奨理由テキスト生成などの具体例テスト
├── property/    # fast-check PBT（上記11プロパティ）
└── integration/ # Route Handler + SQLite in-memory
```

### テスト実行コマンド

```bash
pnpm vitest run           # 全テスト（1回実行）
pnpm vitest run tests/property    # PBT のみ
pnpm vitest run tests/integration # 統合テストのみ
```

## コーディング規約

- TypeScript strict モードを有効にする
- `any` 型は使用しない。不明な型は `unknown` を使い、型ガードで絞り込む
- Prisma の型は `import type` で取り込む
- React コンポーネントは `function` 宣言で記述する（アロー関数不可）
- shadcn/ui のコンポーネントは `src/components/ui/` に配置し、直接編集しない
- カスタムコンポーネントは `src/components/goals/`, `src/components/actions/`, `src/components/recommendations/` に配置する
- API Route Handler は `src/app/api/` 配下に配置し、ビジネスロジックは `src/lib/` に切り出す
