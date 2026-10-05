# Implementation Plan: goal-network-app

## Overview

requirements.md・design.md をもとに、Goal Network App の実装タスクを段階的に定義する。
各タスクは前のタスクの成果物を前提として積み上がる構成とし、コアロジック→API→フロントエンドの順で進める。
`*` のついたサブタスクはオプション（テスト系）であり、MVP を優先する場合はスキップ可能。

---

## Tasks

- [x] 1. プロジェクトセットアップと依存パッケージの導入
  - Next.js 15 (App Router) + TypeScript の新規プロジェクトを作成する
  - 以下のパッケージをインストールする: `prisma`, `@prisma/client`, `zod`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `fast-check`, `vitest`, `@vitejs/plugin-react`, `date-fns`, `date-fns-tz`
  - shadcn/ui を初期化し、使用するコンポーネント（button, input, select, dialog, toast, badge, card, form, label, textarea）を追加する
  - `vitest.config.ts` を作成し、`tests/unit`, `tests/property`, `tests/integration` の3ディレクトリ構成でテスト環境を設定する
  - `src/app`, `src/lib`, `src/schemas`, `src/components`, `tests/unit`, `tests/property`, `tests/integration` のディレクトリ構造を作成する
  - _Requirements: 全体_

- [x] 2. Prisma スキーマ定義とDBマイグレーション
  - [x] 2.1 `prisma/schema.prisma` を作成し、以下のモデルとEnum をすべて定義する
    - Enum: `Status` (ACTIVE/ON_HOLD/COMPLETED), `Importance` (HIGH/MEDIUM/LOW), `ContributionWeight` (HIGH/MEDIUM/LOW), `ActionType` (TASK/HABIT), `LinkTargetType` (GOAL/GOAL_REQUIREMENT)
    - Model: `Goal`, `GoalRequirement`, `Action`, `ActionLink`, `CompletionRecord`, `AvailableDailyTime`
    - `ActionLink` には `@@unique([actionId, goalId])` と `@@unique([actionId, goalRequirementId])` の複合ユニーク制約を設定する
    - CASCADE 削除: Goal削除→GoalRequirement→ActionLink、Action削除→ActionLink+CompletionRecord
    - `AvailableDailyTime.date` は `String` 型（"YYYY-MM-DD" 形式）、`@@unique([date])` を設定する
    - `generator client` は `provider = "prisma-client"` + `output = "../src/generated/prisma"` を使用する（`prisma-client-js` は将来削除予定のため使用しない）
    - _Requirements: 1, 2, 3, 4, 6, 8_
  - [x] 2.2 `prisma migrate dev --name init` を実行して初回マイグレーションを適用し、`src/lib/prisma.ts` に Prisma クライアントシングルトンを実装する
    - `PrismaClient` のインポートは `'@prisma/client'` ではなく生成先の `'../generated/prisma/client'` から行う（`output` に合わせてパスを調整する）
    - _Requirements: 全体_

- [x] 3. 設定ファイルと共有スキーマの実装
  - [x] 3.1 `src/lib/scoring-config.ts` を作成し、`SCORING_CONFIG` 定数オブジェクトを定義する
    - urgencyFactor: `{ overdue: 3.0, within7Days: 2.0, within30Days: 1.5, noDeadline: 1.0 }`
    - urgencyThresholds: `{ immediate: 7, near: 30 }`
    - crossGoalBonus: `{ oneGoal: 1.0, twoGoals: 1.1, threeOrMoreGoals: 1.2 }`
    - normalizedDurationBase: 30
    - maxRecommendations: 3, maxCandidates: 10
    - `as const` で型推論が効くように定義する
    - _Requirements: 5.12_
  - [x] 3.2 `src/schemas/index.ts` を作成し、Zod スキーマをフロント・バック両用で定義する
    - `GoalSchema`: title (min 1, max 100, trim後空白拒否), description (max 1000, optional), importance (HIGH/MEDIUM/LOW), deadline (date string, optional nullable), status (ACTIVE/ON_HOLD/COMPLETED, default ACTIVE)
    - `GoalRequirementSchema`: title (min 1, max 100, trim後空白拒否), description (max 500, optional), status
    - `ActionSchema`: title (min 1, max 100, trim後空白拒否), description (max 1000, optional), requiredMinutes (int, min 1, max 1440), deadline (optional nullable), actionType (TASK/HABIT), status
    - `ActionLinkSchema`: targetType (GOAL/GOAL_REQUIREMENT), goalId (optional), goalRequirementId (optional), contributionWeight (HIGH/MEDIUM/LOW)
    - `AvailableDailyTimeSchema`: availableMinutes (int, min 1, max 1440), date (string, YYYY-MM-DD format)
    - `RecommendationRequestSchema`: availableMinutes (int, min 1, max 1440)
    - _Requirements: 1.3, 1.4, 2.4, 3.3, 4.3a, 6.4, 6.5_

