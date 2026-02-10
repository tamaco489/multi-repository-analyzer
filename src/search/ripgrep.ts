import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ResolvedRepo, SearchConfig } from "../config/schema.js";
import type {
  RipgrepJsonLine,
  RipgrepJsonMatch,
  SearchMatch,
  SearchOptions,
  SearchResult,
} from "./types.js";

/**
 * ripgrep を子プロセスとして実行し、検索結果を返す。
 *
 * 終了コード: 0=マッチあり, 1=マッチなし (正常), 2=エラー
 */
async function execRipgrep(options: SearchOptions): Promise<SearchMatch[]> {
  const args = buildRipgrepArgs(options);

  return new Promise((resolve, reject) => {
    // rg コマンドを子プロセスとして起動する
    const child = spawn("rg", args);

    // stdout/stderr のデータを蓄積する
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      // 終了コード 0 (マッチあり) と 1 (マッチなし) は正常。それ以外はエラー
      if (code !== 0 && code !== 1) {
        reject(new Error(`ripgrep failed (code ${code}): ${stderr}`));
        return;
      }

      // JSON 出力をパースして SearchMatch 配列に変換する
      const matches = parseRipgrepOutput(stdout);
      resolve(matches);
    });

    // rg コマンドが見つからない等のプロセス起動エラー
    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ripgrep: ${err.message}`));
    });
  });
}

/**
 * SearchOptions から ripgrep のコマンドライン引数を組み立てる。
 *
 * 生成例: ["--json", "--no-heading", "--context", "3", "--max-count", "50", "--glob", "!node_modules", "pattern", "/path/to/repo"]
 */
function buildRipgrepArgs(options: SearchOptions): string[] {
  // --json: 1行1JSONオブジェクトで出力, --no-heading: ファイル名のグループ化を無効化
  const args: string[] = ["--json", "--no-heading"];

  // マッチ行の前後に表示するコンテキスト行数
  if (options.contextLines > 0) {
    args.push("--context", String(options.contextLines));
  }

  // 1ファイルあたりのマッチ上限数
  args.push("--max-count", String(options.maxResults));

  // 除外パターン (先頭に ! を付けて glob 除外として指定)
  for (const pattern of options.excludePatterns) {
    args.push("--glob", `!${pattern}`);
  }

  // ファイルパターンによる絞り込み (例: "*.ts")
  if (options.glob) {
    args.push("--glob", options.glob);
  }

  // 検索パターンと検索対象パスを末尾に追加
  args.push(options.pattern);
  args.push(...options.paths);

  return args;
}

/**
 * ripgrep の JSON 出力をパースし SearchMatch 配列に変換する。
 *
 * ripgrep --json の出力は1行1JSONオブジェクトで、type フィールドに "match", "begin", "end", "summary" 等がある。
 *
 * このうち "match" タイプのみを抽出する。
 */
function parseRipgrepOutput(output: string): SearchMatch[] {
  if (!output.trim()) return [];

  const matches: SearchMatch[] = [];

  // 1行ずつ JSON をパースし、match タイプのみ抽出する
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;

    const parsed = JSON.parse(line) as RipgrepJsonLine;
    if (parsed.type !== "match") continue;

    const data = (parsed as RipgrepJsonMatch).data;
    matches.push({
      absolutePath: data.path.text,
      relativePath: "", // 呼び出し側 (searchRepo) でリポジトリルートを基に算出する
      lineNumber: data.line_number,
      lineText: data.lines.text.trimEnd(),
      submatches: data.submatches.map((s) => ({
        text: s.match.text,
        start: s.start,
        end: s.end,
      })),
    });
  }

  return matches;
}

/**
 * 1つのリポジトリに対して検索を実行する。
 *
 * scope が "priority" の場合は priority_paths 配下のみ、"full" の場合はリポジトリ全体を検索する。
 * priority_paths が未設定または全パスが存在しない場合はリポジトリルートにフォールバックする。
 */
export async function searchRepo(
  repo: ResolvedRepo,
  pattern: string,
  searchConfig: SearchConfig,
  options?: {
    scope?: "priority" | "full";
    glob?: string;
  },
): Promise<SearchResult> {
  const scope = options?.scope ?? "priority";

  // scope と priority_paths に基づいて検索対象ディレクトリを決定する
  const searchPaths = resolvePaths(repo, scope);

  // ripgrep を実行してマッチを取得する
  const matches = await execRipgrep({
    pattern,
    paths: searchPaths,
    glob: options?.glob,
    contextLines: searchConfig.context_lines,
    maxResults: searchConfig.max_results,
    excludePatterns: searchConfig.exclude_patterns,
  });

  // ripgrep の出力は絶対パスのため、リポジトリルートからの相対パスに変換する
  for (const match of matches) {
    match.relativePath = path.relative(repo.path, match.absolutePath);
  }

  return { repoName: repo.name, matches };
}

/** scope と priority_paths から検索対象のパス一覧を決定する */
function resolvePaths(
  repo: ResolvedRepo,
  scope: "priority" | "full",
): string[] {
  // full スコープならリポジトリ全体を検索
  if (scope === "full") {
    return [repo.path];
  }

  // priority_paths が未設定ならリポジトリ全体にフォールバック
  if (repo.priority_paths.length === 0) {
    return [repo.path];
  }

  // priority_paths を絶対パスに変換し、存在するパスのみに絞る
  const priorityPaths = repo.priority_paths
    .map((p) => path.join(repo.path, p))
    .filter((p) => fs.existsSync(p));

  // 全パスが存在しなければリポジトリ全体にフォールバック
  if (priorityPaths.length === 0) {
    return [repo.path];
  }

  return priorityPaths;
}
