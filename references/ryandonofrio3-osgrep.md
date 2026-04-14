---
title: "osgrep"
author: "Ryandonofrio3"
date: 2026-04-14
type: reference
tags: [tool, cli, daemon, mcp-server]
source: "https://github.com/Ryandonofrio3/osgrep"
local_clone: ../tools/osgrep  # 9f2faf7e52783d622a583f5250f81ab24cee7864
version: "0.5.16"
context: "Local semantic code search CLI + Claude Code plugin with per-repo LanceDB vector store, tree-sitter chunking, and ColBERT reranking — directly relevant to session-level context injection and token reduction research."
---

## TL;DR

- npm-installable CLI (`npm install -g osgrep`) that indexes a codebase into a local LanceDB vector store and answers natural-language queries against it.
- Uses `tree-sitter` to split code at function/class boundaries before embedding, ensuring each chunk represents a complete logical unit.
- Ships a Claude Code plugin and an opencode plugin; also exposes an MCP server interface.
- Dual-channel search: queries "Code" and "Docs" embeddings separately, then reranks with ColBERT to prevent documentation from drowning out implementation results.
- Per-repo store isolation is automatic — derived from git remote URL or directory hash; no manual `--store` flags needed.
- Optional background daemon (`osgrep serve`) keeps the index hot for sub-second lookups; falls back to on-demand indexing without it.
- `osgrep skeleton` emits compressed file views (signatures, types, class structures only) with role annotations (`ORCH`, `DEFN`).
- `osgrep trace` walks the call graph upstream and downstream from a named symbol for impact analysis.
- Self-reports ~20% LLM token reduction and 30% speedup (as reported, README benchmark).
- 1,128 stars; Apache-2.0; built on [mgrep](https://github.com/mixedbread-ai/mgrep) by MixedBread.

## What's novel / different

Most code-search tools for agents either do keyword/AST search (no semantic understanding) or require an external vector DB. osgrep bundles the full pipeline — local ONNX embedding (~150 MB models, downloaded once), tree-sitter AST chunking, LanceDB storage, and ColBERT reranking — into a single npm package with zero external service dependencies. The combination of dual-channel search (separate Code / Docs indices reranked together) and role classification (ORCHESTRATION vs DEFINITION) is not present in close neighbours like codebase-memory-mcp or colbymchenry-codegraph. The `skeleton` command is a particularly agentic primitive: it produces a token-efficient structural summary of a file without requiring the agent to read it in full.

## Architecture overview

### Core design

osgrep is a Node.js CLI built on `commander`. On first invocation in a directory, it chunks the repo via `web-tree-sitter`, embeds chunks using `@huggingface/transformers` running ONNX models via `onnxruntime-node`, and writes vectors + metadata to a per-repo LanceDB store (`@lancedb/lancedb`). Subsequent searches query the stored index.

A producer/consumer pipeline decouples chunking from embedding: files are chunked concurrently (bounded thread pool via `piscina`), queued, embedded in fat batches, and bulk-written to LanceDB. Stale files are detected via anchor-row scans and removed with a single `IN` delete.

Search queries both a "Code" channel and a "Docs" channel independently, then merges and reranks results with ColBERT to balance implementation and documentation relevance.

Role classification labels each chunk as `ORCHESTRATION` (high cyclomatic complexity, many outbound calls) or `DEFINITION` (type/class declaration), giving agents a signal for where to read first. Structural boosting promotes function/class chunks and slightly downweights test/spec paths.

### Interface / API

- `osgrep <query>` — semantic search (auto-indexes on first run).
- `osgrep index` — explicit (re-)index with `--reset`, `--watch`, `--verbose` options.
- `osgrep serve` — start background daemon for hot-cache lookups.
- `osgrep trace <symbol>` — upstream + downstream call-graph traversal.
- `osgrep symbols` — list all indexed symbols.
- `osgrep skeleton <target>` — compressed structural view (target: file path, symbol name, or query).
- `osgrep list` — show all managed stores.
- `osgrep doctor` — health check (models, DB integrity).
- Claude Code plugin: `.claude-plugin/marketplace.json` + hooks for session start/stop.
- MCP server: exposed via `@modelcontextprotocol/sdk`.

### Dependencies

- **Embedding**: `@huggingface/transformers` + `onnxruntime-node` (local ONNX models, ~150 MB download).
- **Vector store**: `@lancedb/lancedb` + `apache-arrow`.
- **Chunking**: `web-tree-sitter`.
- **Metadata cache**: `lmdb`.
- **File watching**: `chokidar`.
- **Workers**: `piscina`.
- **CLI**: `commander`, `chalk`, `@clack/prompts`, `ora`.
- **Runtime**: Node.js; install via npm.
- No external services or API keys required.

### Scope / limitations

- Embedding models must be downloaded once (~150 MB); `osgrep setup` does this upfront, otherwise triggered on first search.
- Tree-sitter grammars shipped cover: TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, C, Ruby, PHP — unlisted languages fall back to line-based chunking (not confirmed in README).
- ColBERT reranking details (model, implementation) are not described in the README; may be a lightweight approximation.
- Background daemon (`osgrep serve`) improves latency but its fault-tolerance and restart behaviour are undocumented.
- Last push 2026-01-17 — no recent activity in 3 months.

## Deployment model

- **Language**: TypeScript / Node.js
- **Runtime**: Node.js (npm global install)
- **Storage**: per-repo LanceDB store in a global cache directory; `lmdb` for metadata
- **Models**: local ONNX (~150 MB, downloaded to cache)
- **OS support**: macOS, Linux, Windows (implied by npm)
- **Integration**: Claude Code plugin (hooks), opencode plugin, MCP server

## Benchmarks / self-reported metrics

All figures are as reported; none independently verified.

| Metric | Value | Source |
|---|---|---|
| LLM token reduction | ~20% | README Quick Start (as reported) |
| Speedup | ~30% | README Quick Start (as reported) |

A benchmark folder exists in the repo (`benchmark/`) with raw LLM responses for baseline vs. with-osgrep conditions and a `benchmark_opencode.csv`. The methodology (tasks, corpus, judge) is not described in the README; the benchmark HTML report is committed but not publicly hosted.

## Open questions / risks / missing details

- **Benchmark methodology undocumented**: 10 raw response files exist per condition but the task set, corpus, judge criteria, and token counting method are not described. The 20% / 30% headline figures cannot be reproduced from the README alone.
- **ColBERT implementation**: README names ColBERT reranking but the actual model and implementation are not specified; could be a learned or heuristic approximation.
- **Fallback chunking**: behaviour for languages outside the listed 11 (tree-sitter grammars) is unspecified.
- **Daemon reliability**: `osgrep serve` fault-tolerance, restart policy, and port/socket configuration are not documented.
- **Maintenance pace**: last push 2026-01-17; no commits in ~3 months. Upstream mgrep relationship and whether osgrep tracks mgrep changes is unclear.
- **Attribution / derivation**: built on mgrep (MixedBread); NOTICE file present but extent of shared code vs. novel contribution is unquantified.
- **Index size at scale**: no documentation on index size or performance for large monorepos (>100k files).
