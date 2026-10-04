# Requirements Document

## Introduction

Goal Network App は、複数の人生目標と日々の行動を関連付け、限られた時間の中で複数の目標に同時に貢献できる行動を毎日最大3件提案するWebアプリケーションである。ユーザーは目標・目標要件・行動を登録し、その相互関係と優先度スコアに基づいた推奨行動を受け取ることで、効率的に目標達成を前進させることができる。

本アプリはシングルユーザー向けであり、認証機能は持たない。単一のユーザーがローカルまたは単一テナント環境で使用することを前提とする。

## Glossary

- **Goal（目標）**: ユーザーが達成を目指す人生上の目標（例：転職、技術力の向上）
- **GoalRequirement（目標要件）**: Goalを達成するために必要な中間成果物や条件（例：ポートフォリオを完成させる）
- **Action（行動）**: ユーザーが実行できる具体的な行動（例：Webアプリを開発する）
- **ActionType（行動種別）**: ActionがTaskまたはHabitのいずれであるかを示す種別
- **Task（タスク）**: 一度だけ実行することを想定した行動。完了後は推奨候補から恒久的に除外される
- **Habit（習慣）**: 繰り返し実行することを想定した行動。当日完了済みの場合はその日の推奨候補から除外されるが、翌日以降は再び候補に含まれる
- **Status（状態）**: Goal・GoalRequirement・Actionが持つ「Active（有効）・On Hold（保留）・Completed（完了）」の3種類の状態。デフォルトはActive
- **ActionLink（行動リンク）**: ActionとGoalまたはGoalRequirementを紐づける関連（多対多関係）
- **PriorityScore（優先度スコア）**: 重要度・緊急度・複数目標への貢献度・効率性を基にRecommendationEngineが算出する数値
- **ImportanceWeight（重要度ウェイト）**: GoalのImportanceに対応する数値（高=3、中=2、低=1）
- **ContributionWeight（貢献度ウェイト）**: ActionLinkがGoalまたはGoalRequirementに対して持つ貢献の強さを示す数値（高=3、中=2、低=1）。ActionLink作成時にユーザーが設定する
- **CrossGoalBonus（複数目標ボーナス）**: ActionがカバーするユニークなGoal数に応じた小さなボーナス係数（1Goal=1.0、2Goals=1.1、3Goals以上=1.2）。二重計上を避けるため小さな値に設定する
- **UrgencyFactor（緊急度係数）**: Actionの期限までの残日数に応じた係数（7日以内=2.0、8〜30日=1.5、31日以上または期限なし=1.0）
- **NormalizedDuration（正規化所要時間）**: 30分を基準に正規化したActionの必要時間。`max(1, requiredMinutes / 30)`
- **AvailableDailyTime（当日利用可能時間）**: ユーザーが当日使える時間（分単位）。ユーザーのローカルタイムゾーン基準の日付と紐づけてDBに保存される
- **Recommendation（推奨行動）**: 優先度スコアと利用可能時間に基づいてRecommendationEngineが選定した最大3件の行動
- **CompletionRecord（完了記録）**: Actionの実施完了を記録するデータ（完了日時を含む）
- **System**: Goal Network App 全体
- **RecommendationEngine**: PriorityScoreを算出し推奨行動を選定するコンポーネント

---

## Requirements

### 要件1: 目標の管理

**ユーザーストーリー:** 開発者・社会人ユーザーとして、人生目標を登録・編集・削除・状態管理できるようにしたい。そうすることで、達成したい目標を一元管理できる。

#### 受入条件

