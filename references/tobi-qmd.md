---
title: "qmd"
author: "tobi"
date: 2026-04-09
type: reference
tags: [tool, cli, mcp-server, node]
source: "https://github.com/tobi/qmd"
version: "v2.1.0 (2026-04-05)"
context: "On-device hybrid search engine for markdown knowledge bases; MCP server with lex/vec/hyde query modes; directly relevant to agent memory retrieval and session-level context tooling."
---

# qmd

## TL;DR

- TypeScript/Node.js CLI that indexes local markdown files and exposes BM25, vector, and hybrid search with LLM query expansion and reranking — all running locally via `node-llama-cpp`.
- Ships an MCP server (stdio or HTTP) exposing `query`, `get`, `multi_get`, and `status` tools; also has a Claude Code plugin (`claude plugin marketplace add tobi/qmd`).
- Storage is a single SQLite file (`~/.cache/qmd/index.sqlite`) with FTS5 for BM25 and `sqlite-vec` for vectors.
- Three GGUF models auto-downloaded on first use: embeddings (~300 MB), reranker (~640 MB), query expansion (~1.1 GB).
- 10 versioned releases; installable via `npm install -g @tobilu/qmd` or `bun install -g @tobilu/qmd`.
- 20.3k stars, 1.2k forks; MIT license.

## What's novel / different

Most local search tools offer BM25 or vector search but not all three retrieval modes (BM25, dense vector, HyDE) in a single installable package with a first-class MCP interface. The MCP `query` tool accepts typed sub-queries (`lex`/`vec`/`hyde`) combined via RRF + reranking, meaning the agent controls the retrieval strategy per query. The fine-tuned query-expansion model (`tobil/qmd-query-expansion-1.7B`) is purpose-built for this pipeline. AST-aware chunking via tree-sitter (TS, JS, Python, Go, Rust) improves retrieval quality on code files. The Claude Code plugin path (`claude plugin marketplace add tobi/qmd`) provides the tightest integration of any tool surveyed so far.

## Architecture overview

### Core design

- **Language**: TypeScript (79.9%), Python (17.8%), Shell (1.7%).
- **Runtime**: Node.js >= 22 or Bun >= 1.0.0. macOS requires `brew install sqlite` for extension support.
- **BM25 layer**: SQLite FTS5 full-text index.
- **Vector layer**: `sqlite-vec` extension; 384-dim embeddings generated locally via `node-llama-cpp`.
- **Hybrid search**: Reciprocal Rank Fusion (K=60) merges BM25 and vector result lists; LLM-based query expansion and reranking applied on top.
- **Chunking**: ~900-token chunks with 15% overlap and smart boundary detection. AST-aware chunking (`--chunk-strategy auto`) uses tree-sitter for TS, JS, Python, Go, and Rust files; markdown always uses regex.
- **Storage**: `~/.cache/qmd/index.sqlite` — schema includes `collections`, `documents`, `documents_fts`, `content_vectors`, `vectors_vec`, `llm_cache`.

### GGUF models (auto-downloaded to `~/.cache/qmd/models/`)

| Model | Purpose | Size |
|---|---|---|
| `embeddinggemma-300M-Q8_0` | Vector embeddings (default; English-optimized) | ~300 MB |
| `qwen3-reranker-0.6b-q8_0` | Re-ranking | ~640 MB |
| `qmd-query-expansion-1.7B-q4_k_m` | Query expansion (fine-tuned by author) | ~1.1 GB |

Custom embedding model configurable via `QMD_EMBED_MODEL` env var (e.g. `Qwen3-Embedding-0.6B` for CJK corpora).

### Interface / API

- **CLI**: `qmd search` (BM25), `qmd vsearch` (vector), `qmd query` (hybrid + reranking), `qmd embed`, `qmd add`, `qmd index`, `qmd collections`, `qmd models`, `qmd status`.
- **MCP server (stdio)**: `qmd mcp` — JSON-RPC 2.0 over stdin/stdout.
- **MCP server (HTTP)**: `qmd mcp --http [--port 8080] [--daemon]` on `localhost:8181`; endpoints `POST /mcp` (Streamable HTTP) and `GET /health`. Models stay loaded in VRAM; embedding/reranking contexts disposed after 5 min idle.
- **MCP tools**:
  - `query` — hybrid search with typed sub-queries (`lex`/`vec`/`hyde`), RRF + reranking; supports `collection` scoping and `intent` field.
  - `get` — retrieve a document by path or docid (6-char hash); fuzzy matching on miss.
  - `multi_get` — batch retrieve by glob pattern or comma-separated list.
  - `status` — index health and collection info.

### Claude Code integration

```shell
# Recommended: install as a Claude Code plugin
claude plugin marketplace add tobi/qmd
claude plugin install qmd@qmd

# Or configure MCP manually in ~/.claude/settings.json
```

## Deployment model

- **Runtime**: Node.js >= 22 or Bun >= 1.0.0.
- **Install**: `npm install -g @tobilu/qmd` or `bun install -g @tobilu/qmd`; 10 versioned releases (v2.1.0 latest).
- **Storage**: Single SQLite file at `~/.cache/qmd/index.sqlite`; models at `~/.cache/qmd/models/`.
- **MCP transport**: stdio (default) or HTTP daemon.
- **Language**: TypeScript.
- **License**: MIT.

## Benchmarks / self-reported metrics

No latency, recall, or precision benchmarks are provided.

## Open questions / risks / missing details

- Total model footprint on first use is ~2 GB (~300 MB + ~640 MB + ~1.1 GB); BM25-only usage (`qmd search`) requires no models.
- The query-expansion model (`tobil/qmd-query-expansion-1.7B`) is hosted by the author on HuggingFace; training data and evaluation are not documented.
- HTTP MCP transport has no documented authentication — running as a daemon exposes the index to any local process.
- AST-aware chunking (`--chunk-strategy auto`) is opt-in; tree-sitter grammars are optional and fall back to regex if unavailable.
- When switching embedding models, all documents must be re-embedded (`qmd embed -f`); vectors are not cross-compatible.
- macOS requires system SQLite from Homebrew (`brew install sqlite`) for extension support — this is not a zero-dep install on macOS.
