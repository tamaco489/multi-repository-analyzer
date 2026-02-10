/** 検索設定のデフォルト値。repos.yaml で search セクションが省略された場合に使用する */
export const SEARCH_DEFAULTS = {
  MAX_RESULTS: 50,
  CONTEXT_LINES: 3,
  EXCLUDE_PATTERNS: [] as string[],
} as const;