- [x] 4. コアビジネスロジック（純粋関数）の実装
  - [x] 4.1 `src/lib/recommendation-engine.ts` に型定義と `calcNormalizedDuration`, `calcUrgencyFactor`, `calcCrossGoalBonus` を実装する
    - `WeightLevel`, `ActionLinkInput`, `ActionInput`, `ScoringBreakdown`, `ScoredAction`, `RecommendationResult` の型/インターフェースを定義する
    - `WEIGHT_VALUES` 定数 (HIGH=3, MEDIUM=2, LOW=1) を定義する
    - `calcNormalizedDuration(requiredMinutes)`: `max(1, requiredMinutes / 30)` を返す
    - `calcUrgencyFactor(deadline, today)`: SCORING_CONFIG の閾値と係数を参照して返す（overdue=3.0, 0-7日=2.0, 8-30日=1.5, 31日超または期限なし=1.0）
    - `calcCrossGoalBonus(n)`: SCORING_CONFIG の係数を参照して返す
    - DBアクセスは一切含めない（純粋関数）
    - _Requirements: 5.1〜5.8, 5.12_
  - [x]* 4.2 Property 2・3 のプロパティテストを `tests/property/recommendation-engine.test.ts` に実装する
    - **Property 2: UrgencyFactor は残日数の閾値に従って決定される**
    - **Property 3: CrossGoalBonus は Active Goal 数のみに依存する**
    - `fc.integer()` で残日数・Goal数を生成し、仕様通りの値になることを100回以上検証する
    - タグコメント: `// Feature: goal-network-app, Property 2: ...` の形式
    - **Validates: Requirements 5.5, 5.6, 5.7, 5.8, 5.4, 4.6**
  - [x] 4.3 `src/lib/recommendation-engine.ts` に `calcPriorityScore` を実装する
    - 各 ActionLink の `ImportanceWeight × ContributionWeight` を計算し合算する（Σ）
    - GoalRequirement 経由の場合は親 Goal の ImportanceWeight を使用する
    - `activeGoalIds` からユニーク Active Goal 数を取得し CrossGoalBonus を適用する
    - Status が Active の Goal に関連しない Action（activeGoalIds が空）は priorityScore を 0 とする
    - 結果を小数点第2位まで（`Math.round(score * 100) / 100`）に丸めて `ScoringBreakdown` で返す
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.9, 5.10, 5.11_
  - [x]* 4.4 Property 1 のプロパティテストを `tests/property/recommendation-engine.test.ts` に追加する
    - **Property 1: PriorityScore 計算式の正確性**
    - `fc.record()` で有効な ActionInput を生成し、参照実装（単純な計算式）と比較して誤差 0.005 未満を検証する
    - Active Goal なしの場合に 0 を返すことも検証する
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.9, 5.10, 10.4**
  - [x] 4.5 `src/lib/recommendation-engine.ts` に `selectRecommendations` を実装する
    - Step 1: candidates を PriorityScore 降順でソートして最大 10 件に絞り込む
    - Step 2: 1〜3件のすべての組み合わせ（C(n,1)+C(n,2)+C(n,3)）を列挙する
    - Step 3: 合計必要時間 ≤ availableMinutes の組み合わせを絞り込む
    - Step 4: (1) PriorityScore合計降順 → (2) ユニークGoal数降順 → (3) 合計時間昇順 で最良を選定する
    - 有効な組み合わせが0件の場合は `{ recommendations: [], totalRequiredMinutes: 0, remainingMinutes: availableMinutes }` を返す
    - _Requirements: 7.1, 7.2, 7.3_
  - [x]* 4.6 Property 4・5・6 のプロパティテストを `tests/property/recommendation-engine.test.ts` に追加する
    - **Property 4: 推奨選定の時間制約不変条件** — 推奨の合計時間が availableMinutes を超えないことを検証する
    - **Property 5: 推奨選定はスコア合計最大の組み合わせを選ぶ** — すべての有効な組み合わせを全探索した結果と一致することを検証する
    - **Property 6: 完了済み Task・当日完了済み Habit は推奨候補に含まれない** — 除外済みフラグ付きの候補セットを生成し、結果に含まれないことを検証する
    - **Validates: Requirements 7.1, 7.2, 8.2, 8.3**
  - [x] 4.7 `src/lib/progress.ts` に `calcGoalProgress` と `calcRequirementProgress` を実装する
    - `calcGoalProgress(input)`: directTaskActions と requirementTaskActions を `Map<number, boolean>` で UNION DISTINCT 結合し、`Math.floor(completed/total * 100)` を返す。total=0 の場合は 0 を返す
    - `calcRequirementProgress(taskActions)`: Habit は含まず Task のみ対象。`Math.floor(completed/total * 100)` を返す。0件の場合は 0 を返す
    - _Requirements: 9.1, 9.2, 9.4, 9.5_
  - [x]* 4.8 Property 7・8 のプロパティテストを `tests/property/progress.test.ts` に実装する
    - **Property 7: Goal 進捗率の UNION DISTINCT による重複排除** — 直接リンクと GoalRequirement 経由の両方に同一 actionId が含まれる場合に1件として数えることを検証する
    - **Property 8: GoalRequirement 進捗率（Habit 除外・切り捨て）** — Habit を含む入力でも Habit が除外されること、math.floor の切り捨てが正しいことを検証する
    - **Validates: Requirements 9.1, 9.2, 9.4, 9.5**

