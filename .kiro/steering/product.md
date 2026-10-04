---
inclusion: always
---

# Goal Network App — Product Overview

## アプリの目的

Goal Network App は、複数の人生目標（Goal）と日々の行動（Action）を関連付け、限られた時間の中で最も効果的な行動を毎日最大3件提案するシングルユーザー向け Web アプリケーションである。

ユーザーが登録した目標を単に管理するのではなく、各目標の達成に必要な要件を整理し、複数の目標に共通して貢献する行動を見つけ、今日実行すべき行動をシステムが提案することが核心的な価値である。

## 対象ユーザー

- 認証なし・シングルユーザー
- ローカルまたは単一テナント環境での使用を前提とする

## 主要概念（用語）

| 用語 | 説明 |
|------|------|
| **Goal** | ユーザーが達成を目指す人生上の目標（例：転職、技術力の向上） |
| **GoalRequirement** | Goal を達成するために必要な中間成果物や条件 |
| **Action** | ユーザーが実行できる具体的な行動 |
| **ActionLink** | Action と Goal/GoalRequirement を結ぶ多対多関係。**貢献度（高/中/低）を持つ** |
| **ActionType** | Task（一度きり完了）または Habit（毎日繰り返し）の2種別 |
| **Status** | Active / On Hold / Completed の3状態。Active 以外は推奨計算から除外される |
| **PriorityScore** | 重要度・緊急度・貢献度・効率性を基に算出する優先度スコア |
| **CompletionRecord** | Action の完了日時を記録するデータ |
| **AvailableDailyTime** | ユーザーが当日使える時間（分単位）。当日日付でDB保存・UPSERT |

## MVP 機能範囲

1. Goal の登録・編集・削除・Status 管理
2. GoalRequirement の登録・編集・削除・Status 管理
3. Action の登録・編集・削除（Task/Habit 種別付き）・Status 管理
4. ActionLink（貢献度付き）で Action と Goal/GoalRequirement を多対多関連付け
5. PriorityScore 自動算出（重要度・緊急度・貢献Goal数・必要時間を考慮）
6. 利用可能時間入力（当日日付でDB保存、再訪時に自動表示）
7. 推奨行動を最大3件表示（合計時間制約・組み合わせ最適化・推奨理由テキスト・計算根拠）
8. 完了記録（Task は恒久除外、Habit は当日除外・翌日復活）
9. Goal・GoalRequirement の進捗率表示（Task 型のみ対象・重複排除）
10. ユーザーによる推奨外 Action の手動選択・完了記録

## PriorityScore 計算式

```
PriorityScore = Σ(ImportanceWeight × ContributionWeight) × CrossGoalBonus × UrgencyFactor ÷ NormalizedDuration
```

- **ImportanceWeight**: 関連 Goal の重要度（高=3, 中=2, 低=1）
- **ContributionWeight**: ActionLink の貢献度（高=3, 中=2, 低=1）
- **CrossGoalBonus**: Active Goal 数（1=1.0, 2=1.1, 3以上=1.2）。二重計上防止のため小さなボーナス
- **UrgencyFactor**: 期限切れ=3.0 / 0〜7日=2.0 / 8〜30日=1.5 / 期限なし=1.0
- **NormalizedDuration**: max(1, requiredMinutes / 30)

## 推奨選定ロジック

1. Active かつ除外対象外（完了済み Task・当日完了済み Habit）の候補を PriorityScore 降順で最大10件に絞り込む
2. 上位10件から「合計時間 ≤ 利用可能時間」となる最大3件の組み合わせを比較
3. 評価優先順: (1) スコア合計最大 → (2) ユニーク Goal 数最大 → (3) 合計時間最短

## Goal 進捗率のルール

- **Goal 進捗率**: (a) Goal に直接リンクされた Task + (b) 配下 GoalRequirement にリンクされた Task を **重複なし合算**し、完了数÷総数×100（切り捨て）
- **GoalRequirement 進捗率**: 直接リンクされた Task のみ対象
- **Habit 型 Action**: 進捗率の分母・分子に含めない。実行回数と最終実行日時を別表示

## Task と Habit の完了ルール

| 種別 | 完了後の挙動 |
|------|------------|
| Task | 完了後は推奨候補から**恒久的**に除外 |
| Habit | 当日は推奨候補から除外、翌日以降は復活。同日重複登録不可 |

## 推奨結果の表示項目

推奨順位・必要時間・PriorityScore・関連 Goal 一覧・関連 GoalRequirement 一覧・推奨理由テキスト（テンプレート生成）・計算根拠（各 ActionLink の ImportanceWeight×ContributionWeight の個別値・Σ合計・CrossGoalBonus・UrgencyFactor・NormalizedDuration）
