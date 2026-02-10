/** ripgrep に渡す検索オプション */
export interface SearchOptions {
  /** 検索パターン (正規表現) */
  pattern: string;
  /** 検索対象ディレクトリパスの配列 */
  paths: string[];
  /** ファイル glob パターン (例: "*.ts") */
  glob?: string;
  /** 前後のコンテキスト行数 */
  contextLines: number;
  /** 最大結果数 */
  maxResults: number;
  /** 除外パターン */
  excludePatterns: string[];
}

/** 1件のマッチ情報 */
export interface SearchMatch {
  /** ファイルの絶対パス */
  absolutePath: string;
  /** リポジトリルートからの相対パス */
  relativePath: string;
  /** 行番号 */
  lineNumber: number;
  /** マッチした行のテキスト */
  lineText: string;
  /** マッチ部分の詳細 */
  submatches: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

/** リポジトリ単位の検索結果 */
export interface SearchResult {
  /** リポジトリ名 */
  repoName: string;
  /** マッチ一覧 */
  matches: SearchMatch[];
}

/** ripgrep --json 出力の match タイプ */
export interface RipgrepJsonMatch {
  type: "match";
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
    submatches: Array<{
      match: { text: string };
      start: number;
      end: number;
    }>;
  };
}

/** ripgrep --json 出力 (match 以外のタイプも存在するが、match のみ使用) */
export type RipgrepJsonLine = RipgrepJsonMatch | { type: string };
