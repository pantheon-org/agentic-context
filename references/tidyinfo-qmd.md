---
title: "qmd"
author: "tidyinfo (tobil)"
date: 2026-04-08
type: reference
tags: [tool, cli, mcp-server, library, daemon]
source: "https://github.com/tidyinfo/qmd"
version: "7ed0ef3041e7 (2026-03-03)"
context: "Local knowledge-base search engine with hybrid BM25+vector search and MCP server; directly relevant to session-level context tooling and agent memory retrieval."
---

# qmd

## TL;DR

- Single-binary (~10 MB) Rust CLI that indexes local markdown files and provides BM25 full-text, vector semantic, and hybrid search with LLM query expansion.
- Ships an MCP server (stdio or HTTP transport) exposing `qmd_search`, `qmd_get`, `qmd_collections`, and `qmd_status` tools for AI agent integration.
- All storage is local SQLite: BM25 via FTS5, vector search via statically-linked `sqlite-vec` — no external database or network service required.
- Hybrid search uses Reciprocal Rank Fusion (K=60) to merge BM25 and vector result lists; a fine-tuned 1.7B GGUF model handles query expansion.
- Incremental indexing is content-hash-based; supports multiple named indexes (`--index NAME`) and per-collection glob masks.
- Can run as a background HTTP daemon (`qmd mcp --http --daemon`) for persistent agent access.
- Dual-licensed MIT / Apache-2.0; build-from-source only (no pre-built releases observed).

## What's novel / different

Most local search tools offer either BM25 (fast, exact) or vector search (semantic, slower) but not both in a single zero-dependency binary. qmd's distinguishing characteristic is that it bakes all three retrieval modes — FTS5 BM25, `sqlite-vec` vector search, and LLM-based query expansion with reranking — into a single ~10 MB binary with no runtime library dependencies beyond glibc 2.17. This sidesteps the common requirement for Docker, Qdrant, Postgres, or a separate embedding server. The MCP server is a first-class output (not an afterthought wrapper), meaning AI coding assistants can retrieve from personal knowledge bases without any network infrastructure. Adjacent tools like SocratiCode target codebase intelligence with AST graphs; qmd is narrower and more portable, targeting markdown notes and documentation corpora for individual developers.

## Architecture overview

### Core design

- **BM25 layer**: SQLite FTS5 full-text index. Queries execute purely in SQLite without a separate index file.
- **Vector layer**: `sqlite-vec` (vec0 extension) statically linked into the binary — no `.so` dependency. Embeddings are generated locally via `llama.cpp` (`llama-cpp-2` crate) using a 384-dim GGUF model (`embeddinggemma-300M-Q8_0.gguf`).
- **Hybrid search**: RRF fusion with K=60 merges BM25 and vector result lists. Deep/query mode adds a 1.7B query-expansion model (`qmd-query-expansion-1.7B-q4_k_m.gguf`) and a reranker (`qwen3-reranker-0.6b-q8_0.gguf`).
- **Ingestion**: `ignore` crate provides `.gitignore`-aware file traversal; content-hash-based diffing ensures incremental re-indexing.
- **Multiple indexes**: Each named index (`--index NAME`) gets its own `~/.cache/qmd/NAME.sqlite` and `~/.config/qmd/NAME.yml` config.

### Interface / API

- **CLI**: `qmd search`, `qmd vsearch`, `qmd query`, `qmd add`, `qmd index`, `qmd update`, `qmd collections`, `qmd models`.
- **MCP server (stdio)**: `qmd mcp` / `qmd serve` — JSON-RPC 2.0 over stdin/stdout. Non-protocol output to stderr.
- **MCP server (HTTP)**: `qmd mcp --http --port 8181`; supports background daemon mode (`--daemon`).
- **Exposed MCP tools**: `qmd_search` (BM25, args: query, limit?, collection?), `qmd_get` (retrieve body by docid), `qmd_collections` (list), `qmd_status` (health/stats).

### Dependencies

- Runtime: glibc 2.17+ (Linux); no OpenSSL (uses `rustls`); no external database.
- Models (downloaded separately via `qmd models setup`): `embeddinggemma-300M-Q8_0.gguf` (embeddings), `qwen3-reranker-0.6b-q8_0.gguf` (reranking), `qmd-query-expansion-1.7B-q4_k_m.gguf` (query expansion, hosted at `tobil/qmd-query-expansion-1.7B-gguf` on HuggingFace).
- Build: Rust edition 2024, `AWS_LC_SYS_NO_PREFIX=1` / `CFLAGS=-fno-builtin-memcmp`; optional `cargo-zigbuild` for GLIBC 2.17 cross-compile.

### Scope / limitations

- Indexes markdown files only (glob mask configurable); not designed for code or binary file search.
- MCP server exposes BM25 search only (`qmd_search`); vector/hybrid search is not exposed via MCP as of the triaged commit.
- Vector search and deep query require downloading GGUF models (~300 MB+ for the embedding model alone); BM25-only usage has no model dependency.
- Build-from-source only — no Homebrew formula, no pre-built release binaries observed at triage time.
- No authentication or access control on the HTTP MCP transport.

## Deployment model

- **Runtime**: Single Rust binary; Linux (GLIBC 2.17+) primary target; macOS supported (build from source).
- **Storage**: SQLite at `~/.cache/qmd/NAME.sqlite`; YAML config at `~/.config/qmd/NAME.yml`; GGUF models at `~/.cache/qmd/models/`.
- **MCP transport**: stdio (default) or HTTP with optional background daemon.
- **Language**: Rust (edition 2024).
- **Dependencies**: None at runtime except glibc; GGUF model files required for vector/hybrid modes.

## Benchmarks / self-reported metrics

- Binary size: ~10 MB (as reported, README).
- GLIBC compatibility: 2.17+ (CentOS 7+) achievable via `cargo-zigbuild` (as reported, README).
- No latency, recall, or precision benchmarks are provided in the README or documentation at the triaged commit.

## Open questions / risks / missing details

- No pre-built release binaries or package manager formula observed; adoption friction is high for non-Rust developers.
- The MCP server only exposes `qmd_search` (BM25); hybrid/vector search is not accessible to agents without using the CLI. It is unclear whether this is intentional or planned for a future release.
- The custom query-expansion model (`qmd-query-expansion-1.7B`) is hosted by the same author (`tobil`) on HuggingFace; its training data, evaluation results, and maintenance status are not documented.
- No benchmark comparing retrieval quality against alternatives (e.g., ripgrep + embeddings, SocratiCode) is provided.
- HTTP MCP transport has no authentication mechanism documented — running as a daemon on localhost exposes the index to any local process.
- Repository has 21 commits and 2 stars as of triage date; maturity and long-term maintenance are unverified.
- The relationship between the GitHub org `tidyinfo` and the author handle `tobil` (used in the HuggingFace model slug) is not clarified in the repository.