1. THE System SHALL 各Goalに対して、タイトル（最大100文字・必須）・説明（最大1,000文字・任意）・重要度（高・中・低の3段階・必須）・期限（日付形式・任意）・Status（Active/On Hold/Completed・必須・デフォルトActive）を保持する。
2. WHEN ユーザーがGoalの登録フォームを送信するとき、THE System SHALL 入力値を検証し、検証に成功した場合に新しいGoalを保存してGoal一覧に反映する。
3. IF タイトルが空の状態でGoalの登録フォームが送信されたとき、THEN THE System SHALL タイトルが必須であることを示すバリデーションエラーメッセージをタイトル入力欄に表示し、保存を中断する。
4. IF タイトルが101文字以上の状態でGoalの登録フォームまたは編集フォームが送信されたとき、THEN THE System SHALL タイトルの文字数上限を示すバリデーションエラーメッセージをタイトル入力欄に表示し、保存を中断する。
5. WHEN ユーザーが既存のGoalを編集するとき、THE System SHALL 変更内容を保存し、編集完了を示すメッセージをユーザーに表示する。
6. WHEN ユーザーがGoalを削除するとき、THE System SHALL 削除前に確認ダイアログを表示する。
7. WHEN ユーザーがGoalの削除を確認するとき、THE System SHALL 該当GoalおよびGoalに関連するすべてのActionLinkを削除する。
8. IF GoalまたはActionLinkの保存・削除操作中にシステムエラーが発生したとき、THEN THE System SHALL 操作失敗を示すエラーメッセージを表示し、操作前のデータを維持する。
9. WHEN ユーザーがGoalのStatusを変更するとき、THE System SHALL 変更後のStatusを保存し、RecommendationEngineによる推奨計算への反映を即時に行う。
10. THE System SHALL Goal一覧画面でStatusによるフィルタリング機能を提供する。

---

### 要件2: 目標要件（中間成果）の管理

**ユーザーストーリー:** 開発者・社会人ユーザーとして、各目標に対して達成に必要な中間成果物や条件を登録・編集・削除・状態管理できるようにしたい。そうすることで、目標達成に向けた具体的なステップを整理できる。

#### 受入条件

1. THE System SHALL 各GoalRequirementをいずれか1つのGoalに紐づけて保持する。
2. THE System SHALL 各GoalRequirementに対してタイトル（必須、最大100文字）・説明（任意、最大500文字）・Status（Active/On Hold/Completed・必須・デフォルトActive）を保持する。
3. WHEN ユーザーがGoalRequirementの登録フォームを送信するとき、THE System SHALL タイトルが1文字以上100文字以下であることを検証し、検証が通った場合に新しいGoalRequirementを保存する。
4. IF タイトルが空の状態でGoalRequirementの登録フォームが送信されたとき、THEN THE System SHALL バリデーションエラーメッセージを表示し、保存を中断する。
5. WHEN ユーザーがGoalRequirementの編集フォームを送信するとき、THE System SHALL タイトルが1文字以上100文字以下であることを検証し、検証が通った場合に変更内容を保存する。
6. IF タイトルが空の状態でGoalRequirementの編集フォームが送信されたとき、THEN THE System SHALL バリデーションエラーメッセージを表示し、変更内容の保存を中断する。
7. WHEN ユーザーがGoalRequirementを削除するとき、THE System SHALL 該当GoalRequirementおよびそれに関連するすべてのActionLinkを削除する。
8. WHEN ユーザーがGoalRequirementのStatusを変更するとき、THE System SHALL 変更後のStatusを保存し、RecommendationEngineによる推奨計算への反映を即時に行う。
9. THE System SHALL GoalRequirement一覧画面でStatusによるフィルタリング機能を提供する。

---

### 要件3: 行動の管理

**ユーザーストーリー:** 開発者・社会人ユーザーとして、具体的な行動を登録・編集・削除・状態管理できるようにしたい。そうすることで、目標達成に向けた日々の行動を一元管理できる。

#### 受入条件

1. THE System SHALL 各Actionに対してタイトル（必須、最大100文字）・説明（任意、最大1,000文字）・必要時間（必須、1以上1440以下の整数、分単位）・期限（任意、年月日形式）・ActionType（Task/Habit・必須）・Status（Active/On Hold/Completed・必須・デフォルトActive）を保持する。
2. WHEN ユーザーがActionの登録フォームを送信するとき、THE System SHALL タイトルが1文字以上100文字以下かつ必要時間が1以上1440以下の整数かつActionTypeが選択済みであることを検証し、検証が通った場合に新しいActionを保存する。
3. IF タイトルが空、または必要時間が1未満もしくは1440超の整数でない値、またはActionTypeが未選択でActionの登録フォームが送信されたとき、THEN THE System SHALL 該当フィールドのバリデーションエラーメッセージを表示し、保存を中断する。
4. WHEN ユーザーがActionの編集フォームを送信するとき、THE System SHALL タイトル・必要時間・ActionTypeを登録時と同じ検証規則で検証し、検証が通った場合に変更内容を保存する。
5. IF タイトルが空、または必要時間が1未満もしくは1440超の整数でない値、またはActionTypeが未選択でActionの編集フォームが送信されたとき、THEN THE System SHALL 該当フィールドのバリデーションエラーメッセージを表示し、変更内容の保存を中断する。
6. WHEN ユーザーがActionを削除するとき、THE System SHALL 該当Actionおよびすべての関連ActionLinkとCompletionRecordを削除する。
7. WHEN ユーザーがActionのStatusを変更するとき、THE System SHALL 変更後のStatusを保存し、RecommendationEngineによる推奨計算への反映を即時に行う。
8. THE System SHALL Action一覧画面でStatusおよびActionType（Task/Habit）によるフィルタリング機能を提供する。

