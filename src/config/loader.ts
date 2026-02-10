import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import * as dotenv from "dotenv";
import { ConfigSchema } from "./schema.js";
import type { ResolvedRepo, ResolvedConfig, SearchConfig } from "./schema.js";
import { logger } from "../utils/logger.js";

/**
 * repos.yaml と .env を読み込み、パス解決済みの設定を返す。
 *
 * env_key が未定義またはパスが存在しない場合は available: false として警告を出力し、処理は中断しない。
 */
export function loadConfig(): ResolvedConfig {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });

  const yamlPath = path.resolve(__dirname, "../../repos.yaml");
  const raw = fs.readFileSync(yamlPath, "utf-8");
  const parsed = yaml.load(raw);

  const config = ConfigSchema.parse(parsed);

  const repos: ResolvedRepo[] = Object.entries(config.repositories).map(
    ([name, repo]) => {
      const resolvedPath = process.env[repo.env_key];

      if (!resolvedPath) {
        logger.warn(`env_key "${repo.env_key}" is not defined in .env`);
        return {
          name,
          path: "",
          labels: repo.labels,
          description: repo.description,
          priority_paths: repo.priority_paths ?? [],
          available: false,
        };
      }

      const available = fs.existsSync(resolvedPath);
      if (!available) {
        logger.warn(`Path not found for ${name}: ${resolvedPath}`);
      }

      return {
        name,
        path: resolvedPath,
        labels: repo.labels,
        description: repo.description,
        priority_paths: repo.priority_paths ?? [],
        available,
      };
    },
  );

  const search: SearchConfig = config.search ?? {
    max_results: 50,
    context_lines: 3,
    exclude_patterns: [],
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
  const available = allRepos.filter((r) => r.available);

  if (!repoNames && !labels) {
    return available;
  }

  return available.filter((repo) => {
    const matchByName = repoNames?.includes(repo.name) ?? false;
    const matchByLabel = labels?.some((l) => repo.labels.includes(l)) ?? false;
    return matchByName || matchByLabel;
  });
}
