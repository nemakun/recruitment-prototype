# 採用管理WEBアプリ 詳細設計書（初版）

## 1. 文書情報
- 文書名: 採用管理WEBアプリ 詳細設計書
- 版数: v0.1
- 作成日: 2026-02-09
- 対象: プロトタイプ実装（`recruitment-app`）

## 2. 技術構成
- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Hosting: Vercel（frontend）/ Render（backend）

## 3. 画面詳細
## 3.1 ログイン画面
- 入力:
  - メールアドレス（必須）
  - パスワード（必須）
- 動作:
  - ログイン成功でダッシュボード遷移
  - 失敗時はエラーメッセージ表示

## 3.2 ダッシュボード画面
- 共通操作:
  - 集計期間選択（`monthly`, `quarterly`, `halfyearly`, `yearly`）
  - 絞り込み条件選択（期間に応じて対象値）
- 表示:
  - KPI（応募数、通過率）
  - 比較（前年同期比、前期比）
  - 3年推移（全体）
  - 所要日数中央値
  - 円グラフ（応募数/通過率、部・課・グループ）
  - 比較テーブル（部/課/グループ）
  - ステータス分布

## 3.3 候補者一覧画面
- 表示:
  - 候補者基本情報
  - 面接情報（一次/最終）
  - コメントは1行目のみ表示
- 機能:
  - 新規登録遷移
  - 編集遷移
  - 検索（氏名/メール/部門/ステータス）
  - ソート
  - ページング（先頭/前へ/次へ/末尾）

## 3.4 候補者新規/編集画面
- 必須項目:
  - 氏名、メール、電話、応募職種
- 入力項目:
  - 応募日、応募先部/課/グループ
  - 一次面接情報一式
  - 最終面接情報一式
- 動作:
  - 登録: 保存後に一覧へ戻る
  - キャンセル: 保存せず一覧へ戻る

## 3.5 管理者画面
- アクセス可ロール:
  - recruiter / tech_admin
- 機能:
  - アカウント追加/更新
  - 年度設定（1/4/9月始まり）更新

## 4. API詳細
## 4.1 認証
- `POST /api/recruitment/auth/login`
  - req: `{ email, password }`
  - res: `{ user, canAccessAdmin }`

## 4.2 初期データ取得
- `GET /api/recruitment/bootstrap`
  - query:
    - `period`
    - `targetMonth`
    - `targetQuarter`
    - `targetHalf`
    - `targetFiscalYear`
  - res:
    - `organization`
    - `settings.fiscalYearStartMonth`
    - `metricPeriod`
    - `metricFilter`
    - `metrics`
    - `candidates`

## 4.3 管理者系
- `GET /api/recruitment/admin/accounts?actorId=...`
- `POST /api/recruitment/admin/accounts`
- `PATCH /api/recruitment/admin/accounts/:id`
- `GET /api/recruitment/admin/settings?actorId=...`
- `PATCH /api/recruitment/admin/settings`

## 4.4 候補者/選考系
- `POST /api/recruitment/candidates`
- `PATCH /api/recruitment/candidates/:id`
- `PATCH /api/recruitment/interviews/:id/feedback`
- `PATCH /api/recruitment/applications/:id/status`

## 4.5 ヘルスチェック
- `GET /api/ping`

## 5. データモデル詳細
## 5.1 UserAccount
- `id`, `name`, `email`, `role`, `title`
- `department`, `section`, `group`（任意）
- `active`, `password`
- `createdAt`, `updatedAt`

## 5.2 CandidateRecord
- `id`, `fullName`, `email`, `phone`, `appliedRole`
- `documentUrls[]`
- `applications[]`
- `createdAt`

## 5.3 ApplicationRecord
- 応募:
  - `department`, `section`, `group`
  - `appliedDate`, `appliedAt`
- 一次面接:
  - `firstInterviewDate`
  - `firstInterviewers[]`（最大2）
  - `firstInterviewResult`
  - `firstInterviewerComment`
  - `firstRecruiterComment`
  - `firstResultNotifiedDate`
- 最終面接:
  - `finalInterviewDate`
  - `finalInterviewers[]`（最大2）
  - `finalInterviewResult`
  - `finalInterviewerComment`
  - `finalRecruiterComment`
  - `finalResultNotifiedDate`
- 選考:
  - `status`
  - `statusHistory[]`
  - `interviews[]`

## 6. 集計ロジック詳細
## 6.1 集計期間決定
- 入力:
  - 期間区分（月次/四半期/半期/年次）
  - 絞り込み条件（月、四半期、半期、年度）
  - 年度開始月（1/4/9）
- 出力:
  - 集計開始日時 `start`
  - 集計終了日時（排他）`endExclusive`

## 6.2 指標算出
- 応募数:
  - 該当期間 `appliedAt` 件数
- 通過率:
  - `決定済件数（finalResult または firstResult）` に対する `PASS` 比率
- 所要日数:
  - 各区間の日数配列から中央値

## 6.3 比較算出
- 前期比:
  - 現期間と同日数の直前期間で比較
- 前年同期比:
  - 現期間を1年シフトした期間で比較
- 3年推移:
  - 同一条件で年のみ変更して3点生成

## 6.4 組織単位比較
- キー:
  - 部: `department`
  - 課: `department::section`
  - グループ: `department::section::group`
- 集約:
  - 当期、前年同期、差分、3年推移
- 組織改編対応:
  - 当期/前年/推移いずれかに存在するキーは表示対象

## 7. 入力バリデーション
- ログイン:
  - email/password 必須
- 候補者登録・更新:
  - `fullName`, `email`, `phone`, `appliedRole` 必須
- アカウント:
  - 追加時 `name`, `email`, `role` 必須
  - email重複禁止
- 年度設定:
  - `fiscalYearStartMonth` は `1 | 4 | 9`

## 8. 認可仕様
- 管理者API:
  - `recruiter`, `tech_admin` のみ許可
- ステータス変更API:
  - `recruiter`, `dept_manager` のみ許可

## 9. エラー仕様
- `400`: 必須不足、入力値不正
- `401`: 認証失敗
- `403`: 権限不足
- `404`: 対象なし
- `409`: 重複（email等）

## 10. デプロイ仕様（現行）
- Backend（Render）:
  - Build: `npm ci --include=dev && npm run build`
  - Start: `npm run start`
- Frontend（Vercel）:
  - Root: `recruitment-app/frontend`
  - Env: `VITE_API_BASE_URL`

## 11. 既知制約
- データはメモリ保持（再起動で初期化）
- 本番向け監査/暗号化/高可用性は未実装

## 12. 今後の実装候補
- 永続DB化（RDB）
- 監査ログ永続化
- SSO
- CSV/外部媒体連携
- 通知機能（メール/Slack）
