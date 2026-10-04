---
inclusion: always
---

# Goal Network App — Project Structure

## ディレクトリ構成

```
goal-network-app/                    # ワークスペースルート
├── .kiro/
│   ├── specs/goal-network-app/
│   │   ├── requirements.md          # 要件定義（確定済み）
│   │   ├── design.md                # 技術設計（確定済み）
│   │   └── tasks.md                 # 実装タスクリスト
│   └── steering/
│       ├── product.md               # プロダクト概要・ルール（本ファイル群）
│       ├── tech.md                  # 技術スタック・規約
│       └── structure.md             # プロジェクト構造（このファイル）
├── prisma/
│   ├── schema.prisma                # DB スキーマ定義（Prisma）
│   └── migrations/                  # マイグレーション履歴
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # グローバルレイアウト（QueryClientProvider・Toaster）
│   │   ├── page.tsx                 # ホーム画面（推奨行動算出）
│   │   ├── goals/
│   │   │   ├── page.tsx             # 目標一覧
│   │   │   └── [id]/
│   │   │       ├── page.tsx         # 目標詳細
│   │   │       └── requirements/
│   │   │           └── [rid]/
│   │   │               └── page.tsx # 目標要件詳細
│   │   ├── actions/
│   │   │   ├── page.tsx             # 行動一覧
│   │   │   └── [id]/
│   │   │       └── page.tsx         # 行動詳細
│   │   └── api/                     # Route Handlers（バックエンド）
│   │       ├── goals/
│   │       │   ├── route.ts         # GET (list) / POST
│   │       │   └── [id]/
│   │       │       ├── route.ts     # GET / PATCH / DELETE
│   │       │       └── requirements/
│   │       │           └── route.ts # GET (list) / POST
│   │       ├── goal-requirements/
│   │       │   └── [id]/
│   │       │       └── route.ts     # GET / PATCH / DELETE
│   │       ├── actions/
│   │       │   ├── route.ts         # GET (list) / POST
│   │       │   └── [id]/
│   │       │       ├── route.ts     # GET / PATCH / DELETE
│   │       │       ├── links/
│   │       │       │   └── route.ts # GET / POST
│   │       │       └── complete/
│   │       │           └── route.ts # POST（完了記録作成）
│   │       ├── action-links/
│   │       │   └── [id]/
│   │       │       └── route.ts     # DELETE
│   │       ├── completion-records/
│   │       │   └── [id]/
│   │       │       └── route.ts     # DELETE（完了取り消し）
│   │       ├── available-daily-time/
│   │       │   └── route.ts         # GET / PUT（UPSERT）
│   │       └── recommendations/
│   │           └── route.ts         # POST（推奨算出）
│   ├── lib/                         # サーバーサイドロジック
│   │   ├── prisma.ts                # Prisma クライアントシングルトン
│   │   ├── scoring-config.ts        # 係数・閾値の定数（SCORING_CONFIG）
│   │   ├── recommendation-engine.ts # 純粋関数群（DB アクセスなし）
│   │   └── progress.ts              # 進捗率算出ロジック（純粋関数）
│   ├── schemas/
│   │   └── index.ts                 # 共有 Zod スキーマ（フロント・バック両用）
│   ├── hooks/                       # TanStack Query カスタムフック
│   │   ├── useGoals.ts
│   │   ├── useActions.ts
│   │   ├── useActionLinks.ts
│   │   ├── useCompletions.ts
│   │   ├── useAvailableDailyTime.ts
│   │   └── useRecommendations.ts
│   └── components/
│       ├── ui/                      # shadcn/ui 生成コンポーネント（直接編集しない）
│       ├── goals/                   # Goal 関連コンポーネント
│       ├── actions/                 # Action 関連コンポーネント
│       └── recommendations/        # 推奨画面コンポーネント
│           └── RecommendationCard.tsx
└── tests/
    ├── unit/                        # ユニットテスト（推奨理由テキスト等）
    ├── property/                    # fast-check PBT（Property 1〜11）
    │   ├── recommendation-engine.test.ts
    │   ├── progress.test.ts
    │   ├── available-daily-time.test.ts
    │   └── validation.test.ts
    └── integration/                 # Route Handler 統合テスト（SQLite in-memory）
        └── recommendations.test.ts
```

