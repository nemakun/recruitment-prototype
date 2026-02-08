# Recruitment Web App (Prototype)

既存の勤怠アプリとは別の、独立した採用管理WEBアプリです。

## 構成
- `recruitment-app/backend`: Express + TypeScript（ダミーデータAPI）
- `recruitment-app/frontend`: React + Vite（採用管理UI）

## ログイン・アカウント
- ダミーアカウントを初期作成済み
  - 採用担当: 3
  - 面接官: 16（グループリーダー 12 + 課長 4）
  - 部門責任者: 2（各部の部長）
  - 技術担当: 2
- 初期パスワード: `rec12345`
- 例: `recruiter1@example.com / rec12345`

## 組織ダミー構成
- 2部（第一開発部 / 第二開発部）
- 各部に2課（第一課 / 第二課）
- 各課に3グループ（A / B / C）
- 候補者の応募先は `部・課・グループ` 単位で管理

## 管理者画面
- 管理者画面でアカウントの追加・変更が可能
- 年度設定（`4月始まり / 1月始まり / 9月始まり`）の変更が可能
- 管理者画面にアクセス可能なロール
  - 採用担当（`recruiter`）
  - 技術担当（`tech_admin`）
- 非許可ロールが管理者画面を開こうとすると、エラー表示後にダッシュボードへ戻る

## 画面構成
- ログイン後の初期表示はダッシュボード
- ハンバーガーメニューで画面切替
  - ダッシュボード
  - 候補者
  - 管理者画面
- 候補者画面は表形式
  - `新規登録` ボタンで新規登録画面へ遷移
  - 各行 `編集` ボタンで編集画面へ遷移
  - ページング、検索（氏名/メール/部門/ステータス）、ソート対応
- 新規登録画面/編集画面
  - 画面デザインは共通
  - `登録` で保存して候補者画面へ戻る
  - `キャンセル` で保存せず候補者画面へ戻る

## できること（ダミーデータ）
- ダッシュボード表示（応募数、通過率、中央値日数）
- ダッシュボード比較表示
  - 前年同期比 / 前期比（全体）
  - 3年間推移（全体）
  - 前年同期比較テーブル（部 / 課 / グループ）
  - 組織改編で新設・廃止された単位は、データが存在する期間のみ集計
- 所要日数（中央値）
  - 最終合格: 応募日 → 最終面接結果回答日
  - 応募日 → 一次面接日
  - 一次面接日 → 一次面接結果回答日
  - 一次面接結果回答日 → 最終面接日
  - 最終面接日 → 最終面接結果回答日
- 集計期間切替（デフォルト月次）
  - 月次 / 四半期 / 半期 / 年次
  - 第2条件（期間ごと）
    - 月次: 対象月（1月-12月）
    - 四半期: 対象四半期（第1-第4）+ 対象年度（過去3年）
    - 半期: 対象期（上期/下期）+ 対象年度（過去3年）
    - 年次: 対象年度（過去3年）
  - 四半期 / 半期 / 年次 は管理者画面の年度設定に連動
- 候補者登録（氏名/メール/電話/応募職種 必須）
- 履歴書URLの登録
- 候補者一覧表示
- 候補者の面接情報管理
  - 応募日
  - 一次面接（実施日、担当者最大2名、結果、面接担当コメント、採用担当コメント、結果回答日）
  - 最終面接（実施日、担当者最大2名、結果、面接担当コメント、採用担当コメント、結果回答日）
- 面接評価（合否 + 面接官コメント + 採用担当コメント）
- ステータス変更API（採用担当/部門責任者のみ）

## API
- `POST /api/recruitment/auth/login`
- `GET /api/recruitment/bootstrap`
- `GET /api/recruitment/admin/accounts?actorId=...`
- `POST /api/recruitment/admin/accounts`
- `PATCH /api/recruitment/admin/accounts/:id`
- `GET /api/recruitment/admin/settings?actorId=...`
- `PATCH /api/recruitment/admin/settings`
- `POST /api/recruitment/candidates`
- `PATCH /api/recruitment/candidates/:id`
- `PATCH /api/recruitment/interviews/:id/feedback`
- `PATCH /api/recruitment/applications/:id/status`

## ローカル起動
1. backend
```bash
cd recruitment-app/backend
npm install
npm run dev
```
2. frontend
```bash
cd recruitment-app/frontend
npm install
npm run dev
```

- フロント: `http://localhost:3100`
- バックエンド: `http://localhost:3101`

## Docker起動
```bash
cd recruitment-app
docker compose up --build
```

- フロント: `http://localhost:3100`
- バックエンド: `http://localhost:3101`

## インターネット公開（Vercel + Render）
PCを閉じても閲覧できる形で公開する場合の手順です。

1. GitHubに `recruitment-app` を含むリポジトリをpush
2. Renderでバックエンドを作成（Blueprint推奨）
   - Render Dashboard -> New -> `Blueprint`
   - 対象リポジトリを選択
   - `recruitment-app/render.yaml` を読み込んで作成
   - デプロイ完了後、公開URLを取得（例: `https://recruitment-backend.onrender.com`）
   - 動作確認: `https://<render-url>/api/ping` がJSONを返すこと
3. Vercelでフロントエンドを作成
   - Vercel Dashboard -> New Project
   - 対象リポジトリを選択
   - Root Directory: `recruitment-app/frontend`
   - Environment Variables:
     - `VITE_API_BASE_URL=https://<render-url>`
   - Deploy
4. Vercel公開URLにアクセスして確認（例: `https://xxx.vercel.app`）
   - ログイン画面が表示される
   - `recruiter1@example.com / rec12345` でログインできる
5. URLを関係者に共有

### 補足
- フロントエンドは `VITE_API_BASE_URL` でAPI接続先を切り替えます。
- ダミーデータはメモリ保持のため、バックエンド再起動/再デプロイで初期化されます。
- 本番運用にはDB永続化が必須です。

### よくある詰まりどころ
- 画面が真っ白: Vercelの `VITE_API_BASE_URL` 未設定 or URL typo
- ログイン失敗: バックエンドURLにアクセスできていない（まず `/api/ping` を確認）
- CORS関連エラー: Render側のデプロイが古い場合があるので再デプロイ

## 注意
- 現在はダミーデータ（メモリ保持）です。再起動で初期化されます。
- 本番運用にはDB永続化、認証強化、監査ログ実装が必要です。
