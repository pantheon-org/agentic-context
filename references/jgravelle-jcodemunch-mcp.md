---
title: "jCodeMunch MCP"
author: "jgravelle"
date: 2026-04-08
type: reference
tags: [tool, mcp-server, cli, library]
source: "https://github.com/jgravelle/jcodemunch-mcp"
local_clone: ../tools/jgravelle-jcodemunch-mcp
version: "v1.24.1"
context: "Token-efficient code retrieval for AI agents; directly relevant to context window management and token budgeting research"
---

## TL;DR

- Local-first MCP server that indexes a codebase once with tree-sitter AST parsing, then serves symbol-level retrieval to AI agents instead of whole-file reads.
- Claims 95%+ reduction in code-reading token usage in retrieval-heavy workflows (as reported, README benchmark harness).
- Extracts symbols (functions, classes, methods, constants, types) with stable IDs and byte-offset pointers; retrieval is deterministic rather than semantic.
- Stores the index in SQLite (WAL mode) under `~/.code-index/`; supports incremental re-indexing triggered by file-system watch or git worktree events.
- Exposes MCP tool categories: indexing, discovery/outlines, retrieval, search, and import-graph / relationship analysis.
- Dual-use license: free for non-commercial use; paid tiers required for commercial deployment ($79 – $2,249).
- Available as a PyPI package (`pip install jcodemunch-mcp`); requires Python ≥ 3.10.

## What's novel / different

Most MCP code-exploration tools either expose raw file content or rely on opaque semantic embeddings. jCodeMunch takes a middle path: it uses tree-sitter grammars for deterministic, language-aware symbol extraction, stores metadata and byte offsets in SQLite, and retrieves exact source spans on demand. This preserves source fidelity (no hallucinated paraphrasing) while drastically shrinking the context footprint relative to brute-force file reads. The import-graph and relationship analysis layer (`find_importers`, `get_dependency_graph`, `check_references`) extends the model beyond static lookup toward lightweight code intelligence — dead-code detection, impact analysis — without requiring a language server or LSP process.

## Architecture overview

### Core design

Index-once, query-cheap architecture built around three layers:

1. **Parsing layer** — tree-sitter grammars per language; extracts symbol type, name, docstring, decorator, and byte-start/end offsets. Falls back to signature when no docstring is present.
2. **Storage layer** — SQLite (WAL mode) per indexed repository, holding `meta`, `symbols`, `files`, `imports`, `raw_cache`, and `content_blob` tables. Cached raw source files are written alongside the DB to support exact byte-offset retrieval. Index path defaults to `~/.code-index/`; configurable via `CODE_INDEX_PATH`.
3. **Retrieval layer** — MCP tool surface. All responses include an `_meta` envelope. Key retrieval operations:

  - `get_symbol_source` — exact code span by symbol ID and byte offset
  - `get_context_bundle` — scoped context around a symbol
  - `get_ranked_context` — query-driven, token-budgeted assembly using BM25 + PageRank
  - `get_file_outline` / `get_repo_outline` — structural navigation without reading file bodies

Summarization pipeline (docstring → AI batch → signature fallback) enriches search relevance but is not the retrieval backbone.

### Interface / API

MCP server exposing tool groups:

| Group | Key tools |
|---|---|
| Indexing / repo management | `index_repo`, `index_folder`, `index_file`, `list_repos`, `resolve_repo`, `invalidate_cache` |
| Discovery / outlines | `get_repo_outline`, `get_file_tree`, `get_file_outline`, `suggest_queries` |
| Retrieval | `get_file_content`, `get_symbol_source`, `get_context_bundle`, `get_ranked_context` |
| Search | `search_symbols`, `search_text`, `search_columns` |
| Relationship / impact | `find_importers`, `find_references`, `get_dependency_graph`, `check_references`, `get_related_symbols` |

CLI mirrors the MCP surface: `list`, `index`, `outline`, `search`, `get`, `text`, `file`, `invalidate`, `watch`, `watch-claude`.

### Dependencies

- Python ≥ 3.10
- tree-sitter and per-language grammar packages (Python, JS, TS, TSX, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala)
- SQLite (stdlib `sqlite3` module)
- Optional: Anthropic / Gemini / local OpenAI-compatible API for AI-assisted summaries

### Scope / limitations

- Macro-generated or dynamically defined symbols are invisible to the parser.
- Anonymous arrow functions without assigned names are not indexed (JavaScript).
- Deep inner-class nesting may be flattened (Java).
- Per-query token reduction varies: 79.7% (dense query) to 99.8% (sparse query); aggregate 95% figure is across 15 task-runs on 3 repos (as reported).
- Commercial use requires a paid license; license terms not embedded in the Python package metadata (PyPI `license` field is `None`).

## Deployment model

- **Runtime**: Python ≥ 3.10, installed via `pip install jcodemunch-mcp`
- **Language**: Python
- **Interface**: MCP server (stdio or SSE transport); also a CLI
- **Storage**: Local SQLite databases under `~/.code-index/` (configurable); no network storage required
- **Index scope**: local filesystem paths or GitHub repo URLs (cloned locally before indexing)
- **Watch mode**: optional `watch` / `watch-claude` subcommands for incremental hot-reindexing

## Benchmarks / self-reported metrics

Benchmark run against 3 open-source repos (expressjs/express, fastapi/fastapi, gin-gonic/gin), 15 task-runs total:

| Repository | Baseline tokens | jCodeMunch avg tokens | Reduction |
|---|---:|---:|---:|
| expressjs/express (34 files, 117 symbols) | 73,838 | ~1,300 | **98.4%** |
| fastapi/fastapi (156 files, 1,359 symbols) | 214,312 | ~15,600 | **92.7%** |
| gin-gonic/gin (40 files, 805 symbols) | 84,892 | ~1,730 | **98.0%** |
| Grand total | 1,865,210 | 92,515 | **95.0%** |

Per-query range: 79.7% – 99.8% reduction (as reported, README; reproducible via `python benchmarks/harness/run_benchmark.py`).

External mentions:

- Artur Skowroński (VirtusLab): "roughly 80% fewer tokens, or 5× more efficient" (as reported, README).
- Julian Horsey (Geeky Gadgets): "3,850 tokens [vs baseline]" (as reported, README).

## Open questions / risks / missing details

- Benchmark repos are small-to-medium open-source codebases; reduction may be lower on large monorepos with deeply interdependent files requiring broad context.
- No independent reproduction of benchmark figures; all numbers come from the author's own harness.
- License field absent from PyPI metadata; commercial boundary enforcement relies entirely on self-reporting.
- AI-assisted summarization backends (Anthropic, Gemini) send code content to external APIs — relevant to any private-codebase deployment.
- No versioned grammar lockfile visible in the README; tree-sitter grammar updates could silently alter extraction behaviour between installs.
- `get_ranked_context` uses BM25 + PageRank weighting; ranking quality on codebases that differ significantly from the benchmark set is untested.
- Watch-mode debounce interval and accuracy on high-churn repositories not documented.
