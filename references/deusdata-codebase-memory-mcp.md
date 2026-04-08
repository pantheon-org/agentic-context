---
title: "codebase-memory-mcp"
author: "DeusData"
date: 2026-04-08
type: reference
tags: [tool, mcp, code-intelligence, knowledge-graph, context-compression]
source: "https://github.com/DeusData/codebase-memory-mcp"
version: "v2.6.0"
context: "Reduces context window usage in agentic coding workflows by replacing file-by-file grep with structured graph queries. Directly relevant to the compression & context-efficiency axis."
---

## TL;DR

- MCP server that indexes a codebase into a persistent SQLite knowledge graph via tree-sitter AST parsing across 66 languages.
- Ships as a single static binary (C, zero runtime dependencies) for macOS, Linux, and Windows — install in one command.
- Claims 99.2% token reduction: 5 structural queries consumed ~3,400 tokens versus ~412,000 tokens via file-by-file grep (as reported, README benchmark).
- Provides 14 MCP tools covering search, call-graph traversal, architecture overview, Cypher-like queries, dead-code detection, and cross-service HTTP linking.
- Background watcher auto-syncs on file changes; supports multi-agent concurrent access to a shared index.
- Supports Louvain community detection for functional module clustering and ADR management.
- Benchmarks 1,324 GitHub stars as of 2026-04-06; 434 commits; 2,586 passing tests (as reported, repo badges).

## What's novel / different

Most code-intelligence tools for LLMs (e.g. SocratiCode) rely on Docker, vector embeddings, and a separate database service. codebase-memory-mcp is a single self-contained C binary with vendored tree-sitter grammars that builds and persists the full knowledge graph in an in-memory then on-disk SQLite database — no Docker, no API keys, no embeddings pipeline. The key differentiator is the RAM-first indexing pipeline (LZ4 HC compression, fused Aho-Corasick pattern matching) that keeps the full Linux kernel index under 3 minutes and releases memory immediately after. The 14 MCP tools surface structural queries (call paths, impact radii, HTTP route matching, dead-code detection) that are otherwise intractable with grep-based context injection, making this a direct context-budget optimization layer rather than a RAG retrieval layer.

## Architecture overview

### Core design

The server is written in pure C. Source layout (from README):

```text
src/
  main.c              Entry point (MCP stdio server + CLI + install/update/config)
  mcp/                MCP server (14 tools, JSON-RPC 2.0, session detection, auto-index)
  cli/                Install/uninstall/update/config (10 agents, hooks, instructions)
  store/              SQLite graph storage (nodes, edges, traversal, search, Louvain)
  pipeline/           Multi-pass indexing (structure → definitions → calls → HTTP links → config → tests)
  cypher/             Cypher query lexer, parser, planner, executor
  discover/           File discovery (.gitignore, .cbmignore, symlink handling)
  watcher/            Background auto-sync (git polling, adaptive intervals)
  traces/             Runtime trace ingestion
  ui/                 Embedded HTTP server + 3D graph visualization
  foundation/         Platform abstractions (threads, filesystem, logging, memory)
internal/cbm/         Vendored tree-sitter grammars (66 languages) + AST extraction engine
```

Graph data model: nodes labelled `Function`, `Class`, `Variable`, `Route`, `Module`, `Resource`; edges typed `CALLS`, `IMPORTS`, `HTTP_CALLS`, `INHERITS`, `DEFINES`. A subset of Cypher is supported (`MATCH`, `WHERE`, `RETURN`, `ORDER BY`, `LIMIT`); `WITH`, `COLLECT`, and mutations are not supported.

Multi-pass indexing pipeline: structure → definitions → calls → HTTP links → config → tests. LSP-style hybrid type resolution is available for Go, C, and C++.

### Interface / API

14 MCP tools exposed over JSON-RPC 2.0 on stdio:

| Tool | Purpose |
|------|---------|
| `index_repository` | Index a repo path into the knowledge graph |
| `list_projects` | List indexed projects |
| `search_graph` | Structured search by label, name pattern, file, degree filters |
| `trace_call_path` | BFS traversal — callers and callees, depth 1–5 |
| `detect_changes` | Map git diff to affected symbols + blast radius |
| `query_graph` | Execute Cypher-like graph queries (read-only) |
| `get_graph_schema` | Node/edge counts and relationship patterns |
| `get_code_snippet` | Source code for a function by qualified name |
| `get_architecture` | Codebase overview: languages, packages, routes, hotspots, clusters |
| `search_code` | Grep-like text search within indexed files |
| `manage_adr` | CRUD for Architecture Decision Records |
| `ingest_traces` | Ingest runtime traces to validate HTTP_CALLS edges |
| `delete_project` | Remove a project from the index |
| `index_status` | Check indexing status of a project |