- [x] 5. チェックポイント — コアロジックのテストをすべてパスさせる
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Goal・GoalRequirement の API エンドポイント実装
  - [x] 6.1 `src/app/api/goals/route.ts` を作成し、`GET /api/goals`（Status フィルタ対応）と `POST /api/goals` を実装する
    - GET: `?status=ACTIVE|ON_HOLD|COMPLETED` クエリを受け取り Prisma でフィルタリングして返す
    - POST: `GoalSchema` で入力検証 → Prisma で保存 → 201 レスポンス。バリデーション失敗は 400 + `ErrorResponse` 形式で返す
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.10, 10.5_
  - [x] 6.2 `src/app/api/goals/[id]/route.ts` を作成し、`GET`, `PATCH`, `DELETE /api/goals/:id` を実装する
    - GET: 進捗率（`calcGoalProgress` 呼び出し）・GoalRequirement 一覧・Habit 型 Action の実行回数・最終実行日時を含む詳細レスポンスを返す
    - PATCH: `GoalSchema.partial()` で検証 → Prisma で更新 → 200 レスポンス
    - DELETE: 削除確認はフロントエンド側で行うため API はそのまま削除（CASCADE により関連 ActionLink も削除される）
    - リソース未発見は 404 を返す
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 1.5, 1.7, 1.8, 1.9, 9.4, 9.5, 9.6_
  - [x] 6.3 `src/app/api/goals/[id]/requirements/route.ts` を作成し、`GET` と `POST /api/goals/:id/requirements` を実装する
    - GoalRequirement の一覧取得と新規作成を実装する
    - `GoalRequirementSchema` でバリデーションし、親 Goal の存在確認（404 処理）も含める
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 6.4 `src/app/api/goal-requirements/[id]/route.ts` を作成し、`GET`, `PATCH`, `DELETE /api/goal-requirements/:id` を実装する
    - GET: 進捗率（`calcRequirementProgress` 呼び出し）・Habit 型 Action の実行回数・最終実行日時を含む詳細レスポンスを返す
    - PATCH: `GoalRequirementSchema.partial()` で検証 → 更新
    - DELETE: CASCADE により関連 ActionLink も削除される
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 9.1, 9.2, 9.3_

