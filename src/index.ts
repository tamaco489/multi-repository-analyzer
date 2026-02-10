/**
 * MCPサーバーのエントリーポイント。
 *
 * 設定を読み込み、ツールを登録し、stdio トランスポートで MCP サーバーを起動する。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config/loader.js";
import { logger } from "./utils/logger.js";
import { handleListRepos } from "./tools/list-repos.js";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
) as { version: string };

async function main() {
  const config = loadConfig();
  logger.info(`Loaded ${config.repos.length} repositories`);

  const server = new McpServer({
    name: "multi-repo-analyzer",
    version: pkg.version,
  });

  server.registerTool(
    "list_repos",
    {
      description:
        "設定済みリポジトリの一覧を表示する。各リポジトリのラベル、パス、優先パス、利用可否ステータスを確認できる。",
    },
    async () => {
      return handleListRepos(config);
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started");
}

main().catch((err) => {
  logger.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
