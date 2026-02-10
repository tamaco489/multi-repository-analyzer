type LogLevel = "debug" | "info" | "warn" | "error";

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
