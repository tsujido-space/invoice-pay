# GEMINI.md - プロジェクト技術コンテキスト

このファイルは、AI（Antigravity/Gemini）がこのプロジェクトを扱う際に参照すべき、環境固有の注意事項や判断基準を記録します。

## 全般ルール
- implementation plan, walkthrough, tasks listは必ず更新、日本語で書いてください。

## 同期処理 (Google Drive Sync)

### 仕組み
- 大量のファイルを効率的に処理するため、同期処理は **Cloud Run Jobs** として実行します。
- これにより、HTTP リクエストのタイムアウト（通常 60-300秒）に縛られず、最長 24時間の処理が可能です。

### 実行方法
- **手動実行 (gcloud)**:
  ```bash
  gcloud run jobs execute gemini-invoice-sync --region [REGION]
  ```
- **アプリケーションからの実行**:
  `server.ts` の `/api/sync` エンドポイントを叩くことで、バックグラウンドで処理が開始されるよう構成しています。

### 設定と AI モデル
- **使用モデル**: `gemini-3-flash-preview` (Gemini 3 シリーズの最新 Flash モデル)
- **並列処理**: 3 ファイルずつのバッチ並列処理を行い、抽出速度を向上させています。
- **環境変数**: `GEMINI_API_KEY` を Cloud Run Jobs の設定に含める必要があります。

## デプロイメント

### クラウド環境
- **プラットフォーム**: Google Cloud Run
- **リージョン**: 設定ファイル（terraform.tfvars）を参照。デフォルトは `us-central1` または `asia-northeast1`。

### ビルドとアーキテクチャ
- **重要**: Cloud Run は `linux/amd64` アーキテクチャのイメージを必要とします。
- **ローカルビルド時の注意**: Apple Silicon (M1/M2/M3) Mac でビルドを行う場合、デフォルトのアーキテクチャは `arm64` になります。ビルド時は必ずプラットフォームを指定してください。
  ```bash
  docker build --platform linux/amd64 -t [IMAGE_URL] .
  # または buildx を使用
  docker buildx build --platform linux/amd64 -t [IMAGE_URL] --push .
  ```

### Terraform 構成
- Cloud Run のイメージ差し替え時にリソースの再作成が発生することがあるため、`google_cloud_run_v2_service` には `deletion_protection = false` を設定しています。
- 外部公開のため、`allUsers` に `roles/run.invoker` を付与しています。

## 開発環境
- **言語/フレームワーク**: React 19, Vite, TypeScript
- **AI連携**: Gemini Pro Vision / Gemini 1.5 Flash を使用した請求書解析。
