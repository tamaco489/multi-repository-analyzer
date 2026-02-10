/**
 * MCPサーバーのエントリーポイント。
 * 設定を読み込み、サーバーを起動する。現在は設定読み込みの動作確認用。
 */
import { logger } from "./utils/logger.js";
import { loadConfig } from "./config/loader.js";

logger.info("multi-repository-analyzer starting...");

const config = loadConfig();
logger.info(`Loaded ${config.repos.length} repositories`);
for (const repo of config.repos) {
  const status = repo.available ? "OK" : "UNAVAILABLE";
  logger.info(`  [${status}] ${repo.name}: ${repo.path || "(not set)"}`);
}
