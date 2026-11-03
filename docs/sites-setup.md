# 自分用に再現する手順

## 前提

- Sitesでサーバー処理とSite MCPを作成できるChatGPT/Codex環境。
- 自分が閲覧できるCosenseプロジェクトとPAT。
- Node.js 24以上。ビルド・テストはPATなしで実行できます。

Sitesの公開APIやCLIの細部は、このリポジトリ内に固定していません。Sites対応エージェントに、実行時の最新Sitesスキルを読ませてデプロイしてください。これは一般のCloudflareダッシュボードから直接公開する手順ではありません。

## 手順

1. リポジトリを取得し、`npm ci`、`npm run check` を実行する。
2. 新しい所有者専用Siteを作成する。別の公開サイトや既存の個人用Siteを流用しない。
3. `.openai/hosting.example.json` を元に、**その新しいSiteの返却ID**を持つ `.openai/hosting.json` を作る。このファイルは参考リポジトリではignoreされている。実デプロイ用の非公開ソースリポジトリでは、Sitesの手順に従って追跡する。
4. Sitesの環境変数に `COSENSE_PROJECT` を設定する。例は `example-project`。PATは `COSENSE_PAT` という**シークレット**としてSitesの管理画面で直接登録する。会話・コード・Git・`.env.example` へ実値を書かない。
5. 読み取り専用で始めるため、`COSENSE_ENABLE_WRITES` は省略または `false` にする。
6. `npm run build` でWorkerをビルドする。`dist/server/index.js` と実デプロイ用 `.openai/hosting.json` を含む成果物を、最新Sitesワークフローでソース同期・バージョン保存・所有者専用デプロイする。ソースのコミットと成果物が一致するようにする。
7. サーバー環境変数を設定・変更した場合は再デプロイして反映する。
8. Sitesが作成した専用プラグインを利用する。新しい会話から `cosense_status`、一覧、検索、本文取得を順に試す。接続後も `privateAccessVerified` を確認する。
9. 書き込みが必要なら `COSENSE_ENABLE_WRITES=true` にして再デプロイする。自分で用意したテスト用ページでプレビュー・確定・再取得を試す。既存の日記を最初のテスト対象にしない。

## エージェントへの依頼例

次の文章と、このリポジトリを指定します。

```text
このリポジトリを参考に、Cosenseを参照する自分専用のSite MCPを作成してください。
最初に最新のSitesスキルを読み、Worker ESMを扱う正式な手順を確認してください。
新しい所有者専用Siteを作成し、公開範囲を確認してください。
MCPはsrc/cosense-mcp.ts、入口はsrc/index.tsです。
この参考リポジトリを本番ソースとして上書きせず、新Site用の非公開ソースへ配置してください。
Node.js 24でnpm ciとnpm run checkを実行し、npm run buildでビルドしてください。
デプロイ前に、その新SiteのIDとcapabilities: ["mcp"]をhosting設定へ反映してください。
COSENSE_PROJECTは私が指定します。
COSENSE_PATは私がSites管理画面のシークレットへ直接登録します。会話に貼るよう求めないでください。
最初は読み取り専用とし、所有者専用のままデプロイしてください。
接続後にMCP経由の読み取りと、未認証アクセスの拒否を確認してください。
```

## 接続確認と上限

プラグインへのツール反映に新しい会話が必要な場合があります。`cosense_status` の `writesEnabled` は実装設定を示し、PATの更新権限を実証するものではありません。`writePermissionVerified` は現在、自動的な書き込みテストを行わずfalseを返します。

Cosense APIは内部APIです。最新版CLIや公式ヘルプとの整合、PATの利用条件・権限、Sitesの機能提供状況を利用時に確認してください。
