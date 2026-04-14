---
slug: ryandonofrio3-osgrep
title: "Analysis — osgrep"
date: 2026-04-14
type: analysis
tool:
  name: "osgrep"
  repo: "https://github.com/Ryandonofrio3/osgrep"
  version: "0.5.16 (9f2faf7)"
  language: "TypeScript / Node.js"
  license: "Apache-2.0"
source: ["references/ryandonofrio3-osgrep.md", "tools/osgrep/"]
local_clone: "tools/osgrep/"
reviewed: true
reviewed_date: 2026-04-14
source_reviewed: true
updated: null
---

## Summary

osgrep is a Node.js CLI (and partial Claude Code plugin) that indexes a codebase into a local LanceDB vector store and answers natural-language queries against it. Its search pipeline chains three models: **Granite 30M** for dense 384-dim embeddings, **mxbai-edge-colbert-v0 17M** (int8 ONNX) for late-interaction reranking, and LanceDB's FTS for keyword recall. Results are merged via Reciprocal Rank Fusion before two-stage ColBERT reranking. Call-graph traversal (`osgrep trace`) and structural file views (`osgrep skeleton`) round out the agent-facing surface.

**Critical correction from triage**: the README describes an MCP server. Source inspection reveals `src/commands/mcp.ts` returns `tools: []` for `ListToolsRequestSchema` and `"Not implemented"` for all tool calls — the MCP server is a scaffold, not a working surface.

---

## What it does (verified from source)

### Indexing pipeline

Indexing is driven by `src/lib/index/syncer.ts`. A file walker scans the repo respecting `.gitignore` and `.osgrepignore`; files are skipped by extension allowlist, 2 MB size limit, or null-byte detection. Unchanged files are skipped via mtime/size hash in an LMDB metadata cache.

Chunking (`src/lib/index/chunker.ts`) splits files using `web-tree-sitter` at function/class boundaries defined per language (`src/lib/core/languages.ts`). Chunks exceeding 75 lines or 2,000 chars are split with configurable line/char overlap. An *anchor chunk* is built per file containing imports, exports, and top-level comments as a metadata-rich entry point.

Embedding runs in a **process pool** (not threads) via `piscina`-managed workers to isolate ONNX runtime crashes. Two models are loaded from `~/.osgrep/models/`:

| Model | ID | Output |
|---|---|---|
| Dense | `onnx-community/granite-embedding-30m-english-ONNX` | 384-dim float32, mean-pooled |
| ColBERT | `ryandono/mxbai-edge-colbert-v0-17m-onnx-int8` | Per-token int8 grid + 48-dim pooled summary |

Each chunk is stored in LanceDB with: `vector` (384-dim), `colbert` (Binary int8 token grid), `colbert_scale` (quantization scale factor), `pooled_colbert_48d` (48-dim cosine summary), plus metadata: `defined_symbols`, `referenced_symbols`, `imports`, `exports`, `role`, `complexity`, `is_exported`, `parent_symbol`, `file_skeleton`.

### Search pipeline

`src/lib/search/searcher.ts` implements a three-stage retrieval pipeline:

1. **Dual retrieval**: LanceDB vector search (dense ANN) + LanceDB FTS (BM25), both with `PRE_RERANK_K = max(top_k × 5, 500)` candidates.
2. **RRF merge** (k=60): fuses the two candidate lists into a deduplicated ranked set, truncated to `STAGE1_K = 200`.
3. **Stage 1 — cheap cosine filter**: ranks by `pooled_colbert_48d` cosine similarity; keeps top `STAGE2_K = 40`.
4. **Stage 2 — full ColBERT rerank**: runs maxSim (`src/lib/workers/colbert-math.ts`) on top `RERANK_TOP = 20` candidates; blends with RRF score at `FUSED_WEIGHT = 0.5`.