- [x] 7. Action・ActionLink・CompletionRecord の API エンドポイント実装
  - [x] 7.1 `src/app/api/actions/route.ts` を作成し、`GET /api/actions`（status・type フィルタ対応）と `POST /api/actions` を実装する
    - GET: PriorityScore 降順ソート対応（スコアはアプリコード側で計算してレスポンスに含める）
    - POST: `ActionSchema` で入力検証 → 保存
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 10.5, 11.3_
  - [x] 7.2 `src/app/api/actions/[id]/route.ts` を作成し、`GET`, `PATCH`, `DELETE /api/actions/:id` を実装する
    - GET: ActionLink 一覧（貢献度付き）・CompletionRecord 最新 100 件を含む詳細レスポンスを返す
    - PATCH: `ActionSchema.partial()` で検証 → 更新
    - DELETE: CASCADE により関連 ActionLink・CompletionRecord も削除される
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 4.5, 8.6_
  - [x] 7.3 `src/app/api/actions/[id]/links/route.ts` を作成し、`GET` と `POST /api/actions/:id/links` を実装する
    - POST: `ActionLinkSchema` で検証 → 重複チェック（`@@unique` 制約違反は 409 + `DUPLICATE_ACTION_LINK` で返す）→ ActionLink 作成（contributionWeight 必須）
    - 存在しない Goal/GoalRequirement を指定した場合は 400 を返す
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 4.1, 4.2, 4.3, 4.3a, 4.7, 4.8_
  - [x] 7.4 `src/app/api/action-links/[id]/route.ts` を作成し、`DELETE /api/action-links/:id` を実装する
    - ActionLink 単体削除（Action 本体・Goal・GoalRequirement は削除しない）
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 4.4, 4.7_
  - [x] 7.5 `src/app/api/actions/[id]/complete/route.ts` を作成し、`POST /api/actions/:id/complete` を実装する
    - リクエストボディからタイムゾーン文字列（例: `"Asia/Tokyo"`）を受け取る
    - `X-Timezone` ヘッダーから取得する場合は `const headersList = await headers(); const tz = headersList.get('X-Timezone')` と必ず `await` すること（Next.js 15 破壊的変更）
    - `date-fns-tz` を使ってローカルタイムゾーンの当日日付範囲（todayStart〜todayEnd）を算出する
    - TASK 型: CompletionRecord が既存であれば 409 + `DUPLICATE_COMPLETION` を返す（要件8.2の恒久除外はクエリ側で実現するため、ここでは重複防止のみ）
    - HABIT 型: 同日付の CompletionRecord が既存であれば 409 + `DUPLICATE_COMPLETION` を返す（要件8.5）
    - 正常時は CompletionRecord を作成して 201 を返す
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - [x] 7.6 `src/app/api/completion-records/[id]/route.ts` を作成し、`DELETE /api/completion-records/:id` を実装する（完了取り消し）
    - CompletionRecord を削除し、当該 Action を翌回の推奨計算に戻す
    - **Next.js 15**: `params` は `Promise<{ id: string }>` として型定義し、`const { id } = await segmentData.params` で取得すること
    - _Requirements: 8.4_

- [x] 8. AvailableDailyTime と推奨算出の API エンドポイント実装
  - [x] 8.1 `src/app/api/available-daily-time/route.ts` を作成し、`GET` と `PUT /api/available-daily-time` を実装する
    - GET: `?date=YYYY-MM-DD` で当日の AvailableDailyTime を返す（未登録の場合は 404 または `null`）
    - PUT: `AvailableDailyTimeSchema` で検証 → Prisma `upsert` で `@@unique([date])` をキーに UPSERT する
    - _Requirements: 6.1, 6.2, 6.3_
  - [x]* 8.2 Property 9 のプロパティテスト（統合テスト）を `tests/property/available-daily-time.test.ts` に実装する
    - **Property 9: AvailableDailyTime の UPSERT 冪等性** — 同一日付に複数回 PUT した場合、最後の値のみが保存されることを検証する（SQLite in-memory + Prisma）
    - **Validates: Requirements 6.2**
  - [x] 8.3 `src/app/api/recommendations/route.ts` を作成し、`POST /api/recommendations` を実装する
    - `RecommendationRequestSchema` で `availableMinutes` を検証（1〜1440 の整数）
    - リクエストからタイムゾーン文字列を取得する。`X-Timezone` ヘッダーから取得する場合は `const headersList = await headers(); const tz = headersList.get('X-Timezone')` と必ず `await` すること（Next.js 15 破壊的変更）
    - `date-fns-tz` で当日日付範囲を算出する
    - StatusがActive の Action を取得し、完了済み Task・当日完了済み Habit を除外する
    - 各 Action の PriorityScore を `calcPriorityScore` で算出し、`ScoredAction[]` を構築する
    - `selectRecommendations(candidates, availableMinutes)` を呼び出して推奨を選定する
    - `generateReasonText` で推奨理由テキストを生成する（関連 Goal 数・期限・最高重要度をテンプレートで組み合わせる）
    - `RecommendationResponse` 形式でレスポンスを返す（0件時は `noResultMessage` を含む）
    - _Requirements: 5.13, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 9. チェックポイント — API エンドポイントの統合テストをパスさせる
  - [x]* 9.1 主要 API の統合テストを `tests/integration/` に実装する
    - SQLite in-memory + Prisma マイグレーションでテスト用 DB を初期化する
    - `POST /api/recommendations`: 有効な時間で最大3件返る・0件時に `noResultMessage` 返る・無効値で 400 返る
    - `POST /api/goals`: バリデーション成功・失敗のケース
    - `POST /api/actions/:id/links`: 重複登録で 409 返る
    - `POST /api/actions/:id/complete`: 同日 Habit 重複で 409 返る
    - **Validates: Requirements 1.8, 3.8, 4.3, 4.7, 7.7, 7.8, 8.5**
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. バリデーションスキーマのプロパティテスト
  - [x]* 10.1 Property 10・11 のプロパティテストを `tests/property/validation.test.ts` に実装する
    - **Property 10: タイトルバリデーション（空白文字列の拒否）** — `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` で空白のみ文字列を生成し、Goal/GoalRequirement/Action の Zod スキーマが `safeParse` でエラーを返すことを検証する
    - **Property 11: タイトルバリデーション（101文字以上の拒否）** — `fc.string({ minLength: 101 })` で101文字以上の文字列を生成し、各スキーマが reject することを検証する
    - **Validates: Requirements 1.3, 1.4, 2.4, 3.3**