---

### 要件4: 行動と目標・目標要件の関連付け

**ユーザーストーリー:** 開発者・社会人ユーザーとして、1つの行動を複数の目標または目標要件に関連付けられるようにしたい。そうすることで、行動の波及効果をシステムに認識させ、優先度算出に活用できる。

#### 受入条件

1. THE System SHALL 1つのActionを0個以上のGoalおよびGoalRequirementに関連付けるActionLinkを保持する。
2. WHEN ユーザーがActionに対してGoalまたはGoalRequirementを関連付ける操作を行うとき、THE System SHALL ActionLinkを作成し、貢献度（高・中・低）を必須フィールドとして保存する。
3. IF 同一のActionとGoal（またはGoalRequirement）の組み合わせのActionLinkがすでに存在するとき、THEN THE System SHALL 重複登録を防ぎエラーメッセージを表示する。
3a. IF 貢献度が未選択の状態でActionLinkの作成が試みられたとき、THEN THE System SHALL 貢献度が必須であることを示すバリデーションエラーメッセージを表示し、保存を中断する。
4. WHEN ユーザーがActionLinkを削除するとき、THE System SHALL 該当のActionLinkのみを削除し、Action本体・Goal・GoalRequirementは削除しない。
5. WHEN ユーザーがActionの詳細を表示するとき、THE System SHALL そのActionに関連付けられているGoalおよびGoalRequirementの一覧を、各ActionLinkに設定された貢献度とともに表示する。
6. THE RecommendationEngine SHALL CrossGoalBonusの算出に用いるGoal数を、ActionLinkで関連付けられた関連先のうち StatusがActiveのGoal（GoalRequirementを経由するGoalを含む）の重複なし件数として数える。StatusがActive以外のGoalは、CrossGoalBonusのGoal数に含めない。
7. IF ActionLink作成または削除操作中にシステムエラーが発生したとき、THEN THE System SHALL 操作失敗を示すエラーメッセージを表示し、操作前の状態を維持する。
8. IF 存在しないGoalまたはGoalRequirementを指定してActionLinkの作成が試みられたとき、THEN THE System SHALL 対象が存在しない旨のバリデーションエラーメッセージを表示し、保存を中断する。

---

### 要件5: 優先度スコアの算出

**ユーザーストーリー:** 開発者・社会人ユーザーとして、行動の優先度がシステムによって自動的に算出されるようにしたい。そうすることで、複数目標への貢献度・緊急度・効率性を考慮した客観的な優先順位を把握できる。

#### 受入条件

1. THE RecommendationEngine SHALL 各ActionのPriorityScoreを以下の式に従って算出する。
   - `PriorityScore = Σ(ImportanceWeight × ContributionWeight) × CrossGoalBonus × UrgencyFactor ÷ NormalizedDuration`
   - `NormalizedDuration = max(1, requiredMinutes / 30)`
   - ここでΣはActionに関連付けられたすべてのGoalおよびGoalRequirementに対して計算する

2. THE RecommendationEngine SHALL 各ActionLinkに設定されたContributionWeight（高=3、中=2、低=1）と、そのActionLinkが指すGoalのImportanceWeight（高=3、中=2、低=1）を乗算して各関連先のスコアを算出し、すべての関連先の値を合算してΣImportanceWeight × ContributionWeightを求める。

3. IF ActionにGoalRequirementが関連付けられている場合、THEN THE RecommendationEngine SHALL そのGoalRequirementが属するGoalのImportanceWeightと、そのActionLinkのContributionWeightを乗算してΣへ加算する。

4. THE RecommendationEngine SHALL Actionが貢献するユニークなGoal数（GoalRequirementを経由するGoalも含め、直接・間接を合算した重複なし件数）に応じてCrossGoalBonusを適用する（1Goal=1.0、2Goals=1.1、3Goals以上=1.2）。

5. IF ActionにDeadlineが設定されており現在日付から0日（当日）〜7日以内である場合、THEN THE RecommendationEngine SHALL UrgencyFactorを2.0として適用する。

