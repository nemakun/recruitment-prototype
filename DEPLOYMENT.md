# 本番デプロイチェックリスト

## プリデプロイ確認

- [ ] Git にすべての変更をコミット
  ```bash
  git status
  git add .
  git commit -m "Prod deployment setup"
  ```

- [ ] ローカルテスト実行
  ```bash
  cd backend && npm test && cd ../frontend && npm test -- --run
  ```

- [ ] ローカルビルド動作確認
  ```bash
  # 本番ビルド
  cd backend && npm run build && npm start
  # 別ターミナル
  cd frontend && npm run build && npm run preview
  ```

## デプロイ実行

### 1. リモート環境へのデプロイ

```bash
# リポジトリを本番サーバーにクローン
git clone <repo-url> /opt/kintai
cd /opt/kintai

# イメージビルド＆起動
docker-compose up -d --build
```

### 2. ログ確認

```bash
docker logs -f kintai-backend
docker logs -f kintai-frontend

# ヘルスチェック
curl http://localhost/api/ping
```

### 3. DBマイグレーション確認

```bash
# 初回は自動的に migrate が実行されます
# DB 状態を確認
docker exec kintai-backend npx prisma studio  # UI で確認（オプション）
```

## よくある問題と対処

### ポートが既に使用中
```bash
# 既存コンテナを停止
docker-compose down

# ポート使用確認
lsof -iTCP:80,3001 -sTCP:LISTEN
```

### DB マイグレーション失敗
```bash
# ボリュームをリセット
docker volume rm kintai_db_data
docker-compose up --build
```

### フロント側で API エラー
```bash
# nginx.conf の proxy 設定確認
docker exec kintai-frontend cat /etc/nginx/conf.d/default.conf
```

## ロールバック手順

```bash
# 前バージョンに戻す
docker-compose down
git checkout <previous-commit>
docker-compose up -d --build
```

## 監視＆保守

- [ ] ログローテーション設定（オプション）
- [ ] Redis キャッシュ追加（高負荷対応、オプション）
- [ ] バックアップスケジュール設定（DB ボリューム）
