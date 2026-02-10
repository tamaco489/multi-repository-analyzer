import type { SearchResult } from "../search/types.js";

/**
 * 検索結果をリポジトリ別にグループ化したテキストにフォーマットする。
 *
 * マッチ 0 件のリポジトリは省略し、全体で 0 件の場合は "No matches found." を返す。
 */
export function formatResults(results: SearchResult[]): string {
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  if (totalMatches === 0) {
    return "No matches found.";
  }

  const sections: string[] = [];

  for (const result of results) {
    if (result.matches.length === 0) continue;

    const header = `## ${result.repoName} (${result.matches.length} matches)`;
    const lines = result.matches.map(
      (m) => `${m.relativePath}:${m.lineNumber}: ${m.lineText}`,
    );

    sections.push([header, ...lines].join("\n"));
  }

  return sections.join("\n\n");
}
