---
title: "Analysis — qmd"
date: 2026-04-10
type: analysis
tool:
  name: "qmd"
  repo: "https://github.com/tobi/qmd"
  version: "v2.1.0 (2026-04-05)"
  language: "TypeScript"
  license: "MIT"
source: "references/tobi-qmd.md"
---

# ANALYSIS: qmd

---

## Summary

qmd is an on-device hybrid search engine for local markdown (and code) files, exposing BM25, dense vector, and HyDE retrieval via a single MCP server. All inference — embeddings (~300 MB), reranking (~640 MB), and query expansion (~1.1 GB) — runs locally using `node-llama-cpp` with GGUF models. No self-reported latency or recall figures are published; the repository ships a full benchmark harness (`qmd bench`) and a vitest-based eval suite with explicit hit-rate thresholds (verified from source). The architectural claim is that RRF fusion over typed sub-queries, combined with chunk-level (not document-level) LLM reranking, avoids the token-count trap that makes full-body reranking impractical.

---

## What it does (verified from source)

### Core mechanism

The critical path for `hybridQuery` (the MCP `query` tool) is an 8-step pipeline verified in `src/store.ts`:

1. **BM25 probe** — `searchFTS()` fires synchronously. If one result dominates by a score threshold and gap margin, and no `intent` field was provided, expansion is skipped (strong-signal bypass).
2. **Query expansion** — `expandQuery()` calls the fine-tuned `qmd-query-expansion-1.7B` GGUF model (via `node-llama-cpp`) and returns a list of typed `Queryable` variants (`lex`, `vec`, `hyde`). Result is cached in the `llm_cache` SQLite table keyed by `(query, model, intent)`.
3. **Typed search routing** — `lex` variants go to `searchFTS()` (synchronous); `vec` and `hyde` variants are collected and batch-embedded in a single `llm.embedBatch()` call, then passed to `searchVec()` (sqlite-vec KNN query). The original query is also embedded and vector-searched.
4. **RRF fusion** — `reciprocalRankFusion()` merges all ranked lists with K=60. The first two lists (original FTS + first vector) receive 2x weight; expansion-derived lists receive 1x weight.
5. **Chunk selection** — Each candidate document is synchronously chunked (900-token target, 15% overlap, scored break points). The best chunk per document is selected by keyword-overlap scoring against query terms and intent terms. Reranking runs on these chunks, not full document bodies — this is explicitly called out in source comments as the critical optimization to avoid O(tokens) cost.
6. **LLM reranking** — `store.rerank()` calls the `qwen3-reranker-0.6b-q8_0` GGUF model on the per-document best chunks. Results are cached per `(rerankQuery, model, chunkText)`. A batch of up to 40 candidates (configurable `candidateLimit`) is sent.
7. **Score blending** — RRF position and reranker score are blended with position-aware weights: documents ranked 1–3 by RRF use a 0.75/0.25 split (more trust to retrieval rank); 4–10 use 0.60/0.40; beyond 10 use 0.40/0.60.
8. **Dedup, filter, slice** — final deduplication by file path, `minScore` filter, and `limit` applied.

The BM25 layer uses SQLite FTS5 with custom field weights across `title`, `body`, and `path` columns (a bug in older versions had incorrect weights; fixed in v2.1.0 per CHANGELOG). Vector storage uses `sqlite-vec` (v0.1.9) with 384-dimensional embeddings in a `vec0` virtual table. All data lives in `~/.cache/qmd/index.sqlite`.

### Interface / API

**CLI** (`src/cli/`): `qmd search` (BM25), `qmd vsearch` (vector), `qmd query` (full hybrid), `qmd embed`, `qmd add`, `qmd index`, `qmd bench`, `qmd models`, `qmd status`, `qmd collections`. All search commands accept `--json` for machine-readable output.

**MCP tools** (registered in `src/mcp/server.ts`, schema via `zod`):

- `query` — typed sub-queries (`lex`/`vec`/`hyde`), `intent`, `collection`, `minScore`, `candidateLimit`, `rerank` toggle, `explain` flag
- `get` — single document by path or 6-char docid hash; fuzzy matching on miss; line-offset support (`file.md:100`)
- `multi_get` — batch retrieval by glob or comma-separated list
- `status` — collection health, document count, embedding coverage

**MCP transports**: stdio (default, `qmd mcp`) and HTTP daemon (`qmd mcp --http`, Streamable HTTP on port 8181). The server injects dynamic collection/capability context into the MCP `initialize` response instructions field, giving the agent immediate orientation without a tool call.

