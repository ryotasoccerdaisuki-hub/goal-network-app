# Goal Network App

複数の人生目標（Goal）と日々の行動（Action）を関連付け、限られた時間の中で最も効果的な行動を毎日最大3件提案する、シングルユーザー向けの Web アプリケーションです。認証機能は持たず、ローカルまたは単一テナント環境での利用を前提としています。

Kiro University Challenge の提出作品として、Kiro の Spec 駆動開発ワークフローで要件定義・設計・実装・テストを進めました。

---

## 1. 概要

目標を単に一覧管理するのではなく、各目標の達成に必要な要件（GoalRequirement）を整理し、複数の目標に共通して貢献する行動を見つけ出し、「今日やるべき行動」をシステムが提案することが中心的な価値です。

## 2. 解決する課題

複数の目標を同時に追いかけるとき、「今日、限られた時間で何をすれば最も効果的か」の判断は難しくなります。本アプリは、目標の重要度・期限の緊急度・複数目標への貢献度・所要時間を数値化した PriorityScore を自動算出し、利用可能時間に収まる最適な行動の組み合わせを提示することで、この判断を支援します。

## 3. 主な機能

- **Goal・GoalRequirement・Action の管理**: 登録・編集・削除・Status 管理（Active / On Hold / Completed）。Active 以外は推薦計算から除外されます。
- **1つの Action と複数目標の関連付け**: ActionLink により 1 つの Action を複数の Goal / GoalRequirement に紐づけ、関連ごとに貢献度（高・中・低）を設定できます。
- **利用可能時間内で最大3件を推薦**: 当日使える時間（分）を入力すると、PriorityScore と時間制約に基づいて最大 3 件の行動の組み合わせを提案します。各推薦には推薦理由テキストと計算根拠が表示されます。
- **Task と Habit の完了管理**: Task は完了すると以降の推薦候補から恒久的に除外され、Habit は当日のみ除外され翌日以降に復活します（同日重複登録は不可）。
- **進捗率の表示**: Goal・GoalRequirement の進捗率を Task 型 Action のみを対象に算出（Habit は分母・分子から除外）。Goal の進捗率は直接リンクと GoalRequirement 経由を重複排除して合算します。

## 4. 推薦スコアの考え方

PriorityScore は次の式で算出します。

```
PriorityScore = Σ(ImportanceWeight × ContributionWeight) × CrossGoalBonus × UrgencyFactor ÷ NormalizedDuration
```

- **ImportanceWeight**: 関連 Goal の重要度（高=3 / 中=2 / 低=1）
- **ContributionWeight**: ActionLink の貢献度（高=3 / 中=2 / 低=1）
- **CrossGoalBonus**: 貢献する Active Goal 数（1=1.0 / 2=1.1 / 3以上=1.2）。二重計上を避けるため小さなボーナス
- **UrgencyFactor**: 期限切れ=3.0 / 0〜7日=2.0 / 8〜30日=1.5 / 期限なし=1.0
- **NormalizedDuration**: `max(1, requiredMinutes / 30)`

Active な Goal に関連しない Action のスコアは 0 とします。推薦の選定は、候補を PriorityScore 降順で最大 10 件に絞り、合計時間が利用可能時間以内となる最大 3 件の組み合わせから、(1) スコア合計最大 →(2) ユニーク Goal 数最大 →(3) 合計時間最短 の順で最良を選びます。

係数・閾値はすべて `src/lib/scoring-config.ts` の `SCORING_CONFIG` に集約しており、1 か所の変更で全体に反映されます。

## 5. 技術スタック

| レイヤー | 採用技術 |
|---------|---------|
| フレームワーク | Next.js 15（App Router）+ TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| サーバー状態管理 | TanStack Query v5 |
| ORM | Prisma v6（`prisma-client` ジェネレーター） |
| データベース | SQLite（ローカル実行・デモ用途） |
| バリデーション | Zod v4（フロント・バック共有） |
| テスト | Vitest + fast-check |
| 日付・タイムゾーン | date-fns + date-fns-tz |

RecommendationEngine（`src/lib/recommendation-engine.ts`）と進捗率算出（`src/lib/progress.ts`）は DB アクセスを含まない純粋関数として実装し、Route Handler 側で取得したデータを引数として渡す設計です。これによりモックなしでプロパティベーステストが可能になっています。

## 6. セットアップ・起動方法

> この環境では PowerShell の実行ポリシーにより `npm` ラッパー経由の実行が失敗する場合があります。その際は `npm.cmd` / `npx.cmd` を使用してください。

```bash
# 依存パッケージのインストール
npm install

# Prisma Client 生成と初回マイグレーション（prisma/dev.db を作成）
npx prisma migrate dev --name init

# 開発サーバー起動
npm run dev
```

起動後、ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

本番ビルド:

```bash
npm run build
npm run start
```

