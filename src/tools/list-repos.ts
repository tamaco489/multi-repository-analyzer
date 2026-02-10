import type { ResolvedConfig } from "../config/schema.js";

/** 設定済みリポジトリの一覧をフォーマットして返す */
export function handleListRepos(config: ResolvedConfig) {
  const lines: string[] = ["## Configured Repositories", ""];

  for (const repo of config.repos) {
    // ラベルがあれば "[backend, api]" 形式で付与
    const labelsStr =
      repo.labels.length > 0 ? ` [${repo.labels.join(", ")}]` : "";

    // パスの存在チェック結果に応じてステータスを決定
    const status = repo.available ? "available" : "path not found";
    const statusMark = repo.available ? "✓" : "✗";

    // 各リポジトリの情報を Markdown リスト形式で組み立てる
    lines.push(`- ${repo.name}${labelsStr}`);
    lines.push(`  Path: ${repo.path || "(not configured)"}`);
    lines.push(`  Description: ${repo.description}`);
    if (repo.priority_paths.length > 0) {
      lines.push(`  Priority paths: ${repo.priority_paths.join(", ")}`);
    }
    lines.push(`  Status: ${statusMark} ${status}`);
    lines.push("");
  }

  // MCP プロトコルの応答形式 (content 配列にテキストを格納) で返す
  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}