**SDK** (`src/index.ts`): `createStore()` returns a `QMDStore` object exposing the same primitives (`search`, `searchLex`, `searchVector`, `get`, `multiGet`, `embed`, `getStatus`, etc.) for programmatic use.

### Dependencies

Core runtime dependencies (from `package.json`): `node-llama-cpp@3.18.1` (GGUF inference), `sqlite-vec@0.1.9` (vector KNN), `better-sqlite3@12.8.0` (Node.js SQLite), `web-tree-sitter@0.26.7` (AST chunking, optional grammars), `@modelcontextprotocol/sdk@1.29.0`, `zod@4.2.1`, `fast-glob@3.3.3`, `picomatch@4.0.4`, `yaml@2.8.3`.

Optional dependencies: `sqlite-vec-{darwin,linux,windows}-{arm64,x64}` prebuilt native modules; `tree-sitter-{typescript,python,go,rust}` grammar packages (~72 MB total; only `.wasm` files used, ~5 MB).

**Platform constraint**: On macOS with Bun, `brew install sqlite` is required because Apple's system SQLite omits `SQLITE_LOAD_EXTENSION`, blocking the sqlite-vec extension. The `db.ts` compatibility shim handles this via `BunDatabase.setCustomSQLite()` with Homebrew paths. Node.js on macOS uses `better-sqlite3` and does not have this constraint.

### Scope / limitations

- Total model footprint on first run: ~2 GB. BM25-only (`qmd search`) requires no models.
- The query-expansion model (`tobil/qmd-query-expansion-1.7B-q4_k_m.gguf`) is hosted by the author on HuggingFace. Training data and evaluation methodology are not documented in the repository.
- HTTP MCP transport has no authentication. Running as a daemon exposes the index to any local process.
- When switching embedding models, all documents must be re-embedded (`qmd embed -f`). The v2.1.0 release adds a hard error on dimension mismatch rather than silently rebuilding the vec0 table.
- AST-aware chunking (`--chunk-strategy auto`) is opt-in; the default remains `regex`. Grammar packages are `optionalDependencies` and fall back gracefully to regex on install failure.
- The `llm_cache` table caches embedding, expansion, and rerank results, but cache invalidation (e.g. on model change) is manual (`qmd maintenance delete-llm-cache`).
- `node-llama-cpp` processes embed contexts sequentially; `embedBatch()` is implemented at the application layer by iterating over texts, not a true parallel GPU batch.

---

## Benchmark claims — verified vs as-reported

| Metric | Value | Status |
|---|---|---|
| BM25 easy queries Hit@3 | ≥80% | as reported (threshold in test/eval.test.ts) |
| BM25 medium queries Hit@3 | ≥15% | as reported (threshold in test/eval.test.ts) |
| BM25 hard queries Hit@5 | ≥15% | as reported (threshold in test/eval.test.ts) |
| BM25 overall Hit@3 | ≥40% | as reported (threshold in test/eval.test.ts) |
| Hybrid easy queries Hit@3 | ≥80% | as reported (threshold in test/eval.test.ts) |
| Hybrid medium queries Hit@3 (with vectors) | ≥50% | as reported (threshold in test/eval.test.ts) |
| Hybrid hard queries Hit@5 (with vectors) | ≥35% | as reported (threshold in test/eval.test.ts) |
| Hybrid fusion queries Hit@3 (with vectors) | ≥50% | as reported (threshold in test/eval.test.ts) |
| Hybrid overall Hit@3 (with vectors) | ≥60% | as reported (threshold in test/eval.test.ts) |
| Latency figures | not published | gap — no wall-clock benchmarks in README |
| Recall/precision figures | not published | gap — bench harness exists but no published results |

The eval suite (`test/eval.test.ts`) runs against six synthetic documents (`test/eval-docs/`) covering API design, fundraising, distributed systems, ML, remote work, and product launch topics. The 24 queries cover exact-match, semantic, vague/indirect, and multi-signal "fusion" difficulty tiers. Thresholds are vitest assertions, not published benchmark numbers. The hybrid tests are skipped in CI (`describe.skipIf(!!process.env.CI)`) because they require loaded GGUF models.

The separate benchmark harness (`src/bench/bench.ts`, invoked as `qmd bench <fixture.json>`) computes precision@k, recall, MRR, F1, and wall-clock latency across four backends: `bm25`, `vector`, `hybrid`, `full`. An example fixture (`src/bench/fixtures/example.json`) ships with the repo covering 10 queries. No pre-run results are committed to the repository; the harness is a tool for users to evaluate against their own index.

---

## Architectural assessment

### What's genuinely novel

