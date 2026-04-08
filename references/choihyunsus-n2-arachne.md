---
title: "Arachne (n2-arachne)"
author: "choihyunsus"
date: 2026-04-08
type: reference
tags: [tool, library, mcp-server, cli]
source: "https://github.com/choihyunsus/n2-arachne"
version: "v4.0.3"
context: "Directly relevant to context assembly and token budgeting — assembles code context to fit within LLM context windows using hybrid search and dependency traversal."
---

## TL;DR

- Assembles code context (file tree, target file, dependency graph, semantic neighbours) into a single payload sized to a token budget — designed to eliminate irrelevant files from LLM context.
- Exposes capabilities as an MCP server; works with Claude, Gemini, GPT, and Ollama without provider lock-in.
- Hybrid retrieval: BM25 keyword search combined with semantic vector search via Ollama embeddings.
- Dependency-aware: follows import chains across JS/TS, Python, Rust, Go, and Java.
- All indexing is local-first via SQLite; zero data leaves the machine.
- Incremental re-indexing means only changed files are re-processed; subsequent starts are sub-second.
- v4.0 ("Titanium Edition") rewrote hot paths in Rust (napi-rs) and C++ SIMD (sqlite-vec) for performance.

## What's novel / different

Most context-retrieval tools perform either keyword search or semantic search in isolation and return raw file contents without token-budget awareness. Arachne's distinguishing feature is its **4-layer assembly** model: it stacks a project tree view, the directly targeted file, its transitive dependency chain, and semantically similar files — then pages the result to fit within a hard token cap. This means the caller never needs to manually select files; the tool does so algorithmically, prioritising structural relevance (imports) over surface-level textual similarity alone. The combination of BM25 + vector search with dependency-graph traversal inside a budget-aware pager is not found as a single packaged primitive in comparable tools (e.g. repomix, context7, or raw MCP filesystem servers).

## Architecture overview

### Core design

Arachne indexes a repository into a local SQLite database enriched with sqlite-vec (C++ SIMD) for vector storage. On each query it runs four layers in sequence:

1. **Tree layer** — emits a compact project file tree scoped to the token budget.
2. **Target layer** — includes the content of the directly requested file(s).
3. **Deps layer** — follows import/require/use declarations recursively to pull in transitive dependencies.
4. **Semantic layer** — runs BM25 (Rust/memchr SIMD + rayon) and cosine similarity (Rust BatchCosine) against the index to add the most relevant non-dep files within remaining budget.

KV-cache ("soul-bridge") persists incremental index state so re-runs skip unchanged files entirely.

### Interface / API

Exposed as an **MCP server** (`npx n2-arachne` or installed globally). Clients interact via the MCP tool protocol; no custom HTTP API is documented. The README shows configuration via `claude_desktop_config.json` (MCP server entry). A CLI entrypoint is implied by the npm binary but not extensively documented beyond MCP usage.

### Dependencies

- Runtime: Node.js >= 18
- Language: TypeScript (strict)
- Native extensions: Rust via napi-rs (BM25, BatchCosine), C++ via sqlite-vec (SIMD vector search)
- Embeddings: Ollama (local, optional — required for the semantic layer)
- Storage: SQLite (via better-sqlite3 / sqlite-vec)

### Scope / limitations

- Only supports JS/TS, Python, Rust, Go, and Java for dependency graph traversal; other languages fall back to text-only matching.
- Semantic layer requires a locally running Ollama instance; without it, only BM25 and dependency layers are active.
- The MCP interface is the primary (only well-documented) usage surface; direct library use is not described.
- No multi-repo or cross-workspace indexing documented.

## Deployment model

- **Runtime**: Node.js >= 18, local machine
- **Language**: TypeScript with Rust and C++ native modules (prebuilt binaries via napi-rs)
- **Storage**: SQLite on disk (local to the project being indexed)
- **Distribution**: npm package `n2-arachne`; run via `npx` or global install
- **Embeddings**: Ollama (local HTTP endpoint, default `http://localhost:11434`)
- **No server-side component**: fully local, no cloud calls

## Benchmarks / self-reported metrics

All numbers below are as reported by the author in the README; none have been independently verified.

| Metric | Value | Source |
|--------|-------|--------|
| 1 GB codebase search time | 0.54 s | README headline (as reported) |
| Real-world test project | 3,219 files / 4.68 M tokens | README benchmark table (as reported) |
| Arachne output for above | 14,074 tokens (333× compression, 99.7% reduction) | README benchmark table (as reported) |
| Initial index time (3,219 files) | 627 ms | README benchmark table (as reported) |
| Incremental index time | 0 ms | README (as reported) |
| SQLite DB size | 24 MB | README benchmark table (as reported) |
| BM25 speedup (Rust vs JS) | 1.3× | v4.0 changelog (as reported) |
| BatchCosine speedup (Rust vs JS) | 19.9× (96 ms → 4.8 ms) | v4.0 changelog (as reported) |
| sqlite-vec scan (10,000 × 768D vectors) | 25 ms | v4.0 changelog (as reported) |

## Open questions / risks / missing details

- **Benchmark provenance**: All benchmarks are from a single project (the author's own N2 Browser repo). No independent reproduction or third-party evaluation exists.
- **Embedding model not pinned**: The README does not specify which Ollama model is used for embeddings; retrieval quality is sensitive to this choice and may vary significantly.
- **Token counting method**: The 14,074-token output figure is not attributed to a specific tokenizer (tiktoken, cl100k, etc.); comparisons across providers may be misleading.
- **License ambiguity**: GitHub API returns `NOASSERTION` for the license field despite README badge showing Apache-2.0. The LICENSE file should be inspected before vendoring.
- **Native binary compatibility**: Prebuilt Rust/C++ binaries via napi-rs may not cover all platform/arch combinations (e.g. Linux ARM, Alpine). Build-from-source instructions are not prominent.
- **Ollama hard dependency for semantic layer**: No fallback embedding provider is documented; teams without Ollama lose the semantic retrieval layer entirely.
- **MCP-only surface**: No library API documented; embedding in non-MCP pipelines is not supported without wrapping the MCP server.
- **Early-stage project**: Created 2026-03-21; 52 stars, 5 forks. Maturity and long-term maintenance are unproven.
