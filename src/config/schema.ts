import { z } from "zod";
import { SEARCH_DEFAULTS } from "../constants/search.js";

/** repos.yaml の単一リポジトリ定義 */
const RepoConfigSchema = z.object({
  env_key: z.string(),
  labels: z.array(z.string()),
  description: z.string(),
  priority_paths: z.array(z.string()).optional(),
});

/** repos.yaml の検索設定セクション */
const SearchConfigSchema = z.object({
  max_results: z.number().default(SEARCH_DEFAULTS.MAX_RESULTS),
  context_lines: z.number().default(SEARCH_DEFAULTS.CONTEXT_LINES),
  exclude_patterns: z.array(z.string()).default([...SEARCH_DEFAULTS.EXCLUDE_PATTERNS]),
});

/** repos.yaml 全体のバリデーションスキーマ */
export const ConfigSchema = z.object({
  repositories: z.record(z.string(), RepoConfigSchema),
  search: SearchConfigSchema.optional(),
});

export type RepoConfig = z.infer<typeof RepoConfigSchema>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/** env_key を実パスに解決済みのリポジトリ情報。available が false の場合、パス未設定または存在しない。 */
export interface ResolvedRepo {
  name: string;
  path: string;
  labels: string[];
  description: string;
  priority_paths: string[];
  available: boolean;
}

/** loadConfig() の戻り値。全リポジトリの解決済み情報と検索設定を保持する。 */
export interface ResolvedConfig {
  repos: ResolvedRepo[];
  search: SearchConfig;
}