**Typed sub-query interface exposed to the agent.** Most local RAG tools choose a retrieval strategy at indexing or configuration time. qmd delegates the strategy to the agent at query time: the `query` MCP tool accepts a `searches` array where each item declares its type (`lex`, `vec`, `hyde`). The agent can mix strategies per query, or let the server auto-expand. This is a meaningful design choice — it makes retrieval strategy a first-class parameter rather than a hidden implementation detail.

**Chunk-level reranking with position-aware score blending.** Reranking full document bodies scales poorly with document length; qmd explicitly chunks documents and reranks only the best chunk per document. The blending weights (0.75/0.60/0.40 depending on RRF rank) protect high-confidence retrieval results from reranker disagreement — a pragmatic guard against reranker errors on top-ranked documents.

**Dynamic MCP server instructions.** The server queries the live index at startup and injects collection names, document counts, and capability status directly into the MCP `initialize` response. This means the agent receives accurate index orientation without any tool calls, reducing cold-start latency and prompt engineering burden.

**Fine-tuned query expansion model.** The `qmd-query-expansion-1.7B` model is purpose-built for generating typed `lex`/`vec`/`hyde` variants from a natural-language query. No off-the-shelf model does this; the author fine-tuned and hosts the model. The training data and evaluation are undocumented, which is a risk.

**AST-aware chunk boundaries.** Tree-sitter grammars for TypeScript/JavaScript, Python, Go, and Rust allow chunking at function and class boundaries rather than arbitrary token positions. This improves retrieval precision for code files by keeping logical units intact.

### Gaps and risks

**Query expansion model is a single point of opacity.** The `tobil/qmd-query-expansion-1.7B` model is hosted on HuggingFace by the author. There is no published training dataset, evaluation methodology, or reproducibility artifact in the repository. Users cannot audit the model, and the HuggingFace repo could be removed or updated silently.

**No authentication on HTTP daemon.** The `qmd mcp --http --daemon` path is explicitly undocumented regarding authentication. Any local process can query the index. This is a known issue from triage and unfixed as of v2.1.0.

**Eval corpus is synthetic and small.** The vitest eval suite covers six documents and 24 queries. While well-designed for regression testing, it does not validate performance on real-world knowledge bases at scale. The bench harness supports custom fixtures, but no public benchmark results exist.

**Model cache invalidation is manual.** Changing the embedding model requires `qmd embed -f` (full re-embed) and manual cache deletion (`qmd maintenance delete-llm-cache`). There is no automatic detection of model version changes that would trigger re-embedding. Silent staleness is possible.

**`embedBatch()` is sequential at the native layer.** Despite accepting an array of texts, `node-llama-cpp` embeds sequentially. The batch is an application-layer optimization (single LLM context lifecycle), not a GPU batch operation. Latency scales linearly with the number of expansion variants.

**macOS Bun dependency on Homebrew SQLite.** While documented and handled in code, requiring `brew install sqlite` as a prerequisite is a non-trivial installation friction for a globally-installed npm package.

---

## Recommendation

qmd is the most fully-realized local RAG-for-agents tool surveyed to date. The architecture is sound: the layered retrieval pipeline is well-reasoned, the implementation is clean and well-tested, and the MCP integration is first-class. The 20k+ stars and 25+ community PRs in v2.1.0 suggest active real-world use.

Primary concerns before production adoption: (1) the query-expansion model is undocumented and opaque; if it degrades or disappears the core differentiator is gone; (2) no wall-clock latency data is published, making it impossible to predict performance on large indexes without self-testing; (3) the HTTP daemon has no authentication.

Recommended for: agent memory and session-context retrieval on local markdown corpora where all three of BM25, semantic, and HyDE retrieval are needed and a ~2 GB model footprint is acceptable. BM25-only use (`qmd search`) is a zero-model alternative for simpler cases.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | qmd |
|---|---|
| Approach | Hybrid retrieval (BM25 + dense vector + HyDE) with RRF fusion and LLM reranking |
| Compression | N/A — retrieval tool, not a context compressor |
| Token budget model | None built-in; callers control `limit` and `minScore` |
| Injection strategy | MCP tool returns ranked snippets; server injects orientation text into `initialize` instructions |
| Eviction | None — full index persists; no TTL or eviction policy |
| Benchmark harness | Yes — `qmd bench <fixture.json>` (precision@k, recall, MRR, F1, latency); vitest eval suite with hit-rate thresholds; no published results |
| License | MIT |
| Maturity | v2.1.0; 10 versioned releases; 20.3k stars; 25+ community PRs in latest release |
