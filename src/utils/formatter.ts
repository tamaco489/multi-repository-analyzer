import type { SearchResult } from "../search/types.js";

/** MCP プロトコルのテキストレスポンスを生成する */
export function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * 検索結果をリポジトリ別にグループ化したテキストにフォーマットする。
 *
 * マッチ 0 件のリポジトリは省略し、全体で 0 件の場合は "No matches found." を返す。
 */
export function formatResults(results: SearchResult[]): string {
  // 全リポジトリのマッチ数を合算し、0 件なら早期リターン
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  if (totalMatches === 0) {
    return "No matches found.";
  }

  const sections: string[] = [];

  // リポジトリごとにヘッダ + マッチ行のセクションを組み立てる
  // マッチ 0 件のリポジトリはスキップする
  for (const result of results) {
    if (result.matches.length === 0) continue;

    const header = `## ${result.repoName} (${result.matches.length} matches)`;
    // 「相対パス:行番号: マッチ行テキスト」の形式で各行を生成
    const lines = result.matches.map(
      (m) => `${m.relativePath}:${m.lineNumber}: ${m.lineText}`,
    );

    // ヘッダとマッチ行を改行で結合し、1リポジトリ分のセクションとして追加
    sections.push([header, ...lines].join("\n"));
  }

  // セクション間に空行を挟んで全体を結合
  return sections.join("\n\n");
}