- [x] 11. フロントエンド — 共通レイアウトと TanStack Query セットアップ
  - [x] 11.1 `src/app/layout.tsx` にグローバルレイアウトを実装し、TanStack Query の `QueryClientProvider` と shadcn/ui の `Toaster` を設定する
    - ナビゲーションバー（ホーム・目標一覧・行動一覧 へのリンク）を実装する
    - Tailwind CSS のグローバルスタイルを設定する
    - _Requirements: 全体_
  - [x] 11.2 共通 hooks を `src/hooks/` に作成する
    - `useGoals(status?)`, `useGoal(id)`, `useCreateGoal()`, `useUpdateGoal()`, `useDeleteGoal()` を TanStack Query で実装する
    - `useActions(status?, type?)`, `useAction(id)`, `useCreateAction()`, `useUpdateAction()`, `useDeleteAction()` を実装する
    - `useActionLinks(actionId)`, `useCreateActionLink()`, `useDeleteActionLink()` を実装する
    - `useCompleteAction()`, `useUncompleteAction()` を実装する
    - `useAvailableDailyTime(date)`, `useUpsertAvailableDailyTime()` を実装する
    - `useRecommendations()` を実装する
    - _Requirements: 全体_

- [x] 12. フロントエンド — ホーム画面（推奨行動算出）
  - [x] 12.1 `src/app/page.tsx` にホーム画面を実装する
    - 利用可能時間入力フィールド（1〜1440 の整数、当日保存済み値を自動表示）とバリデーションエラー表示を実装する
    - 「推奨を取得」ボタンのクリックで `POST /api/recommendations` を呼び出す
    - 入力値の Zod バリデーション（空欄・範囲外・小数・非数値を拒否）をフォーム送信時に実行する
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 12.2 `src/components/recommendations/RecommendationCard.tsx` を実装する
    - 推奨順位（バッジ）・タイトル・必要時間・PriorityScore・関連 Goal/GoalRequirement 一覧を表示する
    - 推奨理由テキストを表示する
    - 計算根拠（各 ActionLink の ImportanceWeight×ContributionWeight・Σ・CrossGoalBonus・UrgencyFactor・NormalizedDuration）をアコーディオン形式で表示する
    - 「完了にする」ボタンを実装し、クリックで `useCompleteAction` を呼び出す
    - _Requirements: 7.4, 7.5, 7.6, 8.1_
  - [x] 12.3 推奨結果の合計所要時間・残り時間表示と「条件を満たす行動がありません」メッセージを実装する
    - _Requirements: 7.6, 7.7_

