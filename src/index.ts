/**
 * MCPサーバーのエントリーポイント。
 *
 * 設定を読み込み、ツールを登録し、stdio トランスポートで MCP サーバーを起動する。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config/loader.js";
import {
  FindApiCallersSchema,
  handleFindApiCallers,
} from "./tools/find-api-callers.js";
import {
  FindCrossRepoDependenciesSchema,
  handleFindCrossRepoDependencies,
} from "./tools/find-cross-repo-dependencies.js";
import {
  GetRepoContextSchema,
  handleGetRepoContext,
} from "./tools/get-repo-context.js";
import { handleListRepos } from "./tools/list-repos.js";
import { handleSearchCode, SearchCodeSchema } from "./tools/search-code.js";
import { logger } from "./utils/logger.js";

// package.json から version を読み込み、McpServer の識別情報として使用する
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
) as { version: string };

async function main() {
  // repos.yaml と .env を読み込み、各リポジトリのパス解決・存在チェックを行う
  const config = loadConfig();
  logger.info(`Loaded ${config.repos.length} repositories`);

  // MCP サーバーインスタンスを作成。name と version はクライアントがサーバーを識別するために使用する
  const server = new McpServer({
    name: "multi-repo-analyzer",
    version: pkg.version,
  });

  // registerTool でツールを MCP クライアント (Claude Code 等) に公開する。
  // クライアントは description と inputSchema をもとにツールの用途・引数を認識し、必要に応じて自動で呼び出す。
  server.registerTool(
    "list_repos",
    {
      description:
        "設定済みリポジトリの一覧を表示する。各リポジトリのラベル、パス、優先パス、利用可否ステータスを確認できる。",
    },
    async () => {
      // 設定済み全リポジトリの情報 (ラベル、パス、ステータス等) をテキストで返す
      return handleListRepos(config);
    },
  );

  server.registerTool(
    "get_repo_context",
    {
      description:
        "リポジトリの README.md や CLAUDE.md 等のコンテキストファイルを取得する。横断検索の前にプロジェクト構成を把握するために使用する。repos/labelsで対象を絞り込み可能。",
      inputSchema: GetRepoContextSchema,
    },
    async (args) => {
      return handleGetRepoContext(config, args);
    },
  );

  server.registerTool(
    "search_code",
    {
      description:
        "汎用コード検索。正規表現パターンで複数リポジトリを横断検索する。repos/labelsで検索対象を絞り込み可能。scopeでpriority_paths限定(デフォルト)または全体検索を選択。",
      inputSchema: SearchCodeSchema,
    },
    async (args) => {
      // 引数で指定されたパターンで対象リポジトリを横断検索し、結果をテキストで返す
      return handleSearchCode(config, args);
    },
  );

  server.registerTool(
    "find_api_callers",
    {
      description:
        "API エンドポイントの呼び出し箇所を横断検索する。API パスを指定すると、fetch/axios 等の HTTP クライアントからの呼び出し箇所を検索する。method で HTTP メソッドを絞り込み可能。",
      inputSchema: FindApiCallersSchema,
    },
    async (args) => {
      // API パスから検索パターンを生成し、HTTP クライアント呼び出し箇所を検索して返す
      return handleFindApiCallers(config, args);
    },
  );

  server.registerTool(
    "find_cross_repo_dependencies",
    {
      description:
        "リポジトリ間の依存関係を追跡する。source_repo への参照を target_repos から検索し、依存関係を可視化する。path で追加キーワードを指定するとより精度の高い結果が得られる。",
      inputSchema: FindCrossRepoDependenciesSchema,
    },
    async (args) => {
      // source_repo の名前バリエーション + path で target_repos を横断検索し、依存関係を返す
      return handleFindCrossRepoDependencies(config, args);
    },
  );

  // stdin/stdout で JSON-RPC メッセージをやり取りする。
  // stdout は通信に使用されるため、ログは stderr に出力する必要がある。
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started");
}

main().catch((err) => {
  logger.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