6. IF ActionにDeadlineが設定されており現在日付から8日以上30日以内である場合、THEN THE RecommendationEngine SHALL UrgencyFactorを1.5として適用する。

7. IF ActionにDeadlineが設定されておらず期限が存在しない場合、THEN THE RecommendationEngine SHALL UrgencyFactorを1.0として適用する。

8. IF ActionにDeadlineが設定されており現在日付よりも過去（期限切れ）である場合、THEN THE RecommendationEngine SHALL UrgencyFactorを3.0として適用する（最優先で対処すべき期限切れタスクとして扱う）。

9. IF ActionにStatusがActive以外のGoalのみが関連付けられている場合、またはGoalが1件も関連付けられていない場合、THEN THE RecommendationEngine SHALL PriorityScoreを0とする。

10. WHEN PriorityScoreの算出が完了した場合、THE RecommendationEngine SHALL 算出結果を0.0以上の小数値（小数点第2位まで）として格納する。

11. THE RecommendationEngine SHALL 以下の計算根拠を推奨結果から参照できる形で保持する。
    - 各ActionLinkのImportanceWeight × ContributionWeightの個別値
    - Σ(ImportanceWeight × ContributionWeight)の合計値
    - 貢献するユニークGoal数およびCrossGoalBonus
    - UrgencyFactor
    - NormalizedDuration
    - 算出されたPriorityScore

12. THE System SHALL UrgencyFactorの閾値（7日・30日）・係数値（期限切れ=3.0、7日以内=2.0、8〜30日=1.5、期限なし=1.0）・CrossGoalBonusの係数値（1Goal=1.0、2Goals=1.1、3Goals以上=1.2）・NormalizedDurationの基準時間（30分）を設定ファイルまたは定数として定義し、後から変更可能な形で管理する。

13. THE RecommendationEngine SHALL PriorityScoreをActionの推奨候補ソートおよび組み合わせ選定の両方に使用する。

---

### 要件6: 利用可能時間の入力と保存

**ユーザーストーリー:** 開発者・社会人ユーザーとして、今日使える時間を入力・保存できるようにしたい。そうすることで、その時間に収まる推奨行動を受け取ることができる。

#### 受入条件

1. THE System SHALL ユーザーが利用可能時間を1以上1440以下の整数（分単位）で入力できるフィールドを提供する。
2. WHEN ユーザーが有効な利用可能時間を入力して保存するとき、THE System SHALL その値をユーザーのローカルタイムゾーン基準の当日日付と紐づけてDBに保存し、同日に既存値がある場合は上書き更新する。
3. WHEN ユーザーが推奨算出ページを開くとき、THE System SHALL 当日の保存済みAvailableDailyTimeがある場合はその値を入力フィールドに自動表示する。
4. IF 利用可能時間に1未満・1440超・小数値・非数値が入力されたとき、THEN THE System SHALL 有効範囲（1〜1440分）を示すバリデーションエラーメッセージを表示し、推奨行動の算出を中断する。
5. IF 利用可能時間が空欄のまま推奨算出が実行されたとき、THEN THE System SHALL 利用可能時間の入力が必須であることを示すバリデーションエラーメッセージを表示し、算出を中断する。
6. WHEN ユーザーが有効な利用可能時間を入力して推奨算出を実行するとき、THE System SHALL その利用可能時間（分単位の整数）をRecommendationEngineに渡す。

---

### 要件7: 推奨行動の表示

**ユーザーストーリー:** 開発者・社会人ユーザーとして、今日実行すべき行動を最大3件受け取りたい。そうすることで、限られた時間の中で最も効果的な行動の組み合わせを選択できる。

#### 受入条件

1. WHEN ユーザーが有効な利用可能時間を入力して推奨算出を実行するとき、THE RecommendationEngine SHALL StatusがActiveのActionのうち、当日の推奨候補から除外すべき条件（完了済みTask・当日完了済みHabit）を除いた候補をPriorityScore降順で最大10件に絞り込む。
2. THE RecommendationEngine SHALL 絞り込んだ最大10件の候補から、合計必要時間が利用可能時間以内となる最大3件の組み合わせを列挙し、以下の優先順位で最良の組み合わせを選定する。
   - (1) 組み合わせのPriorityScore合計が最大
   - (2) 同スコアの場合、貢献するユニークGoal数が最大
   - (3) さらに同条件の場合、合計必要時間が最短
