import type { ResolvedConfig } from "../config/schema.js";

/** 設定済みリポジトリの一覧をフォーマットして返す */
export function handleListRepos(config: ResolvedConfig) {
  const lines: string[] = ["## Configured Repositories", ""];

  for (const repo of config.repos) {
    const labelsStr =
      repo.labels.length > 0 ? ` [${repo.labels.join(", ")}]` : "";
    const status = repo.available ? "available" : "path not found";
    const statusMark = repo.available ? "✓" : "✗";

    lines.push(`- ${repo.name}${labelsStr}`);
    lines.push(`  Path: ${repo.path || "(not configured)"}`);
    lines.push(`  Description: ${repo.description}`);
    if (repo.priority_paths.length > 0) {
      lines.push(`  Priority paths: ${repo.priority_paths.join(", ")}`);
    }
    lines.push(`  Status: ${statusMark} ${status}`);
    lines.push("");
  }

  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}
