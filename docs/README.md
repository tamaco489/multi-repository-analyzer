# multi-repository-analyzer

[日本語](./README.ja.md)

A local MCP server for cross-searching and analyzing multiple local repositories.
It uses ripgrep (`rg`) as the search engine and can be invoked as a tool from MCP clients such as Claude Code.

## Prerequisites

- Node.js >= 24
- [ripgrep](https://github.com/BurntSushi/ripgrep) — must be installed as a system binary (`rg` on your PATH). Claude Code's built-in `rg` alias is not available to MCP server subprocesses.
- [just](https://github.com/casey/just) (task runner)

```bash
# macOS
brew install ripgrep just
```

## Setup

### 1. Clone and Build

```bash
git clone https://github.com/tamaco489/multi-repository-analyzer.git
cd multi-repository-analyzer
npm install
npm run build
```

### 2. Configure Target Repositories

Copy the example files and edit them to match your environment.

```bash
just setup
```

Edit `.env` to set the actual paths of the target repositories.

```bash
REPO_A=/Users/yourname/src/repo-a
REPO_B=/Users/yourname/src/repo-b
REPO_C=/Users/yourname/src/repo-c
```

Edit `repos.yaml` to match your setup. Define `env_key` (the key name in `.env`), `labels`, `description`, and `priority_paths` for each repository.

```yaml
repositories:
  repo-a:
    env_key: REPO_A
    labels: [backend]
    description: "Backend API server"
    priority_paths:
      - src/

  repo-b:
    env_key: REPO_B
    labels: [frontend]
    description: "Frontend application"
    priority_paths:
      - src/
      - components/

search:
  max_results: 50
  context_lines: 3
  exclude_patterns:
    - node_modules
    - .git
    - vendor
    - dist
    - build
    - "*.min.js"
```

### 3. Register with Claude Code

Run the following command **in the project directory where you want to use the tools**:

```bash
claude mcp add multi-repo-analyzer node /path/to/multi-repository-analyzer/build/index.js
```

Replace `/path/to/multi-repository-analyzer` with the actual path where you cloned the repository.

After registration, restart Claude Code and call the `list_repos` tool. If it returns the repository list, the server is working correctly.

## MCP Tools

| Tool                           | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `list_repos`                   | List configured repositories                           |
| `search_code`                  | Cross-search multiple repositories with regex patterns |
| `find_api_callers`             | Find API endpoint call sites across repositories       |
| `find_cross_repo_dependencies` | Track dependencies between repositories                |