SQLite の接続先は `src/lib/prisma.ts` で `process.cwd()` を基準に `prisma/dev.db` の絶対パスへ解決しているため、実行時の作業ディレクトリに依存せず常にプロジェクト直下の DB を参照します。

## 7. テスト方法と実績

```bash
# 全テスト（1回実行）
npx vitest run

# プロパティテストのみ
npx vitest run tests/property

# 統合テストのみ
npx vitest run tests/integration
```

テストは **全 33 件が成功** しています。内訳は次のとおりです。

- **プロパティベーステスト**: `tests/property/`
  - `recommendation-engine.test.ts`（Property 1〜6: PriorityScore・UrgencyFactor・CrossGoalBonus・推薦選定）
  - `progress.test.ts`（Property 7・8: 進捗率の重複排除と切り捨て）
  - `available-daily-time.test.ts`（Property 9: UPSERT 冪等性、SQLite + Prisma）
  - `validation.test.ts`（Property 10・11: タイトルの空白・文字数バリデーション）
- **統合テスト**: `tests/integration/api.test.ts`（Route Handler + 一時ファイル SQLite で、Goal 作成・ActionLink 重複 409・Habit 重複完了 409・推薦の正常/0件/400 を検証）

各プロパティテストは `fast-check` で最低 100 回（Property 1 は 200 回）実行し、タグコメント（例: `// Feature: goal-network-app, Property 1: ...`）を付与しています。lint・build もあわせて成功しています。

## 8. Kiro University 7レッスンの活用

本プロジェクトでは Kiro University の各レッスンの機能を実際に使って開発しました。

- **Lesson 1: Specs** — `.kiro/specs/goal-network-app/` に requirements.md・design.md・tasks.md を作成し、要件→設計→タスクの順で Spec 駆動開発を実施。tasks.md のタスク 1〜15 を順に実装・検証しました。
- **Lesson 2: Steering** — `.kiro/steering/` の product.md（プロダクト概要）・tech.md（技術スタックと規約）・structure.md（ディレクトリ構造）を常時適用し、実装方針を一貫させました。
- **Lesson 3: Hooks** — `.kiro/hooks/lint-on-save.json` に TypeScript ファイル保存時 ESLint 自動実行フックを定義しました。
- **Lesson 4: Property-based testing** — `fast-check` で推薦ロジック・進捗率・バリデーション・UPSERT を網羅する Property 1〜11 を実装し、Challenge の PBT 実績としました。
- **Lesson 5: Powers（Context7）** — Next.js 15 / Prisma v6 / Zod v4 の最新仕様（`prisma-client` ジェネレーター、`z.iso.date()` など）を Context7 Power で確認し、バージョンに適合した実装にしました。
- **Lesson 6: MCP（Fetch）** — `.kiro/settings/mcp.json` に Fetch MCP サーバー（`mcp-server-fetch`）を設定し、公式ドキュメントの参照に利用しました。
- **Lesson 7: Custom Agent** — `.kiro/agents/learning-implementation-coach.json` に、完成コードを先に渡さず対話とヒントで実装を進める学習コーチエージェントを定義しました（fs_write を確認付きに制限、shell を禁止、Context7・Fetch を参照可能に設定）。

## 9. リポジトリ内の関連ファイル

| 種別 | パス |
|------|------|
| 要件定義 | `.kiro/specs/goal-network-app/requirements.md` |
| 技術設計 | `.kiro/specs/goal-network-app/design.md` |
| タスクリスト | `.kiro/specs/goal-network-app/tasks.md` |
| Steering | `.kiro/steering/product.md`, `tech.md`, `structure.md` |
| Hook | `.kiro/hooks/lint-on-save.json` |
| Custom Agent | `.kiro/agents/learning-implementation-coach.json` |
| MCP 設定 | `.kiro/settings/mcp.json` |
| スコア係数 | `src/lib/scoring-config.ts` |
| 推薦エンジン（純粋関数） | `src/lib/recommendation-engine.ts` |
| 進捗率算出（純粋関数） | `src/lib/progress.ts` |
| 共有 Zod スキーマ | `src/schemas/index.ts` |
| Prisma スキーマ | `prisma/schema.prisma` |
| Prisma クライアント | `src/lib/prisma.ts` |
| API Route Handlers | `src/app/api/` |
| 画面 | `src/app/page.tsx`, `src/app/goals/`, `src/app/actions/` |
| テスト | `tests/property/`, `tests/integration/` |

## 10. 今後の改善案

- 公開運用に向けた SQLite から PostgreSQL 等のサーバー DB への移行（Prisma のため `datasource` 変更とマイグレーション再実行で対応可能）
- 複数ユーザー対応と認証機能の追加
- スコア係数の管理画面・環境変数からの動的変更（現状は `scoring-config.ts` の直接編集）
- 推薦結果や進捗の履歴可視化・ダッシュボード
- 統合テストのカバレッジ拡大（PATCH / DELETE 系エンドポイントや CASCADE 削除の検証）