## データモデル（Prisma）

### テーブル一覧

| テーブル | 主な役割 |
|---------|---------|
| `Goal` | 人生目標。重要度（HIGH/MEDIUM/LOW）・期限・Status を持つ |
| `GoalRequirement` | Goal 配下の中間成果。Goal に FK（CASCADE） |
| `Action` | 具体的な行動。ActionType（TASK/HABIT）・必要時間・Status を持つ |
| `ActionLink` | Action と Goal/GoalRequirement の多対多。**貢献度（ContributionWeight）を持つ** |
| `CompletionRecord` | Action の完了日時を UTC で記録 |
| `AvailableDailyTime` | 当日の利用可能時間。date カラムは `"YYYY-MM-DD"` 文字列 |

### ActionLink の設計（polymorphic）

```prisma
model ActionLink {
  targetType        LinkTargetType      // GOAL または GOAL_REQUIREMENT
  goalId            Int?                // targetType = GOAL の場合
  goalRequirementId Int?                // targetType = GOAL_REQUIREMENT の場合
  contributionWeight ContributionWeight // HIGH / MEDIUM / LOW（必須）

  @@unique([actionId, goalId])
  @@unique([actionId, goalRequirementId])
}
```

### CASCADE 削除の連鎖

```
Goal 削除
  └→ GoalRequirement 削除（onDelete: Cascade）
       └→ ActionLink 削除（onDelete: Cascade）

Action 削除
  └→ ActionLink 削除（onDelete: Cascade）
  └→ CompletionRecord 削除（onDelete: Cascade）
```

### AvailableDailyTime の UPSERT パターン

```typescript
await prisma.availableDailyTime.upsert({
  where: { date: "2025-01-15" },   // YYYY-MM-DD（ユーザーのローカルタイムゾーン基準）
  update: { availableMinutes },
  create: { date: "2025-01-15", availableMinutes },
});
```

## 主要画面と対応 API

| 画面 | パス | 主要 API |
|-----|------|---------|
| ホーム（推奨算出） | `/` | `GET/PUT /api/available-daily-time`, `POST /api/recommendations` |
| 目標一覧 | `/goals` | `GET /api/goals?status=` |
| 目標詳細 | `/goals/:id` | `GET/PATCH/DELETE /api/goals/:id` |
| 目標要件詳細 | `/goals/:id/requirements/:rid` | `GET/PATCH/DELETE /api/goal-requirements/:id` |
| 行動一覧 | `/actions` | `GET /api/actions?status=&type=` |
| 行動詳細 | `/actions/:id` | `GET/PATCH/DELETE /api/actions/:id`, `POST /api/actions/:id/complete` |

## ファイル命名規則

- **ページコンポーネント**: `page.tsx`（Next.js 規約）
- **API Route Handler**: `route.ts`（Next.js 規約）
- **ライブラリ**: `kebab-case.ts`（例: `scoring-config.ts`, `recommendation-engine.ts`）
- **React コンポーネント**: `PascalCase.tsx`（例: `RecommendationCard.tsx`）
- **カスタムフック**: `useCamelCase.ts`（例: `useGoals.ts`）
- **テストファイル**: `対象ファイル名.test.ts`（例: `recommendation-engine.test.ts`）

## 実装の進行順序（tasks.md 準拠）

1. プロジェクトセットアップ（Next.js + Prisma + shadcn/ui）
2. Prisma スキーマ定義 + マイグレーション
3. `scoring-config.ts` + 共有 Zod スキーマ
4. コアロジック純粋関数（`recommendation-engine.ts`, `progress.ts`）
5. PBT（Property 1〜11）
6. API エンドポイント（Goals → GoalRequirements → Actions → ActionLinks → CompletionRecords → AvailableDailyTime → Recommendations）
7. フロントエンド画面（ホーム推奨 → 目標管理 → 行動管理）