Structural boosting post-rerank:
- `ORCH` (orchestration, high fan-out/complexity) and `DEF` (type/class definition) chunks receive a mild upward boost.
- `DOCS` chunks are penalized 0.6×.
- Test/spec paths (directories named `tests/`, `specs/`, `benchmark/`; files matching `.test.ts` or `.spec.ts`) are penalized 0.5× (configurable via `OSGREP_TEST_PENALTY`).

Results are deduplicated by ID, then by >50% line-range overlap, then diversified to `MAX_PER_FILE = 3` results per file.

All thresholds are overridable via env vars: `OSGREP_PRE_K`, `OSGREP_STAGE1_K`, `OSGREP_STAGE2_K`, `OSGREP_RERANK_TOP`, `OSGREP_RERANK_BLEND`, `OSGREP_TEST_PENALTY`, `OSGREP_MAX_PER_FILE`.

### Language support

Tree-sitter grammars are downloaded on demand to `~/.osgrep/grammars/`. Languages with grammars (function/class boundary chunking):

| Language | Extensions |
|---|---|
| TypeScript | `.ts` |
| TSX | `.tsx` |
| JavaScript / JSX | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py` |
| Go | `.go` |
| Rust | `.rs` |
| C++ | `.cpp`, `.hpp`, `.cc`, `.cxx` |
| C | `.c`, `.h` |
| Ruby | `.rb` |
| PHP | `.php` |

Languages in `INDEXABLE_EXTENSIONS` but **without a grammar** (line-based chunking fallback, no AST boundary detection): Java, C#, Swift, Kotlin, Scala, Lua, Dart, Elixir, Clojure, and all config/markup formats (JSON, YAML, TOML, XML, Markdown, SQL, HTML, CSS, shell scripts).

### Trace command

`osgrep trace <symbol>` builds a **1-hop call graph** from the LanceDB index. It queries:
- **Callers**: chunks where `array_contains(referenced_symbols, symbol)` — up to 100 results.
- **Callees**: `referenced_symbols` of the definition chunk for `symbol`.

Depth is fixed at 1 hop; there is no multi-hop traversal option. Call edges are derived from the `referenced_symbols` field populated during chunking, not from a static analysis pass — accuracy depends on symbol resolution quality at index time.

### Skeleton command

`osgrep skeleton <target>` (where target is a file path, symbol name, or free-text query) emits a compressed structural view of a file. Skeletons are stored in the `file_skeleton` field per chunk at index time; `src/lib/skeleton/retriever.ts` reads them from cache. Fresh generation falls back to `src/lib/skeleton/skeletonizer.ts`. Output includes function/class signatures with role annotations (`ORCH`, `DEF`, `IMPL`) and elided bodies. Token estimate uses `Math.ceil(length / 4)` — a character-count heuristic, not an actual tokenizer.

### MCP server — confirmed stub

`src/commands/mcp.ts` registers with the MCP SDK but returns:
- `tools: []` for `ListToolsRequestSchema`
- `{ content: [{ type: "text", text: "Not implemented" }], isError: true }` for all `CallToolRequestSchema` calls

The server boots, connects via stdio transport, and starts a background sync — but exposes zero callable tools. This contradicts the README's plugin section. The opencode plugin (`src/commands/opencode.ts`) and Claude Code plugin (`src/commands/claude-code.ts`) are separate CLI entrypoints that inject context via prompt injection, not MCP.

### Internal eval harness

`src/eval.ts` defines 70+ `EvalCase` records with `{ query, expectedPath }` pairs — each asserting a specific source file should rank first for a given natural-language query. This is a retrieval MRR regression suite run against osgrep's own codebase. It is not the benchmark referenced in the README (which covers token usage on a third-party codebase).

---

## Benchmark claims — verified vs as-reported

Source reviewed; harness not executed.

| Claim | Value | Scope | Assessment |
|---|---|---|---|
| Token reduction | ~20% | Cost proxy, 10 queries | `benchmark_opencode.csv`: avg baseline $0.36 vs osgrep $0.29 (−19%). 10 queries against the opencode codebase. Methodology matches claim directionally. |
| Speedup | ~30% | Response time, 10 queries | Same CSV: avg baseline 157 s vs osgrep 100 s (−36%). Consistent with claim. |
| osgrep wins | 6/10 queries | Per-query winner column | Confirmed from CSV. Baseline wins 2/10; 2 ties. |
| Cost sometimes increases | e.g. row 2 | 2/10 queries cost more with osgrep | CSV shows 3 queries where osgrep cost ≥ baseline cost. Not mentioned in README. |
| Benchmark corpus | opencode codebase | Single third-party repo | Corpus is not identified in README. Confirmed from CSV column headers and query content. |
| No quality evaluation | — | Answers not judged for correctness | CSV records only time and cost. Whether osgrep answers were correct or equivalent to baseline is not assessed. |
| Internal MRR harness | `eval.ts` | osgrep's own codebase | A 70+ case retrieval regression suite exists, testing that osgrep's search ranks correct source files for dev queries — independent of the README benchmark. |

**Verdict**: the 20%/30% headline figures are directionally supported by the CSV data, but the benchmark is a 10-query, single-codebase, cost-only evaluation with no answer quality assessment. The figures are real observations, not fabricated, but are not sufficient for a reproducible performance claim.

---

## Architectural assessment

### Strengths

1. **Three-model search stack is source-confirmed and implemented.** Dense (Granite 30M) + FTS + ColBERT (mxbai-edge-colbert-v0 17M) reranking is fully wired in `searcher.ts` and `orchestrator.ts`. The two-stage rerank (cheap pooled cosine → full maxSim) is a practical efficiency tradeoff.

2. **Per-chunk symbol metadata enables call-graph queries without a separate graph store.** `defined_symbols` and `referenced_symbols` are stored per chunk in LanceDB, making `osgrep trace` possible without a second database. Scope is limited to 1-hop but the mechanism is sound.

3. **All pipeline thresholds are env-var overridable.** `OSGREP_PRE_K`, `OSGREP_STAGE1_K`, `OSGREP_STAGE2_K`, `OSGREP_RERANK_TOP`, `OSGREP_RERANK_BLEND`, `OSGREP_TEST_PENALTY`, `OSGREP_MAX_PER_FILE` — tunable without code changes.

4. **Internal regression harness exists.** The 70+ MRR eval cases in `eval.ts` provide a repeatable signal for search quality changes against the codebase itself.

5. **ONNX process pool is crash-isolated.** Workers run as child processes (not threads), so a stuck or crashing ONNX session doesn't hang the whole CLI. SIGTERM/SIGKILL fallback confirmed in `pool.ts`.

### Weaknesses / risks

1. **MCP server is a non-functional stub.** The README's MCP section is misleading. Zero tools are callable via MCP as of commit 9f2faf7. This removes the primary integration path for many agent frameworks.

2. **Grammar coverage gap vs. indexable extension list.** Java, C#, Swift, Kotlin, Scala and all config/markup formats lack tree-sitter grammars and fall back to line-based chunking. Boundary quality for these is significantly worse.

3. **Trace depth is fixed at 1 hop.** There is no `--depth` flag; multi-hop impact analysis is not supported.

4. **Token estimate in skeleton is a character heuristic.** `Math.ceil(length / 4)` is reported as a token count but is not based on a real tokenizer. Users relying on this figure for context budget decisions will get inaccurate numbers.

5. **Benchmark covers one codebase, 10 queries, no quality assessment.** Generalizability is unknown. Cost savings could reverse on different codebases or query types.

6. **Maintenance pace.** Last commit 2026-01-17 — ~3 months stale. The MCP stub suggests the tool is mid-development. Significant advertised features (MCP) remain unimplemented.

---

## Recommendation

**Use when:**
- Semantic code search via CLI is the primary requirement and no external service (Qdrant, Docker) is acceptable.
- The richest hybrid retrieval pipeline (FTS + dense + two-stage ColBERT reranking) is needed in a single npm install.
- `osgrep skeleton` (compressed structural views with role annotations) or `osgrep trace` (1-hop call-graph) are the specific agent primitives required.

**Avoid when:**
- MCP framework integration is required — the MCP server is a non-functional stub as of `9f2faf7`; zero tools are callable.
- The codebase is primarily Java, C#, Swift, or Kotlin — these lack tree-sitter grammars and fall back to line-based chunking with significantly lower boundary quality.
- Reproducible performance evidence is required before adoption — the benchmark harness (`run-benchmark.sh`, `src/bench/`) is missing from the repo.
- Active maintenance is required — last commit 2026-01-17, ~3 months stale.

**vs socraticode**: osgrep's pipeline is richer (two-stage ColBERT reranking vs single RRF pass) and requires no external services; socraticode requires Docker + Qdrant but its MCP server is functional. Prefer osgrep for standalone CLI use; prefer socraticode if Qdrant is already in the stack.

**vs codebase-memory-mcp**: codebase-memory-mcp stores a graph structure enabling relationship traversal across symbols; osgrep is a flat vector index with no graph edges. Prefer codebase-memory-mcp when graph queries (call-graph depth > 1, dependency paths) are needed.

**vs serena**: serena uses LSP for symbol-level precision and supports editing; osgrep offers broader language indexing via embeddings but lower precision on symbol boundaries. Prefer serena for polyglot refactoring workflows requiring exact edits; prefer osgrep for free-text code discovery.

---

## Open questions after source review

- **Skeleton freshness**: `file_skeleton` is stored at index time. If a file changes between re-indexes, the cached skeleton will be stale. The validator in `validateSchema` checks for `complexity` and `is_exported` only; no skeleton staleness check found.
- **ColBERT model provenance**: `ryandono/mxbai-edge-colbert-v0-17m-onnx-int8` is a community-uploaded int8 quantization of mxbai-edge-colbert. Licensing and quantization quality relative to the official mxbai release are not documented.
- **Symbol resolution quality**: `referenced_symbols` is populated during chunking from tree-sitter. The accuracy of cross-file call edges (e.g. method calls on imported types) is undocumented and likely incomplete.
- **Daemon (`osgrep serve`) fault tolerance**: the source was not inspected in this pass; restart policy and socket/port behavior are unknown.
- **MCP roadmap**: no issue or PR found discussing MCP implementation status. Whether this is planned, deprioritized, or abandoned is unclear.

---

## Comparison hooks (for ANALYSIS.md matrix)

- **Retrieval model**: FTS (LanceDB BM25) + dense Granite 30M (384-dim) + mxbai-edge-colbert-v0 17M int8 late-interaction reranking; merged via RRF (k=60); two-stage rerank (pooled cosine filter → full maxSim).
- **Token saving scope**: ~20% cost / ~30% time (as reported; 10-query, single-codebase CSV, cost-proxy only; no answer quality assessment; benchmark harness absent from repo).
- **Storage**: LanceDB (embedded, per-repo isolation derived from git remote URL; no external service or server).
- **Models**: local ONNX, ~150 MB download to `~/.osgrep/models/`; no API keys required.
- **MCP status**: **stub** — `ListToolsRequestSchema` returns `tools: []`; all `CallToolRequestSchema` calls return `"Not implemented"` (confirmed from `src/commands/mcp.ts`, commit `9f2faf7`).
- **Language coverage gap**: 10 tree-sitter grammars (TS, JS, Python, Go, Rust, C++, C, Ruby, PHP, TSX); Java, C#, Swift, Kotlin, Scala and all config/markup formats fall back to line-based chunking.
- **Agentic primitives**: `osgrep skeleton` (compressed structural view, role annotations ORCH/DEF/IMPL, LanceDB-cached); `osgrep trace` (1-hop call graph from `defined_symbols`/`referenced_symbols` fields).
- **Maintenance signal**: last push 2026-01-17 (~3 months stale at analysis date); 1,128 stars; Apache-2.0.
- **Source-corrected**: README describes MCP server as a working integration — source confirms it is a non-functional scaffold returning zero tools.
