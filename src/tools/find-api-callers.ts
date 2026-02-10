import { z } from "zod";
import { resolveTargetRepos } from "../config/loader.js";
import type { ResolvedConfig } from "../config/schema.js";
import { searchRepo } from "../search/ripgrep.js";
import type { SearchMatch, SearchResult } from "../search/types.js";
import { formatResults } from "../utils/formatter.js";
import { logger } from "../utils/logger.js";

/** find_api_callers ツールの入力スキーマ */
export const FindApiCallersSchema = z.object({
  path: z.string().describe("API パス (例: '/api/v1/users')"),
  method: z.string().optional().describe("HTTP メソッド (例: 'GET', 'POST')"),
  repos: z.array(z.string()).optional().describe("検索対象リポジトリ名"),
  labels: z
    .array(z.string())
    .optional()
    .describe("ラベルでリポジトリをフィルタ"),
  scope: z.enum(["priority", "full"]).default("priority").describe("検索範囲"),
});

/**
 * ripgrep の正規表現で特殊文字をエスケープする。
 * パスリテラルをそのまま検索するために必要。
 */
function escapeForRipgrep(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * API パスから ripgrep 用の検索パターンを生成する。
 *
 * @example
 * // path = "/api/v1/users" → ["/api/v1/users"]
 * // path = "/api/v1/users/:id" → ["/api/v1/users/:id", "/api/v1/users"]
 */
function buildApiCallerPatterns(apiPath: string): string[] {
  const patterns: string[] = [];

  // フルパスリテラルで検索
  patterns.push(escapeForRipgrep(apiPath));

  // パスパラメータ (:id 等) を除去したパターンも追加
  // テンプレートリテラルで `/api/v1/users/${id}` と書かれるケースに対応
  const withoutParams = apiPath.replace(/\/:[^/]+/g, "");
  if (withoutParams !== apiPath) {
    patterns.push(escapeForRipgrep(withoutParams));
  }

  return patterns;
}

/**
 * マッチ行に HTTP メソッド名が含まれるかでフィルタリングする。
 *
 * 判定パターン例 (method = "GET" の場合):
 * - "GET" / "get" (リテラル)
 * - ".get(" (axios/router のメソッド呼び出し)
 * - "method: 'GET'" / 'method: "GET"' (オプションオブジェクト)
 */
function filterByMethod(matches: SearchMatch[], method: string): SearchMatch[] {
  const methodUpper = method.toUpperCase();
  const methodLower = method.toLowerCase();

  // マッチ行に含まれるかチェックするパターン一覧
  const methodPatterns = [
    methodUpper,
    methodLower,
    `.${methodLower}(`,
    `method: '${methodUpper}'`,
    `method: "${methodUpper}"`,
  ];

  return matches.filter((match) => {
    return methodPatterns.some((p) => match.lineText.includes(p));
  });
}

/**
 * API パスから HTTP クライアント呼び出し箇所を横断検索する。
 *
 * パスリテラルとパスパラメータ除去版の OR で検索し、method 指定時はマッチ行をフィルタリングする。
 * method フィルタで 0 件の場合はフィルタなしの結果をフォールバックとして返す。
 */
export async function handleFindApiCallers(
  config: ResolvedConfig,
  args: Record<string, unknown>,
) {
  const params = FindApiCallersSchema.parse(args);

  // repos 名・labels で検索対象リポジトリを絞り込む
  const targetRepos = resolveTargetRepos(
    config.repos,
    params.repos,
    params.labels,
  );

  if (targetRepos.length === 0) {
    return {
      content: [
        { type: "text" as const, text: "No matching repositories found." },
      ],
    };
  }

  // API パスから検索パターンを生成し、OR で結合する
  const patterns = buildApiCallerPatterns(params.path);
  const pattern = patterns.join("|");

  // 各リポジトリで検索を実行する
  const results: SearchResult[] = [];
  for (const repo of targetRepos) {
    try {
      const result = await searchRepo(repo, pattern, config.search, {
        scope: params.scope,
      });

      // method 指定時はマッチ行をフィルタリングする
      // フィルタ後 0 件ならフィルタなしの結果をそのまま使う (メソッドが近くの行に書かれていない可能性があるため)
      if (params.method && result.matches.length > 0) {
        const filtered = filterByMethod(result.matches, params.method);
        if (filtered.length > 0) {
          result.matches = filtered;
        }
      }

      results.push(result);
    } catch (err) {
      logger.warn(
        `Search failed for ${repo.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 検索結果をリポジトリ別にフォーマットして返す
  const text = formatResults(results);
  return {
    content: [{ type: "text" as const, text }],
  };
}
