---
title: "SocratiCode"
author: "giancarloerra / Altaire Limited (sponsor)"
date: 2026-04-08
type: reference
tags: [tool, mcp, codebase-intelligence, semantic-search, code-graph, context-reduction]
source: "https://github.com/giancarloerra/SocratiCode"
local_clone: ../tools/giancarloerra-socraticode
version: "1.3.2"
context: "MCP server that combines hybrid semantic search and AST-based dependency graphs to reduce tokens consumed during codebase navigation; directly relevant to context-reduction and session-level tooling."
---

# SocratiCode

## TL;DR

- MCP server (TypeScript/Node.js) that provides AI assistants with deep codebase intelligence via hybrid semantic + BM25 search and polyglot dependency graphs.
- Zero-configuration by default: runs via `npx socraticode` against a local Docker daemon for vector storage.
- Claims 61.5% fewer tokens consumed and 84% fewer tool calls vs. grep-based navigation (as reported, README benchmark).
- Supports local (SQLite + in-process HNSW) and cloud (OpenAI/Gemini embeddings + Qdrant) deployment modes.
- Indexes supplementary context artifacts: database schemas, API specs, infrastructure configs, architecture docs.
- Licensed AGPL-3.0; 787 GitHub stars as of 2026-04-08; actively maintained (last commit same day).
- Ships Claude Code plugin with built-in workflow skills; also compatible with VS Code, Cursor, OpenCode.

## What's novel / different

SocratiCode targets a specific narrow problem — replacing grep-and-read loops with a single hybrid retrieval call — and integrates AST-aware chunking with RRF-fused dense+BM25 search into one zero-config package. Adjacent tools like codebase-memory-mcp or Greptile require more setup or are cloud-hosted; SocratiCode's differentiator is the combination of local-first privacy (no data leaves the machine by default), polyglot dependency-graph queries (imports/dependents, circular dependency detection, Mermaid visualisation), and searchable non-code artifacts (schemas, OpenAPI, Terraform, architecture docs) in a single focused MCP server with no required configuration.

## Architecture overview

### Core design

Hybrid retrieval: dense vector embeddings (local in-process HNSW by default; optionally Qdrant) fused with BM25 keyword index using Reciprocal Rank Fusion (RRF). Chunks are produced via AST-aware parsing rather than fixed line windows, preserving function/class boundaries. A separate graph engine builds a polyglot import/dependency graph via static analysis, stored and queryable independently of the search index. Both indexes are persisted across sessions.

### Interface / API

Exposes MCP tools:

- `codebase_search` — hybrid semantic + keyword search with optional file/language filters
- `codebase_status` — index status and chunk count
- `codebase_graph_build` / `codebase_graph_query` / `codebase_graph_stats` / `codebase_graph_circular` / `codebase_graph_visualize` / `codebase_graph_status` / `codebase_graph_remove`
- Management tools for indexing control and multi-project support

### Dependencies

Runtime: Node.js >= 18, Docker (for default local vector storage). Optional cloud path: OpenAI or Google Gemini for embeddings, Qdrant for vector store. No required API keys for default local mode.

### Scope / limitations

- Static analysis only; no runtime tracing.
- Graph build runs in background — requires polling for completion on large repos.
- Benchmark was conducted on one large repo (VS Code, 2.45M lines); generalisability to heterogeneous codebases unverified.
- AGPL-3.0 licence restricts commercial embedding in proprietary products without source disclosure.

## Deployment model

- **Runtime**: Node.js >= 18 via `npx -y socraticode`
- **Language**: TypeScript
- **Storage (default)**: local Docker container for vector index + SQLite for BM25 and metadata
- **Storage (cloud)**: Qdrant + OpenAI / Google Gemini embeddings
- **Privacy**: fully local by default; no data leaves the machine unless cloud mode is explicitly configured
- **Distribution**: npm package `socraticode` v1.3.2

## Benchmarks / self-reported metrics

All figures from README benchmark section (as reported); methodology details and raw data not independently verified.

| Metric | grep baseline | SocratiCode | Reduction |
|---|---|---|---|
| Tokens consumed (5 questions, VS Code repo) | 96,485 | 37,086 | 61.5% (as reported) |
| Tool calls | ~31 (6–7/question) | 5 (1/question) | 84% (as reported) |
| Search latency | 2–3.5 s/query | 60–90 ms/query | ~37× (as reported) |

- Repository used: VS Code (2.45M lines of code) (as reported)
- Authors note the benchmark is "conservative for the grep approach" as it assumes prior file knowledge (as reported, README)
- External evaluations cited: RepoEval and SWE-bench show AST-aware semantic retrieval improves recall by up to 4.3 points and code-generation accuracy by ~2.7 points vs. fixed-line chunks (as reported, README — original sources not directly linked)

## Open questions / risks / missing details

- Benchmark conducted on a single repository (VS Code); performance on polyglot monorepos, small repos, or dynamically typed languages (Python, Ruby) not reported.
- The cited RepoEval/SWE-bench figures lack direct citations in the README — cannot verify which exact evaluation setup or model was used.
- AGPL-3.0 licence: incompatible with proprietary embedding without open-sourcing the enclosing work; needs legal review before vendoring.
- Docker dependency may be a friction point in CI/CD or restricted environments; a pure-in-process fallback is available but not the default.
- No published evals comparing directly against codebase-memory-mcp, Greptile, or Sourcegraph Cody.
- Graph build is asynchronous and requires polling; no streaming progress; could be slow on initial index of large repos.
- Version pinning note: `npx` caches after first run; `npx -y socraticode@latest` or cache-clearing needed to pick up updates.
