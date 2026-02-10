# multi-repository-analyzer

[English](./README.md)

複数のローカルリポジトリを横断検索・分析するローカル MCP サーバー。
ripgrep (`rg`) を検索エンジンとして使用し、Claude Code などの MCP クライアントからツールとして呼び出せる。

## 前提条件

- Node.js >= 24
- [ripgrep](https://github.com/BurntSushi/ripgrep) — システムバイナリとしてインストールが必要 (`rg` にパスが通っていること)。Claude Code 内蔵の `rg` エイリアスは MCP サーバーのサブプロセスからは利用できない。
- [just](https://github.com/casey/just) (タスクランナー)

```bash
# macOS
brew install ripgrep just
```

## セットアップ

### 1. リポジトリのクローンとビルド

```bash
git clone https://github.com/tamaco489/multi-repository-analyzer.git
cd multi-repository-analyzer
npm install
npm run build
```

### 2. 検索対象リポジトリの設定

サンプルファイルをコピーし、自身の環境に合わせて編集する。

```bash
just setup
```

`.env` を編集し、検索対象リポジトリの実パスを設定する。

```bash
REPO_A=/Users/yourname/src/repo-a
REPO_B=/Users/yourname/src/repo-b
REPO_C=/Users/yourname/src/repo-c
```

`repos.yaml` を自身の構成に合わせて編集する。各リポジトリに `env_key` (`.env` のキー名)、`labels`、`description`、`priority_paths` を定義する。

```yaml
repositories:
  repo-a:
    env_key: REPO_A
    labels: [backend]
    description: "バックエンド API サーバー"
    priority_paths:
      - src/

  repo-b:
    env_key: REPO_B
    labels: [frontend]
    description: "フロントエンドアプリ"
    priority_paths:
      - src/
      - components/

search:
  max_results: 50
  context_lines: 3
  exclude_patterns:
    - node_modules
    - .git
    - vendor
    - dist
    - build
    - "*.min.js"
```

### 3. Claude Code への登録

**ツールを利用したいプロジェクトのディレクトリ**で以下を実行する:

```bash
claude mcp add multi-repo-analyzer node /path/to/multi-repository-analyzer/build/index.js
```

`/path/to/multi-repository-analyzer` は実際のクローン先パスに置き換えること。

登録後、Claude Code を再起動し `list_repos` ツールを呼び出してリポジトリ一覧が返れば正常に動作している。

## MCP ツール一覧

| ツール名                       | 用途                                       |
| ------------------------------ | ------------------------------------------ |
| `list_repos`                   | 設定済みリポジトリ一覧の表示               |
| `search_code`                  | 正規表現パターンで複数リポジトリを横断検索 |
| `find_api_callers`             | API エンドポイントの呼び出し箇所を横断検索 |
| `find_cross_repo_dependencies` | リポジトリ間の依存関係を追跡               |
