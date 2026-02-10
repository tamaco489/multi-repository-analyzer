import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { resolveTargetRepos } from "../config/loader.js";
import type { ResolvedConfig, ResolvedRepo } from "../config/schema.js";
import { textResponse } from "../utils/formatter.js";
import { logger } from "../utils/logger.js";

/** get_repo_context ツールの入力スキーマ */
export const GetRepoContextSchema = z.object({
  repos: z.array(z.string()).optional().describe("対象リポジトリ名の配列"),
  labels: z
    .array(z.string())
    .optional()
    .describe("ラベルでリポジトリをフィルタ (例: ['backend'])"),
});

/**
 * 対象リポジトリの context_files (README.md, CLAUDE.md 等) を読み込んで返す。
 *
 * repos/labels で対象を絞り込む。存在しないファイルはスキップし警告を出力する。
 */
export async function handleGetRepoContext(
  config: ResolvedConfig,
  args: Record<string, unknown>,
) {
  const params = GetRepoContextSchema.parse(args);

  const targetRepos = resolveTargetRepos(
    config.repos,
    params.repos,
    params.labels,
  );

  if (targetRepos.length === 0) {
    return textResponse("No matching repositories found.");
  }

  const sections = await Promise.all(targetRepos.map(readRepoContextFiles));
  const nonEmpty = sections.filter((s) => s !== "");

  if (nonEmpty.length === 0) {
    return textResponse("No context files found.");
  }

  return textResponse(nonEmpty.join("\n\n"));
}

/**
 * 1 リポジトリ分の context_files を読み込み、Markdown セクションとして返す。
 *
 * context_files が未設定または全ファイルが存在しない場合は空文字を返す。
 */
async function readRepoContextFiles(repo: ResolvedRepo): Promise<string> {
  if (repo.context_files.length === 0) {
    return "";
  }

  const parts: string[] = [];

  for (const file of repo.context_files) {
    const filePath = path.join(repo.path, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      parts.push(`### ${file}\n\n${content.trimEnd()}`);
    } catch {
      logger.warn(`Context file not found: ${repo.name}/${file}`);
    }
  }

  if (parts.length === 0) {
    return "";
  }

  return `## ${repo.name}\n\n${parts.join("\n\n")}`;
}
