# Kintai (勤怠管理)

ローカルでの開発手順:

1. ルートで各モジュールに移動して依存をインストール

```bash
cd backend
npm install

# 別ターミナル
cd ../frontend
npm install
```

2. バックエンド起動

```bash
cd backend
npm run dev
```

3. フロントエンド起動

```bash
cd frontend
npm run dev
```

- フロントは http://localhost:3000、バックは http://localhost:3001
- 開発中はフロントから `/api/*` をプロキシするか、バックをCORS対応してください。

次の作業候補:
- バックエンドに認証・DB接続追加（SQLite / Prisma など）
- フロントで出勤／退勤ボタン、日次一覧を作成
- テストとCI設定

## 本番環境での実行（Docker）

Docker と Docker Compose をインストールしている場合：

```bash
docker-compose up --build
```

- フロントエンドは http://localhost にアクセス
- バックエンドは http://localhost:3001 にアクセス（通常は使わない、proxy経由）
- フロント側の nginx が `/api/*` をバックエンドにプロキシ

### 構成
- **バックエンド**：Node.js + Express + Prisma + SQLite
- **フロントエンド**：React + Vite（nginx で配信）
- **DB**：SQLite（Docker ボリューム `/data/dev.db` で永続化）

### 本番デプロイ手順

#### 前提条件
- Docker & Docker Compose インストール済み
- ポート 80（フロント）・3001（バック）が利用可能

#### デプロイ実行

1. **リポジトリをクローンまたは pull**
```bash
git clone <repository-url> kintai
cd kintai
```

2. **イメージビルド & ワンコマンド起動**
```bash
docker-compose up -d --build
```

3. **ログ確認**
```bash
# バックエンド起動確認
docker logs -f kintai-backend

# フロントエンド起動確認
docker logs -f kintai-frontend
```

4. **ブラウザで確認**
  - http://localhost/ へアクセス

5. **停止**
```bash
docker-compose down
```

6. **データベースリセット（全データ削除）**
```bash
docker volume rm kintai_db_data
docker-compose up --build
```

### 環境变量カスタマイズ

`docker-compose.yml` の `environment` セクションで設定：
- `DATABASE_URL`：DB ファイルパス（デフォルト: `/data/dev.db`）
- `NODE_ENV`：`production` または `development`
- `PORT`：バックエンドポート（デフォルト: 3001）

### ローカル本番ビルドテスト

Docker を導入する前のテスト方法：

```bash
# バックエンド本番ビルド＆起動
cd backend
npm run build
npm start

# 別ターミナル：フロント本番ビルド＆プレビュー
cd frontend
npm run build
npm run preview
# ブラウザで http://localhost:4173 へアクセス
```

### セキュリティに関する注意

本番環境では以下を推奨：
- SSL/TLS 証明書の設定（nginx 側で）
- CORS 設定の確認（必要に応じて制限）
- DB ボリュームのバックアップ設定
- 定期的なテストの実行（CI/CD パイプライン活用）

### 構築＆デプロイ

1. ローカルビルド・テスト
```bash
cd backend
npm run build
npm run test

cd ../frontend
npm run build
npm run test -- --run
```

2. Docker イメージ構築
```bash
docker build -t kintai-backend:latest ./backend
docker build -t kintai-frontend:latest ./frontend
```

3. Docker Compose で起動
```bash
docker-compose up -d
docker logs -f kintai-backend  # バックエンドログ確認
```

4. 停止
```bash
docker-compose down
```
