import { z } from "zod";
import { resolveTargetRepos } from "../config/loader.js";
import type { ResolvedConfig } from "../config/schema.js";
import { searchRepo } from "../search/ripgrep.js";
import type { SearchResult } from "../search/types.js";
import { formatResults } from "../utils/formatter.js";
import { logger } from "../utils/logger.js";

/** search_code ツールの入力スキーマ */
export const SearchCodeSchema = z.object({
  query: z.string().describe("検索パターン (正規表現)"),
  repos: z.array(z.string()).optional().describe("検索対象リポジトリ名の配列"),
  labels: z
    .array(z.string())
    .optional()
    .describe("ラベルでリポジトリをフィルタ (例: ['backend'])"),
  glob: z.string().optional().describe("ファイルパターン (例: '*.ts', '*.tf')"),
  scope: z
    .enum(["priority", "full"])
    .default("priority")
    .describe("検索範囲: priority=優先パスのみ, full=全体"),
});

/**
 * 正規表現パターンで複数リポジトリを横断検索する。
 *
 * repos/labels で対象を絞り込み、scope で検索範囲を制御する。
 */
export async function handleSearchCode(
  config: ResolvedConfig,
  args: Record<string, unknown>,
) {
  // Zod スキーマで入力をバリデーションし、デフォルト値 (scope: "priority" 等) を適用する
  const params = SearchCodeSchema.parse(args);

  // repos 名・labels の OR 条件で検索対象リポジトリを絞り込む (どちらも未指定なら全リポジトリ)
  const targetRepos = resolveTargetRepos(
    config.repos,
    params.repos,
    params.labels,
  );

  // 該当リポジトリがなければ早期リターン
  if (targetRepos.length === 0) {
    return {
      content: [
        { type: "text" as const, text: "No matching repositories found." },
      ],
    };
  }

  // 各リポジトリで逐次検索。失敗したリポジトリはスキップし、他の結果は返却する
  const results: SearchResult[] = [];
  for (const repo of targetRepos) {
    try {
      const result = await searchRepo(repo, params.query, config.search, {
        scope: params.scope,
        glob: params.glob,
      });
      results.push(result);
    } catch (err) {
      logger.warn(
        `Search failed for ${repo.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 検索結果をリポジトリ別にグループ化したテキストにフォーマットして返す
  const text = formatResults(results);
  return {
    content: [{ type: "text" as const, text }],
  };
}