Every tool is also available via CLI: `codebase-memory-mcp cli <tool_name> '<json_args>'`.

Auto-detects and configures 10 agents on `install`: Claude Code, Codex CLI, Gemini CLI, Zed, OpenCode, Antigravity, Aider, KiloCode, VS Code, OpenClaw.

### Dependencies

Zero runtime dependencies. All tree-sitter grammars are vendored and compiled into the binary. SQLite is embedded. No Docker, no external database, no API keys required.

Build-from-source dependencies: GCC or Clang, `make`, Python 3 (grammar fetch script). The `internal/cbm` directory contains vendored tree-sitter grammars.

### Scope / limitations

- Cypher subset is limited: no `WITH`, no `COLLECT`, no `OPTIONAL MATCH`, no mutations.
- LSP-style type resolution available only for Go, C, and C++; other languages rely on heuristic call matching.
- Language quality is tiered: Excellent (e.g. C, Python, Go, Rust) / Good (e.g. TypeScript, Java, Ruby) / Functional (OCaml, Haskell). Plus/Functional tier quality is uncharacterised beyond tier label.
- The token-savings benchmark uses a single example scenario (5 structural queries on one repo); no controlled study across diverse repos or query types.
- The 99.2% reduction figure compares graph queries against naive file-by-file grep — not against optimised RAG retrieval.
- Windows SmartScreen warning for unsigned binary; no code-signing in place.
- No authentication or access control on the MCP server or the graph UI.

## Deployment model

- **Runtime**: Single static C binary, no interpreter or VM required.
- **Platforms**: macOS arm64/amd64, Linux arm64/amd64, Windows amd64.
- **Install**: Download pre-built tarball from GitHub Releases, run `codebase-memory-mcp install` — auto-configures detected agents.
- **Storage**: `~/.cache/codebase-memory-mcp/` — SQLite files, one per indexed project.
- **Background watcher**: git polling with adaptive intervals for auto-sync on file changes.
- **Graph UI** (optional): Embedded HTTP server on `localhost:9749`, served by the `ui` binary variant.
- **Multi-agent**: Multiple agents share a single on-disk index; concurrent access handled internally.

## Benchmarks / self-reported metrics

All figures are from the README unless otherwise noted. None are independently verified.

| Operation | Time | Notes |
|-----------|------|-------|
| Linux kernel full index | 3 min | 28M LOC, 75K files → 2.1M nodes, 4.9M edges (as reported, README) |
| Linux kernel fast index | 1m 12s | 1.88M nodes (as reported, README) |
| Django full index | ~6s | 49K nodes, 196K edges (as reported, README) |
| Cypher query | <1ms | Relationship traversal (as reported, README) |
| Name search (regex) | <10ms | SQL LIKE pre-filtering (as reported, README) |
| Dead code detection | ~150ms | Full graph scan (as reported, README) |
| Trace call path (depth=5) | <10ms | BFS traversal (as reported, README) |

**Token efficiency**: 5 structural queries on one repo consumed ~3,400 tokens via codebase-memory-mcp versus ~412,000 tokens via file-by-file grep — a 99.2% reduction (as reported, README). Benchmark hardware: Apple M3 Pro.

**Test suite**: 2,586 passing tests (as reported, repo badge).

## Open questions / risks / missing details

- The 99.2% token reduction is a single anecdote, not a controlled study. No distribution of savings across query types, repo sizes, or language mixes is provided.
- "120x fewer tokens" (in Why section) and "99% fewer tokens" (headline) are arithmetically consistent but vary in presentation — the exact scenario matters.
- Tiered language quality ("Functional" < 75%) is unexplained: what does 75% mean? Recall on function definitions? No methodology is described.
- LSP-style type resolution is limited to Go, C, C++. Dynamic languages (Python, JS, Ruby) rely on heuristic matching; false-positive call edges are possible and unquantified.
- No adversarial testing: malformed source files, circular imports, very deep call stacks.
- Multi-agent concurrent access claims are unspecified: no locking protocol or conflict-resolution documentation in the README.
- Graph UI has no authentication; anyone with network access to `localhost:9749` can read the index.
- No changelog or migration guide visible in the README for breaking schema changes across versions.
- Windows binary is unsigned; supply-chain verification relies solely on `checksums.txt`.
- No external benchmark or reproducible evaluation dataset is linked; all performance claims are author-run.
