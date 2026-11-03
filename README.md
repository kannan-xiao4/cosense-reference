# Cosense MCP on Sites

Cosense（旧Scrapbox）の記録を、ChatGPTから検索・参照・編集するための参考実装です。OpenAIのSitesが提供する非公開ホスティング・認証・専用プラグイン連携を使い、サーバー処理をCloudflare Workersで動かします。

プロジェクト名は環境変数で設定し、書き込みは明示的に有効化できます。個人用SiteのMCP部分を元に、独立したビルドとテストを備えた参考実装として整理しています。

## どのコードを読むか

| ファイル | 役割 |
| --- | --- |
| `src/index.ts` | Workerの入口。`/mcp` と `/` のルーティング |
| `src/cosense-mcp.ts` | MCPディスパッチ、Cosense API、入力検証、編集プレビューと署名 |
| `tests/` | 上流をモックした動作・セキュリティ境界のテスト |
| `scripts/build.mjs` | TypeScriptを単一Worker ESMへ変換 |
| `.openai/hosting.example.json` | Sites用の設定例。実SiteのIDは含まない |
| `docs/architecture.md` | Sites・Workers・自作コードの役割と設計 |
| `docs/sites-setup.md` | 自分用に再現する手順とChatGPTへの依頼例 |
| `docs/verification.md` | 自動テストと実接続で確認した範囲 |

## できること

既定は読み取り専用の10ツールです。全文AND/OR検索、タイトル・リンク記法のベクトル検索、ページ取得、一覧、1-hop/2-hop関連ページ、編集履歴、過去の版、添付ファイルの抽出済みテキストを扱います。

`COSENSE_ENABLE_WRITES=true` をSitesのサーバー環境変数に設定すると、ページ作成・追記・修正・改名・削除の3ツールが追加されます。変更はプレビューと確定の二段階です。ファイル本体の転送、一括リンク置換、バックアップ、Google Drive同期は含みません。

## 手元で確認する

Node.js 24以上を使います。テストは架空のプロジェクトとトークンで動き、実際のCosenseへ接続しません。

```sh
npm ci
npm run check
```

実行内容はテスト、型チェック、Workerビルド、ビルド成果物の疎通テスト、公開対象ファイルの簡易検査です。出力は `dist/server/index.js` です。実際のPATは、インストール・ビルド・テストのいずれにも必要ありません。

## 自分用に動かす

[再現手順](docs/sites-setup.md)に従って、Sitesで別の所有者専用Siteを作成し、`COSENSE_PROJECT` とシークレット `COSENSE_PAT` を設定してください。Sitesは利用環境によって提供状況が異なります。このリポジトリだけでSitesの利用資格や専用プラグインが得られるわけではありません。

**このWorkerはSitesの認証ゲートウェイを前提にしています。** `oai-authenticated-user-id` ヘッダーがあるだけで、一般のインターネット上の利用者を認証できるわけではありません。通常のCloudflare Workerへ直接公開する場合は、別の認証・認可実装が必要です。この参考実装には、その直接公開の手順や独自OAuthサーバーは含めていません。

## 実装上の制約

- サーバー設定で指定された1プロジェクトだけにアクセスします。ツール呼び出しで変更できません。
- Cosenseの内部APIを利用しており、APIは予告なく変更されます。
- ページ本文は資料として返し、記載内容を操作の許可として扱いません。
- 公開ソースにはPATを含めません。シークレットはSitesの設定画面から直接登録します。
- 受信128 KiB、上流応答2 MB、上流通信12秒の制限があります。
- 履歴や検索結果にはAPI・実装の取得上限があり、完全なバックアップではありません。
- 元のSiteでは読み取りの実接続を確認済みです。この汎用版の書き込みと新規Siteへの再デプロイは、別途実接続テストが必要です。

## 参考とライセンス

Cosense APIの呼び方と操作体系は、公式の [helpfeel/cosense-cli](https://github.com/helpfeel/cosense-cli) v1.18.0を参考にしています。CLI自体は実行・同梱していません。OpenAIのSitesスターターや管理用ヘルパーも再配布していません。

MITライセンスです。詳細は [LICENSE](LICENSE) を参照してください。
