import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import type {
  SearchOptions,
  SearchMatch,
  SearchResult,
  RipgrepJsonLine,
  RipgrepJsonMatch,
} from "./types.js";
import type { ResolvedRepo, SearchConfig } from "../config/schema.js";

/**
 * ripgrep を子プロセスとして実行し、検索結果を返す。
 *
 * 終了コード 1 はマッチなし（正常）として空配列を返す。
 */
async function execRipgrep(options: SearchOptions): Promise<SearchMatch[]> {
  const args = buildRipgrepArgs(options);

  return new Promise((resolve, reject) => {
    const child = spawn("rg", args);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`ripgrep failed (code ${code}): ${stderr}`));
        return;
      }

      const matches = parseRipgrepOutput(stdout);
      resolve(matches);
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ripgrep: ${err.message}`));
    });
  });
}

/** SearchOptions から ripgrep のコマンドライン引数を組み立てる */
function buildRipgrepArgs(options: SearchOptions): string[] {
  const args: string[] = ["--json", "--no-heading"];

  if (options.contextLines > 0) {
    args.push("--context", String(options.contextLines));
  }

  args.push("--max-count", String(options.maxResults));

  for (const pattern of options.excludePatterns) {
    args.push("--glob", `!${pattern}`);
  }

  if (options.glob) {
    args.push("--glob", options.glob);
  }

  args.push(options.pattern);
  args.push(...options.paths);

  return args;
}

/** ripgrep の JSON 出力をパースし SearchMatch 配列に変換する */
function parseRipgrepOutput(output: string): SearchMatch[] {
  if (!output.trim()) return [];

  const matches: SearchMatch[] = [];

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;

    const parsed = JSON.parse(line) as RipgrepJsonLine;
    if (parsed.type !== "match") continue;

    const data = (parsed as RipgrepJsonMatch).data;
    matches.push({
      absolutePath: data.path.text,
      relativePath: "",
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

  const searchPaths = resolvePaths(repo, scope);

  const matches = await execRipgrep({
    pattern,
    paths: searchPaths,
    glob: options?.glob,
    contextLines: searchConfig.context_lines,
    maxResults: searchConfig.max_results,
    excludePatterns: searchConfig.exclude_patterns,
  });

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
  if (scope === "full") {
    return [repo.path];
  }

  if (repo.priority_paths.length === 0) {
    return [repo.path];
  }

  const priorityPaths = repo.priority_paths
    .map((p) => path.join(repo.path, p))
    .filter((p) => fs.existsSync(p));

  if (priorityPaths.length === 0) {
    return [repo.path];
  }

  return priorityPaths;
}
