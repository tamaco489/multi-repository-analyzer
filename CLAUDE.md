# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

複数のローカルリポジトリを横断検索・分析するローカル MCP サーバー。ripgrep (`rg`) を検索エンジンとして使用し、stdio トランスポートで JSON-RPC 通信する。

## Commands

```bash
npm install        # 依存インストール
npm run build      # tsc ビルド (出力: build/)
npm run dev        # tsx で開発実行
npm run lint       # Biome lint チェック
npm run lint:fix   # Biome lint 自動修正
```

Claude Code への登録:

```bash
claude mcp add multi-repo-analyzer node ./build/index.js
```

## Architecture

### データフロー

```text
index.ts (ツール登録)
  → tools/*.ts (入力バリデーション + ビジネスロジック)
    → search/ripgrep.ts (ripgrep 実行 + 結果パース)
    → utils/formatter.ts (結果フォーマット + MCP レスポンス生成)
```

### 設定の読み込み

`config/loader.ts` が起動時に `repos.yaml` + `.env` を読み込み、`ResolvedConfig` を生成する。各ツールハンドラはこの `config` を引数で受け取る。

### 主要モジュール

- **`search/ripgrep.ts`**: ripgrep ラッパー。`searchRepo` (単一リポ) と `searchRepos` (複数リポ並列, `Promise.all`) を export。正規表現エスケープ用 `escapeForRipgrep` もここに集約
- **`utils/formatter.ts`**: `formatResults` (検索結果 → Markdown テキスト) と `textResponse` (MCP レスポンスヘルパー) を export
- **`config/schema.ts`**: Zod スキーマと型定義 (`ResolvedRepo`, `ResolvedConfig`, `SearchConfig`)
- **`constants/search.ts`**: 検索設定のデフォルト値

### 提供ツール

- **`list_repos`**: 設定済みリポジトリの一覧表示
- **`get_repo_context`**: リポジトリの `context_files` (README.md 等) を取得。横断検索の前にプロジェクト構成を把握するために使用
- **`search_code`**: 正規表現による横断コード検索
- **`find_api_callers`**: API エンドポイントの呼び出し箇所検索
- **`find_cross_repo_dependencies`**: リポジトリ間の依存関係追跡

### ツール追加パターン

1. `src/tools/<tool-name>.ts` に Zod スキーマ + ハンドラ関数を定義
2. `src/index.ts` で `server.registerTool()` に登録
3. 検索は `searchRepos()` を使用 (並列実行 + エラーハンドリング内蔵)
4. レスポンスは `textResponse()` で返す

## 設定ファイル

- `repos.yaml` — リポジトリ定義 + `context_files` + `priority_paths` + 検索設定 (環境依存, gitignore 対象)
- `repos.yaml.example` — `repos.yaml` のサンプル
- `.env` — リポジトリの実パス (環境依存, gitignore 対象)
- `.env.example` — `.env` のサンプル

## 開発ルール

- stdout は JSON-RPC 通信に使用するため、ログはすべて stderr に出力する (`logger` を使用)
- 検索結果のみ返す設計 (ファイル読み取りは Claude Code 側が行う)
- `scope: "priority"` がデフォルト。`priority_paths` 配下のみ検索して高速化
- Biome: recommended ルール、indent 2 spaces、double quote
