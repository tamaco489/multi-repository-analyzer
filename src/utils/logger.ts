type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * stderr にタイムスタンプ付きでログを出力する。
 *
 * stdout は MCP の JSON-RPC 通信に使用されるため、すべてのログは stderr に出力する。
 *
 * 出力例: [2026-02-10T13:00:00.000Z] [INFO] MCP server started
 */
function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  process.stderr.write(`[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
}

export const logger = {
  debug: (message: string) => log("debug", message),
  info: (message: string) => log("info", message),
  warn: (message: string) => log("warn", message),
  error: (message: string) => log("error", message),
};