- [x] 13. フロントエンド — 目標一覧・詳細画面
  - [x] 13.1 `src/app/goals/page.tsx` に目標一覧画面を実装する
    - Status フィルタリング（Active/On Hold/Completed/全表示）を Select コンポーネントで実装する
    - Goal カード（タイトル・重要度バッジ・Status・期限・進捗率）を一覧表示する
    - 「新規作成」ボタンと Goal 作成フォームダイアログ（タイトル・説明・重要度・期限・Status）を実装する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.10, 10.5_
  - [x] 13.2 `src/app/goals/[id]/page.tsx` に目標詳細画面を実装する
    - Goal の全フィールド表示・編集フォーム・削除ボタン（確認ダイアログ付き）を実装する
    - 進捗率（Task 型のみ対象、UNION DISTINCT 計算結果）をプログレスバーで表示する
    - Habit 型 Action の実行回数・最終実行日時を表示する
    - Status 変更セレクトを実装し、変更時に即時反映する
    - GoalRequirement 一覧（タイトル・Status・進捗率）と GoalRequirement 作成フォームを実装する
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9, 9.4, 9.5, 9.6_
  - [x] 13.3 `src/app/goals/[id]/requirements/[rid]/page.tsx` に目標要件詳細画面を実装する
    - GoalRequirement の全フィールド表示・編集フォーム・削除ボタンを実装する
    - Task 型 Action の進捗率（`calcRequirementProgress` 結果）をプログレスバーで表示する
    - Habit 型 Action の実行回数・最終実行日時を表示する
    - Status 変更セレクトを実装する
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 9.1, 9.2, 9.3_

- [x] 14. フロントエンド — 行動一覧・詳細画面
  - [x] 14.1 `src/app/actions/page.tsx` に行動一覧画面を実装する
    - Status フィルタ・ActionType フィルタ（Task/Habit）を実装する
    - PriorityScore 降順で表示し、Action カード（タイトル・ActionType バッジ・Status・必要時間・PriorityScore・期限）を一覧表示する
    - 「完了にする」ボタンを各カードに実装する（手動選択: 要件11）
    - 「新規作成」ボタンと Action 作成フォームダイアログ（タイトル・説明・必要時間・期限・ActionType・Status）を実装する
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 10.5, 11.1, 11.2, 11.3_
  - [x] 14.2 `src/app/actions/[id]/page.tsx` に行動詳細画面を実装する
    - Action の全フィールド表示・編集フォーム・削除ボタンを実装する
    - Status 変更セレクトを実装する
    - ActionLink 一覧（関連 Goal/GoalRequirement・貢献度）を表示し、ActionLink 追加モーダルと削除ボタンを実装する
    - ActionLink 追加モーダル: Goal/GoalRequirement のセレクト・貢献度セレクト（必須）・作成ボタン。重複登録エラー・存在しないリソースエラーを Toast で表示する
    - CompletionRecord 一覧（完了日時、最新100件、新しい順）と「完了を取り消す」ボタンを実装する
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.3a, 4.4, 4.5, 4.7, 4.8, 8.4, 8.6_

- [x] 15. 最終チェックポイント — 全テストのパスと動作確認
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- `*` のついたサブタスクはオプション。MVP を優先する場合はスキップ可能
- 各タスクは設計文書（design.md）の対応するインターフェース・擬似コードを参照して実装すること
- RecommendationEngine は純粋関数として実装し、DB アクセスを含めないこと（テスト容易性のため）
- タイムゾーン処理は `date-fns-tz` を使用し、クライアントからタイムゾーン文字列を受け取って Route Handler 側で変換する
- `AvailableDailyTime.date` は "YYYY-MM-DD" 形式の文字列として保存する
- PBT は `fast-check` の `fc.assert(fc.property(...), { numRuns: 100 })` 形式で実装し、各テストにタグコメントを付ける
- 係数・閾値の変更が必要な場合は `src/lib/scoring-config.ts` のみを編集すること

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "4.5"] },
    { "id": 6, "tasks": ["4.6", "4.7"] },
    { "id": 7, "tasks": ["4.8", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4", "7.1"] },
    { "id": 10, "tasks": ["7.2", "7.3"] },
    { "id": 11, "tasks": ["7.4", "7.5"] },
    { "id": 12, "tasks": ["7.6", "8.1"] },
    { "id": 13, "tasks": ["8.2", "8.3"] },
    { "id": 14, "tasks": ["9.1", "10.1"] },
    { "id": 15, "tasks": ["11.1", "11.2"] },
    { "id": 16, "tasks": ["12.1"] },
    { "id": 17, "tasks": ["12.2", "13.1"] },
    { "id": 18, "tasks": ["12.3", "13.2", "14.1"] },
    { "id": 19, "tasks": ["13.3", "14.2"] }
  ]
}
```
