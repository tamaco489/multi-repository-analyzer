import { z } from "zod";
import type { ResolvedConfig, ResolvedRepo } from "../config/schema.js";
import { escapeForRipgrep, searchRepos } from "../search/ripgrep.js";
import { formatResults, textResponse } from "../utils/formatter.js";

/** find_cross_repo_dependencies ツールの入力スキーマ */
export const FindCrossRepoDependenciesSchema = z.object({
  source_repo: z.string().describe("参照元リポジトリ名"),
  target_repos: z
    .array(z.string())
    .optional()
    .describe(
      "検索対象リポジトリ名の配列 (未指定時は source_repo 以外の全リポジトリ)",
    ),
  path: z
    .string()
    .optional()
    .describe("追加の検索キーワード (例: パス、モジュール名、関数名)"),
  scope: z.enum(["priority", "full"]).default("priority").describe("検索範囲"),
});

/**
 * リポジトリ名から各種命名規則のバリエーションを生成する。
 *
 * @example
 * // "sub-backend" → [
 * //   "sub-backend",   // ケバブケース (そのまま)
 * //   "sub_backend",   // スネークケース
 * //   "subBackend",    // キャメルケース
 * //   "SubBackend",    // パスカルケース
 * //   "SUB_BACKEND",   // 大文字スネークケース (定数)
 * // ]
 */
function generateNameVariants(repoName: string): string[] {
  const variants: string[] = [];

  // ケバブケース (そのまま)
  variants.push(escapeForRipgrep(repoName));

  // スネークケース: ハイフンをアンダースコアに変換
  const snake = repoName.replace(/-/g, "_");
  variants.push(snake);

  // キャメルケース: 2番目以降のパートの先頭を大文字に
  const camel = repoName
    .split("-")
    .map((part, i) =>
      i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");
  variants.push(camel);

  // パスカルケース: 全パートの先頭を大文字に
  const pascal = repoName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  variants.push(pascal);

  // 大文字スネークケース (定数): SUB_BACKEND 形式
  variants.push(snake.toUpperCase());

  // 重複除去して返す
  return [...new Set(variants)];
}

/**
 * source_repo の情報から、他リポジトリが参照しうる検索パターンを生成する。
 *
 * パターン種別:
 * 1. リポジトリ名由来の命名バリエーション (名前が4文字以上の場合のみ。短い名前はノイズが多い)
 * 2. path 指定時はそのリテラル + パスパラメータ除去版
 *
 * パターンが0件の場合 (名前が短く path も未指定) はリポジトリ名をそのまま使用する。
 */
function buildCrossRepoPatterns(
  sourceRepo: ResolvedRepo,
  extraPath?: string,
): string[] {
  const patterns: string[] = [];

  // 名前が十分に長い場合のみ名前由来パターンを追加 (短い名前はノイズが多いため)
  if (sourceRepo.name.length > 3) {
    const nameVariants = generateNameVariants(sourceRepo.name);
    patterns.push(...nameVariants);
  }

  // path 指定時はパスリテラルで検索
  if (extraPath) {
    patterns.push(escapeForRipgrep(extraPath));

    // パスパラメータ (:id 等) を除去したパターンも追加
    const basePath = extraPath.replace(/\/:[^/]+/g, "");
    if (basePath !== extraPath) {
      patterns.push(escapeForRipgrep(basePath));
    }
  }

  // パターンが0件の場合はリポジトリ名をそのまま使用 (ノイズ覚悟)
  if (patterns.length === 0) {
    patterns.push(escapeForRipgrep(sourceRepo.name));
  }

  return patterns;
}

/**
 * target_repos を解決する。
 * - 明示指定: 指定されたリポジトリのみ (available のもの)
 * - 未指定: source_repo を除く全リポジトリ (available のもの)
 */
function resolveTargetReposForCrossDeps(
  allRepos: ResolvedRepo[],
  sourceRepoName: string,
  targetRepoNames?: string[],
): ResolvedRepo[] {
  const available = allRepos.filter((r) => r.available);

  // 明示指定時は指定されたリポジトリのみ
  if (targetRepoNames && targetRepoNames.length > 0) {
    return available.filter((r) => targetRepoNames.includes(r.name));
  }

  // 未指定時は source_repo 以外の全リポジトリ
  return available.filter((r) => r.name !== sourceRepoName);
}

/**
 * リポジトリ間の依存関係を追跡する。
 *
 * source_repo への参照を target_repos 内で検索し、リポジトリ間の依存関係を可視化する。
 * path を指定するとより精度の高い結果が得られる。
 */
export async function handleFindCrossRepoDependencies(
  config: ResolvedConfig,
  args: Record<string, unknown>,
) {
  const params = FindCrossRepoDependenciesSchema.parse(args);

  // source_repo の存在・利用可否を確認
  const sourceRepo = config.repos.find(
    (r) => r.name === params.source_repo && r.available,
  );
  if (!sourceRepo) {
    return textResponse(
      `Source repository "${params.source_repo}" not found or unavailable.`,
    );
  }

  // 検索対象リポジトリを解決 (source_repo 自身は除外)
  const targetRepos = resolveTargetReposForCrossDeps(
    config.repos,
    params.source_repo,
    params.target_repos,
  );

  if (targetRepos.length === 0) {
    return textResponse("No target repositories available.");
  }

  // source_repo の情報から検索パターンを生成し、OR で結合
  const patterns = buildCrossRepoPatterns(sourceRepo, params.path);
  const pattern = patterns.join("|");

  // 各 target_repo で並列検索を実行
  const results = await searchRepos(targetRepos, pattern, config.search, {
    scope: params.scope,
  });

  // 依存方向が分かるヘッダを付けて結果をフォーマット
  const body = formatResults(results);

  return textResponse(
    body === "No matches found."
      ? `No dependencies from "${sourceRepo.name}" found in target repositories.`
      : `Dependencies from "${sourceRepo.name}" found in target repositories:\n\n${body}`,
  );
}