3. IF PriorityScoreが同値のActionが複数存在し組み合わせの優先度が同等のとき、THEN THE RecommendationEngine SHALL 残日数が少ない（期限が近い）Actionを優先する。
4. WHEN 推奨Actionが選定されたとき、THE System SHALL 各推奨Actionに対して推奨順位（1〜3位）・必要時間・PriorityScore・関連Goal一覧・関連GoalRequirement一覧・推奨理由テキスト・計算根拠（各ActionLinkのImportanceWeight×ContributionWeightの個別値・Σ合計・CrossGoalBonus・UrgencyFactor・NormalizedDuration・PriorityScore）を表示する。
5. THE System SHALL 推奨理由テキストに、関連する目標の一覧・関連する目標要件の一覧・優先された主な理由（例：「3つの目標に貢献」「期限まで5日」「重要度：高」）をテンプレートに基づき自動生成して表示する。
6. THE System SHALL 推奨行動の合計所要時間と入力された利用可能時間の残り時間を表示する。
7. IF 利用可能時間以内に完了できる有効な未選定Actionが0件のとき、THEN THE System SHALL 「条件を満たす行動がありません」というメッセージを表示する。
8. IF 利用可能時間が有効範囲外または非整数のとき、THEN THE System SHALL バリデーションエラーメッセージを表示し推奨算出を中断する（要件6の受入条件4・5と連動）。

---

### 要件8: 行動の完了記録

**ユーザーストーリー:** 開発者・社会人ユーザーとして、行動をActionTypeに応じた方式で完了記録できるようにしたい。そうすることで、TaskとHabitそれぞれの実施状況を適切にトラッキングできる。

#### 受入条件

1. WHEN ユーザーが推奨Action一覧または行動一覧でActionを完了としてマークするとき、THE System SHALL ユーザーのローカルタイムゾーンに基づく完了日時を含むCompletionRecordを作成し保存する。
2. IF ActionのActionTypeがTaskである場合、THEN THE System SHALL 完了後にそのActionを推奨候補から恒久的に除外する（当日・翌日以降ともに除外）。
3. IF ActionのActionTypeがHabitである場合、THEN THE System SHALL 完了済みのActionを当日の推奨候補から除外し、翌日以降は再び推奨候補に含める。
4. WHEN ユーザーがActionの完了を取り消すとき、THE System SHALL 該当のCompletionRecordを削除し、そのActionを当日の推奨候補に戻す。
5. IF 同一のHabit ActionTypeのActionに対して同一日付（ユーザーのローカルタイムゾーン基準）のCompletionRecordがすでに存在するとき、THEN THE System SHALL 重複登録を防ぎ、その旨を示すエラーメッセージをユーザーに表示する。
6. WHEN ユーザーがActionの詳細を開くとき、THE System SHALL そのActionに対するCompletionRecordを完了日時の新しい順で最大100件まで一覧表示する。

---

### 要件9: 進捗の反映

**ユーザーストーリー:** 開発者・社会人ユーザーとして、行動の完了状況が目標と目標要件の進捗に反映されるようにしたい。そうすることで、目標達成に向けた進み具合を把握できる。

#### 受入条件

1. WHEN ユーザーがGoalRequirementの詳細を表示するとき、THE System SHALL そのGoalRequirementに対してActionLinkで関連付けられたActionのうちActionTypeがTaskのものを対象として、完了済み件数 ÷ 総件数 × 100（小数点以下切り捨て、整数%）を進捗率として算出し表示する。

2. THE System SHALL GoalRequirementの進捗率の算出において、ActionTypeがHabitのActionを分母・分子の両方から除外する（Habit型Actionは進捗率に含めない）。

3. WHEN ユーザーがGoalRequirementの詳細を表示するとき、THE System SHALL 関連するHabit型Actionについては進捗率とは別に、実行回数（CompletionRecordの総件数）および最終実行日時を表示する。

4. WHEN ユーザーがGoalの詳細を表示するとき、THE System SHALL 以下の2種類のTask型Actionを合算した対象セットを基に進捗率を算出し表示する。
   - (a) そのGoalにActionLinkで直接関連付けられたActionのうちActionTypeがTask のもの
   - (b) そのGoalに属するGoalRequirementにActionLinkで関連付けられたActionのうちActionTypeがTask のもの
   - 同一のTaskが(a)と(b)の両方に含まれる場合は重複を除いて1件として数える
   - 進捗率 = 対象セットのうち完了済み件数 ÷ 対象セットの総件数 × 100（小数点以下切り捨て、整数%）

