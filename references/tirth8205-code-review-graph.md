---
title: "code-review-graph"
author: "tirth8205"
date: 2026-04-10
type: reference
tags: [tool, mcp-server, codebase-intelligence]
source: "https://github.com/tirth8205/code-review-graph"
version: "36777165 (2026-04-08)"
context: "Directly relevant — builds a persistent codebase knowledge graph to reduce tokens on code review and exploration tasks."
---

> **NOTE.** The README of `colbymchenry/codegraph` copies this tool's architecture diagrams, benchmark table, and eval command (`code-review-graph eval --all`) without attribution. This file is the original source.

## TL;DR

- Python MCP server (`pip install code-review-graph`) that indexes a codebase via Tree-sitter into a SQLite knowledge graph; exposes 22 MCP tools and 5 prompt templates.
- Reports 8.2× average token reduction on reviews (naive vs graph) and up to 49× on daily coding tasks (as reported, README).
- Auto-installs across Claude Code, Cursor, Windsurf, Zed, Continue, OpenCode, and Antigravity via `code-review-graph install`.
- 19 languages + Jupyter/Databricks notebooks; incremental updates under 2 seconds (as reported).
- Optional semantic search via sentence-transformers, Google Gemini embeddings, or MiniMax.
- Community detection (Leiden algorithm), wiki generation, interactive D3.js visualisation, and multi-repo registry — feature set significantly broader than comparable tools.
- 7,624 GitHub stars (as of 2026-04-08).

## What's novel / different

Among graph-based code intelligence tools, `code-review-graph` distinguishes itself by combining blast-radius analysis with execution flow tracing, community detection, and LLM-assisted wiki generation — all in a single Python package. The 22-tool MCP surface (vs the 14 tools in `deusdata-codebase-memory-mcp` or the single `codegraph_explore` in `colbymchenry/codegraph`) gives agents fine-grained access to refactoring suggestions, flow criticality ranking, and cross-repo search. The `code-review-graph install` auto-detection across 8 AI coding platforms is the most multi-platform install story in this category. Architecturally similar to `colbymchenry/codegraph` (TypeScript) — independent tools, not forks of each other; CRG launched after codegraph but rapidly eclipsed it.

## Architecture overview

### Core design

Repository parsed by Tree-sitter into SQLite nodes and edges. Blast-radius, dependency chains, and test-coverage gaps are pre-computed. Optional vector embeddings (sentence-transformers, Gemini, MiniMax) stored alongside for hybrid FTS5+vector search. Community detection via Leiden algorithm groups related code; execution flows trace call chains by criticality.

### Interface / API

22 MCP tools including: `get_impact_radius_tool`, `get_review_context_tool`, `query_graph_tool`, `semantic_search_nodes_tool`, `detect_changes_tool`, `refactor_tool`, `generate_wiki_tool`, `cross_repo_search_tool`. 5 prompt templates: `review_changes`, `architecture_map`, `debug_issue`, `onboard_developer`, `pre_merge_check`. Slash commands: `/code-review-graph:build-graph`, `/code-review-graph:review-delta`, `/code-review-graph:review-pr`.

### Dependencies

- Runtime: Python 3.10+
- Parser: Tree-sitter
- Storage: SQLite (`.code-review-graph/`); no external database
- Optional: sentence-transformers (local embeddings), igraph (community detection), ollama/Gemini/MiniMax (embeddings)
- Visualisation: D3.js (HTML output)

### Scope / limitations

- MRR 0.35 for keyword search (stated in benchmarks section — low).
- Small single-file changes may produce more tokens than naive file read (express benchmark: 0.7× reduction).
- Semantic embeddings require optional install and external model; disabled by default.
- Community detection requires optional `igraph` install.

## Deployment model

- Runtime: Python 3.10+, local machine
- Install: `pip install code-review-graph` or `pipx install code-review-graph`
- Storage: SQLite in `.code-review-graph/` directory
- Multi-platform auto-config: `code-review-graph install`

## Self-reported metrics

- 8.2× average token reduction across 6 repos (as reported, README); range 0.7×–16.4×
- Up to 49× token reduction on daily coding tasks (as reported, README — basis not specified)
- Incremental updates under 2 seconds (as reported)
- MRR 0.35 for keyword search (stated, README — low)

## Open questions

- **Relationship to colbymchenry/codegraph (resolved)**: independent tools, neither forked from the other. codegraph was created first (2026-01-18); CRG launched 2026-02-26. CRG is the more mature and widely adopted tool. codegraph's README copies CRG's diagram assets and benchmark table — the reverse is not true; CRG's README is the original source of this content.
- "Up to 49× token reduction on daily coding tasks" — no benchmark data or methodology given for this figure.
- No independent benchmark reproduction; `code-review-graph eval --all` runner (`evaluate/`) not verified against the reported numbers.
- Community detection quality not benchmarked; Leiden clustering on arbitrary codebases may produce noisy clusters.
- Active development pace (commits co-authored by Claude Opus 4) — review quality of AI-assisted commits for correctness.
