# Multi-Repository Analyzer

複数のローカルリポジトリを横断検索・分析するローカルMCPサーバー。

## 技術スタック

- TypeScript (Node.js)
- `@modelcontextprotocol/sdk` — MCP サーバー実装
- Zod — スキーマバリデーション
- ripgrep (`rg`) — コード検索エンジン
- `js-yaml` — YAML設定読み込み
- `dotenv` — `.env` 読み込み

## プロジェクト構成

```text
src/
├── index.ts              # エントリーポイント (MCPサーバー起動)
├── config/
│   ├── schema.ts         # Zodスキーマ (YAML + env解決)
│   └── loader.ts         # YAML読み込み + .env解決
├── search/
│   ├── ripgrep.ts        # ripgrepラッパー
│   └── types.ts          # 検索結果型定義
├── tools/
│   ├── list-repos.ts
│   ├── search-code.ts
│   ├── find-api-callers.ts
│   ├── search-api-definition.ts
│   └── find-cross-repo-dependencies.ts
└── utils/
    ├── logger.ts         # stderrロガー
    └── formatter.ts      # 結果フォーマット
```

## 設定ファイル

- `repos.yaml` — リポジトリ定義 + priority_paths + 検索設定
- `.env` — リポジトリの実パス（環境依存、gitignore対象）
- `.env.example` — `.env` のサンプル

## コマンド

```bash
# 依存インストール
npm install

# ビルド
npm run build

# 開発時（ts-node）
npm run dev

# Claude Codeへの登録
claude mcp add multi-repo-analyzer node ./build/index.js
```

## MCPツール一覧

| ツール名 | 用途 |
|----------|------|
| `list_repos` | 設定済みリポジトリ一覧の表示 |
| `search_code` | 汎用コード検索（regex、ラベル/glob指定可） |
| `find_api_callers` | APIエンドポイントの呼び出し箇所を横断検索 |
| `search_api_definition` | APIハンドラー・型定義・エラーパターンの検索 |
| `find_cross_repo_dependencies` | システム間API依存の追跡 |

## 開発ルール

- stdoutはJSON-RPC通信に使用するため、ログはすべてstderrに出力する
- 検索結果のみ返す設計（ファイル読み取りはClaude Code側が行う）
- `scope: "priority"` がデフォルト。`priority_paths` 配下のみ検索して高速化
- `scope: "full"` でリポジトリ全体を検索可能