5. THE System SHALL Goalの進捗率の算出において、ActionTypeがHabitのActionを分母・分子の両方から除外する（Habit型Actionは進捗率に含めない）。

6. THE System SHALL Goalの詳細において、当該GoalにActionLinkで直接または配下のGoalRequirementを経由して関連付けられたHabit型Actionについては進捗率とは別に、実行回数（CompletionRecordの総件数）および最終実行日時を表示する。

7. WHEN 新しいCompletionRecordが作成されるとき、THE System SHALL CompletionRecordが紐づくActionのActionTypeがTaskである場合に限り、関連するGoalRequirementおよびGoalの進捗率を再計算し表示を更新する。

8. IF あるGoalに対して進捗率の対象となるTask型のAction（直接または配下のGoalRequirement経由）が1件も存在しないとき、THEN THE System SHALL そのGoalの進捗率を0%として表示する。

9. IF あるGoalRequirementに対してActionLinkで関連付けられたTask型のActionが1件も存在しないとき、THEN THE System SHALL そのGoalRequirementの進捗率を0%として表示する。

---

### 要件10: 項目の状態管理

**ユーザーストーリー:** 開発者・社会人ユーザーとして、目標・目標要件・行動に状態を設定できるようにしたい。そうすることで、進行中でない項目を推奨計算から外しつつデータを保持できる。

#### 受入条件

1. THE System SHALL 各Goal・GoalRequirement・Actionに対して「Active・On Hold・Completed」の3種類のStatusを保持し、デフォルト値をActiveとする。
2. WHEN ユーザーが項目のStatusをOn HoldまたはCompletedに変更するとき、THE System SHALL その項目を推奨計算の対象から除外する。
3. WHEN ユーザーが項目のStatusをActiveに変更するとき、THE System SHALL その項目を推奨計算の対象に戻す。
4. THE RecommendationEngine SHALL PriorityScoreの算出および推奨行動の選定において、StatusがActive以外のGoal・GoalRequirement・Actionを除外する。
5. THE System SHALL 各一覧画面（Goal・GoalRequirement・Action）でStatusによるフィルタリング機能を提供する。

---

### 要件11: ユーザーによる手動選択

**ユーザーストーリー:** 開発者・社会人ユーザーとして、推奨されなかった行動も選択して完了記録できるようにしたい。そうすることで、システムの推奨に縛られず自分の判断で行動を選べる。

#### 受入条件

1. THE System SHALL 推奨行動一覧とは別に、StatusがActiveの全Actionの一覧を表示する機能を提供する。
2. WHEN ユーザーが推奨外のActionを選択して完了マークするとき、THE System SHALL 通常の完了記録と同様にCompletionRecordを作成し保存する（要件8の受入条件1〜5を適用する）。
3. THE System SHALL 全Action一覧をPriorityScoreの降順で表示し、StatusおよびActionType（Task/Habit）によるフィルタリング機能を提供する。

---

## 確定事項

以下の仮定はすべて確定事項として解消された。

| # | 項目 | 確定内容 |
|---|------|---------|
| C1 | 認証方式 | 認証なし・シングルユーザー。ローカルまたは単一テナント環境での使用を前提とする |
| C2 | 重要度の段階 | 高・中・低の3段階。内部計算では 高=3、中=2、低=1 として扱う |
| C3 | 利用可能時間の保存 | DBに当日日付と紐づけて保存し、同日再入力時はUPSERTで上書き更新する |
| C4 | 推奨選定ロジック | 候補をPriorityScore降順で最大10件に絞り込み、合計時間≦利用可能時間の組み合わせを比較して最良を選ぶ |
| C5 | 行動の種別 | Task（一度きり）とHabit（繰り返し）の2種類。登録時に必須で選択する |
| C6 | 優先度スコア計算式 | `PriorityScore = Σ(ImportanceWeight × ContributionWeight) × CrossGoalBonus × UrgencyFactor ÷ NormalizedDuration`（CrossGoalBonus: 1Goal=1.0、2Goals=1.1、3Goals以上=1.2） |
| C7 | 推奨理由の形式 | テンプレートによる自動生成。関連目標・関連目標要件・優先理由（期限・重要度・貢献Goal数）を含む |

## 残存する未確認事項

現時点で未確認の事項はない。すべての仮定が確定事項として解消された。
