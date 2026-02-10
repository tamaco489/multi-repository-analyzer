import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import * as yaml from "js-yaml";
import { SEARCH_DEFAULTS } from "../constants/search.js";
import { logger } from "../utils/logger.js";
import type { ResolvedConfig, ResolvedRepo, SearchConfig } from "./schema.js";
import { ConfigSchema } from "./schema.js";

/**
 * repos.yaml と .env を読み込み、パス解決済みの設定を返す。
 *
 * env_key が未定義またはパスが存在しない場合は available: false として警告を出力し、処理は中断しない。
 */
export function loadConfig(): ResolvedConfig {
  // .env を読み込み process.env にセットする (.env が存在しなくてもエラーにはならない)
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });

  // repos.yaml を読み込み、Zod スキーマでバリデーションする
  const yamlPath = path.resolve(__dirname, "../../repos.yaml");
  const raw = fs.readFileSync(yamlPath, "utf-8");
  const parsed = yaml.load(raw);
  const config = ConfigSchema.parse(parsed);

  // 各リポジトリの env_key を process.env から実パスに解決する
  const repos: ResolvedRepo[] = Object.entries(config.repositories).map(
    ([name, repo]) => {
      const resolvedPath = process.env[repo.env_key];

      // env_key が .env に定義されていない場合は available: false として扱う
      if (!resolvedPath) {
        logger.warn(`env_key "${repo.env_key}" is not defined in .env`);
        return {
          name,
          path: "",
          labels: repo.labels,
          description: repo.description,
          context_files: repo.context_files ?? [],
          priority_paths: repo.priority_paths ?? [],
          available: false,
        };
      }

      // パスが存在するかチェックし、存在しなければ警告を出力する
      const available = fs.existsSync(resolvedPath);
      if (!available) {
        logger.warn(`Path not found for ${name}: ${resolvedPath}`);
      }

      return {
        name,
        path: resolvedPath,
        labels: repo.labels,
        description: repo.description,
        context_files: repo.context_files ?? [],
        priority_paths: repo.priority_paths ?? [],
        available,
      };
    },
  );

  // repos.yaml で search セクションが省略された場合はデフォルト値を使用する
  const search: SearchConfig = config.search ?? {
    max_results: SEARCH_DEFAULTS.MAX_RESULTS,
    context_lines: SEARCH_DEFAULTS.CONTEXT_LINES,
    exclude_patterns: [...SEARCH_DEFAULTS.EXCLUDE_PATTERNS],
  };

  return { repos, search };
}

/**
 * リポジトリ名またはラベルで対象リポジトリをフィルタリングする。
 *
 * repos と labels は OR 条件。どちらも未指定の場合は available な全リポジトリを返す。
 *
 * 各ツールの repos/labels パラメータの解決に使用する。
 */
export function resolveTargetRepos(
  allRepos: ResolvedRepo[],
  repoNames?: string[],
  labels?: string[],
): ResolvedRepo[] {
  // パスが存在しないリポジトリは検索対象外
  const available = allRepos.filter((r) => r.available);

  // どちらも未指定なら全 available リポジトリを返す
  if (!repoNames && !labels) {
    return available;
  }

  // repos 名の一致、または labels のいずれかが含まれていれば対象とする (OR 条件)
  return available.filter((repo) => {
    const matchByName = repoNames?.includes(repo.name) ?? false;
    const matchByLabel = labels?.some((l) => repo.labels.includes(l)) ?? false;
    return matchByName || matchByLabel;
  });
}
