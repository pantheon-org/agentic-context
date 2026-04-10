---
title: "Analysis — n2-arachne"
date: 2026-04-10
type: analysis
tool:
  name: "n2-arachne"
  repo: "https://github.com/choihyunsus/n2-arachne"
  version: "v4.0.3"
  language: "TypeScript / Rust / C++"
  license: "Dual: Apache-2.0 (non-commercial) / Commercial (contact author)"
source: "references/choihyunsus-n2-arachne.md"
---

# ANALYSIS: n2-arachne

---

## Summary

n2-arachne is a local MCP server that assembles a token-budgeted code context payload for LLMs by stacking four layers in priority order: project file tree, actively edited file, transitive dependency chain, and BM25+vector hybrid search results. All state is stored in a local SQLite database; embeddings are computed by a locally running Ollama instance. The v4.0 ("Titanium Edition") release rewrote hot paths in Rust (via napi-rs) and uses the sqlite-vec C++ SIMD extension for vector KNN. The single-benchmark compression claim (333x on the author's own N2 Browser project) is plausible from first principles but unverified independently. No dedicated benchmark harness exists in the published source tree; the CHANGELOG references `test/test-benchmark.js` but that directory is absent from the repository.

---

## What it does (verified from source)

### Core mechanism

Context assembly is implemented in `src/lib/assembler.ts` as an `Assembler` class. The `assemble(query, options)` method distributes a token budget across four named layers using fixed percentage allocations (verified from `config.default.js`):

- `fixed` (10%) — compact project file tree, depth-limited to 2-3 levels, rendered from the SQLite file index.
- `shortTerm` (30%) — active file content (full if it fits within 70% of the layer budget; otherwise top chunks from the DB), plus the most recently accessed files.
- `associative` (40%) — hybrid search results merged with transitive dependency chunks. If Ollama is available, `BM25Search.hybridSearch()` is called; otherwise BM25 only. Dependency chunks are scored at `0.8 x lowest_search_score` and deduplicated before merge.
- `spare` (20%) — most frequently accessed files by access-log count, smallest chunks first.

Token counting uses a character-ratio heuristic (`Math.ceil(text.length / 3.5)`) — no provider-specific tokenizer is called (verified from `assembler.ts:estimateTokens`). The `3.5` multiplier is configurable (`config.tokenMultiplier`; a separate value of `1.5` is documented for CJK).

Dependency traversal is implemented in `src/lib/dependency.ts` using per-language regex patterns:

- JS/TS: ES6 `import`, CommonJS `require`, dynamic `import()`.
- Python: `from X import` and `import X`.
- Rust: `use crate::` and `mod X;`.
- Go: `import "..."` blocks.
- Java: `import` statements.

Resolution is relative-path only — external package imports are classified `external` and skipped. Transitive depth defaults to 2 (configurable via `assembly.dependencyDepth`). Dependencies are stored in the `dependencies` table and resolved lazily by `store.getTransitiveDependencies(fileId, depth)`.

The hybrid search merge in `search.ts` normalises BM25 scores to `[0, 1]` by dividing by the max BM25 score, normalises vector distances to `[0, 1]` by dividing by the max distance, then combines as `(1 - alpha) * bm25_norm + alpha * semantic_norm` where `alpha = 0.5` by default.

### Interface / API

A single MCP tool named `n2_arachne` is registered, dispatching on an `action` enum: `assemble`, `search`, `index`, `status`, `files`, `backup`, `restore`, `gc` (verified from `src/tools/context-tools.ts`). The server uses the `@modelcontextprotocol/sdk` stdio transport, so any MCP-compatible client can consume it with zero provider lock-in.

Callers pass `activeFile`, `budget`, and `layers` to the `assemble` action; all are optional. The budget defaults to 40,000 tokens. Layers can be selectively disabled by name.

There is no library/programmatic API. The only supported integration surface is MCP.

### Dependencies

- Runtime: Node.js >= 18 (verified from `package.json` `engines` field).
- Core TS dependencies: `@modelcontextprotocol/sdk ^1.25.2`, `better-sqlite3 ^11.0.0`, `sqlite-vec ^0.1.7`, `zod ~3.24.1`.
- No `ollama` npm package; the embedding client (`src/lib/embedding.ts`) issues raw HTTP POST requests to `http://127.0.0.1:11434` using Node.js `http.request`. Default embedding model is `nomic-embed-text`; no fallback model is configured.
- Native Rust module (`native/arachne-native.node`) compiled via napi-rs. Rust crate dependencies: `napi 2` (napi9 feature), `rayon 1.10`, `memmap2 0.9`, `memchr 2.7`, `unicode-segmentation 1.12`. Note: `memchr` provides SIMD-accelerated substring search; auto-vectorisation in Rust is compiler-guided but not explicitly SIMD-intrinsic — the "SIMD-ready" claim in docs is accurate but dependent on target CPU and compiler flags.
- sqlite-vec is the C++ SIMD extension for vector KNN (separate from the Rust module; loaded via `sqliteVec.load(db)` in `vector-store.ts`).

### Scope / limitations

- Token count uses a heuristic ratio (chars/3.5). For codebases with many short identifiers or non-ASCII text the estimate will diverge from any provider's actual token count. Budgets set in tokens are therefore approximate.
- Dependency traversal is regex-based, not AST-based. Complex patterns (re-exports, barrel files, conditional requires, namespace imports) may be missed or mis-classified. `config.default.js` lists `chunkStrategy: 'regex'` with `'ast'` as a placeholder not yet implemented.
- Semantic layer requires a running Ollama daemon on `localhost:11434`. Availability is probed once at startup; if Ollama is down, the entire semantic layer is silently bypassed and only BM25 runs for that session.
- The `batch_cosine_similarity` function in `native/src/vector.rs` operates on `Float64Array` (f64). Vector KNN search via sqlite-vec uses `float[N]` (f32). These are separate codepaths; `batch_cosine_similarity` is a utility export and is not called in the primary `VectorStore.search()` path (which delegates entirely to sqlite-vec KNN).
- No multi-repo indexing. The `dataDir` is per-project.
- The prebuilt `.node` binary in the repo (`native/arachne-native.node`) was compiled for a specific platform/arch. Unsupported platforms fall back to TypeScript implementations via `getNative() ?? tsImplementation()`.

---

## Benchmark claims — verified vs as-reported

| Metric | Value | Status |
|---|---|---|
| 1 GB codebase search time | 0.54 s | as reported — single project, no repro harness |
| Real-world project size | 3,219 files / 4.68 M tokens | as reported — N2 Browser project only |
| Arachne output size | 14,074 tokens (333x compression, 99.7% reduction) | as reported — token count uses heuristic, not tiktoken |
| Initial index time | 627 ms | as reported |
| Incremental index time | 0 ms | as reported — hash-diff skips unchanged files (verified from source); startup cost elided |
| SQLite DB size | 24 MB | as reported |
| BM25 speedup vs JS | 1.3x | as reported — Rust cached path vs TS fallback |
| BatchCosine speedup vs JS | 19.9x (96 ms to 4.8 ms) | as reported — applies to batch utility, not primary KNN path |
| sqlite-vec scan (10,000 x 768D vectors) | 25 ms | as reported — C++ SIMD, sqlite-vec library |

Notes on claim hygiene:

- The 333x compression figure is computed from a single query on a single project. The token budget allocation (10/30/40/20 split) means output size is determined by the budget cap, not by what was actually relevant. On a project with fewer files the same budget produces less compression; on a sparser query the result could be smaller or larger.
- The token counting heuristic (`chars / 3.5`) produces results that will differ from any provider tokenizer (cl100k, o200k, gemma-tokenizer). The README does not attribute 14,074 to a specific tokenizer (as reported in the triage).
- No benchmark harness is published in the repository. The CHANGELOG mentions `test/test-benchmark.js` (v4.0 changelog) but that path does not exist in the current tree. The `package.json` test script is `echo 'Tests run via CI pipeline'` — no runnable harness is available to the public.
- The incremental index time of 0 ms is technically correct as a floor: if no files changed, the indexer writes zero rows. In practice there is still startup cost (DB open, file stat loop). This is plausible from source but the 0 ms headline elides startup.
- The 19.9x BatchCosine speedup applies to `batchCosineSimilarity()` in `native/src/vector.rs`, which is a utility export. The primary semantic search path in `VectorStore.search()` uses sqlite-vec KNN (`vec0` virtual table), not this function. The speedup headline is therefore for a path not used in production.

---

## Architectural assessment

### What's genuinely novel

**Budget-aware 4-layer paging with structural priority.** The design choice to allocate a fixed percentage budget per layer (fixed/shortTerm/associative/spare) and fill each before the next gives deterministic, bounded output. The dependency-first ordering within the associative layer (dep chunks scored above the lowest search score) encodes a correct intuition: import chains are higher-signal than textual similarity for debugging tasks. This combination is not found as a single primitive in repomix, context7, or the standard MCP filesystem server.

**Zero-marshal Rust BM25 cache.** `bm25InitStore` loads all chunk IDs and search texts into the Rust heap once; subsequent `bm25SearchCached` calls cross the FFI boundary with only the query string. JS GC pressure is eliminated for large corpora. This is a legitimate optimisation for the hot path (repeated queries during a session against a stable index).

**Graceful degradation path.** Every Rust hot-path has a TypeScript fallback (`getNative() ?? tsImplementation()`). The same is true for the semantic layer (BM25-only if Ollama is absent). The system is always functional, even if slower.

**Incremental re-indexing via content hashing.** The indexer computes a fast non-cryptographic hash per file (`native/src/indexer.rs`); only files whose hash changed are re-indexed. Combined with the KV-bridge JSON snapshot (hot files, search history), subsequent starts skip the full scan. This is correctly described as sub-second for unchanged codebases.

### Gaps and risks

**Token counting is approximate.** Using `chars / 3.5` as a universal token estimator is a well-known heuristic that over-counts tokens for dense code and under-counts for long identifiers. Callers who set a budget of 40,000 expecting to stay within a provider's context window may find the actual token count differs by 10-30%. A production tool should offer optional tiktoken/transformers integration for accurate counting.

**Dependency parser is regex-only.** The triage flagged this; source confirms it. Barrel files (`export * from './foo'`), re-exports, path aliases (`@/utils`), and monorepo workspace packages are not resolved. For real-world TypeScript or Python projects with these patterns the dependency layer will be incomplete.

**No benchmark harness in repo.** The absence of `test/test-benchmark.js` means all performance figures are from the author's private environment. There is no reproducible baseline.

**Dual license commercial restriction.** The LICENSE file is explicit: commercial use (generating revenue, SaaS, enterprise deployment) requires a separate paid license. The Apache 2.0 grant applies only to non-commercial, personal, educational, and open-source use. GitHub's license detection (`NOASSERTION`) flagged this correctly; teams must obtain a commercial license before embedding n2-arachne in a product.

**Ollama hard dependency for semantic layer.** `nomic-embed-text` is the only documented model; no alternative embedding providers (OpenAI, Cohere, local HuggingFace) are supported. Organisations without Ollama lose the semantic retrieval layer entirely; the alpha parameter in hybrid merge then has no effect.

**MCP-only API surface.** No library export or REST API is provided. Embedding n2-arachne in non-MCP pipelines requires wrapping the stdio MCP server process, which adds latency and process management complexity.

**Early maturity.** The project was created 2026-03-21; v4.0 shipped one week later (2026-03-28). The test suite reference in the CHANGELOG is not publicly available. With 52 stars and 5 forks, long-term maintenance is unproven.

---

## Recommendation

**Evaluate carefully before adoption.** The 4-layer budget-aware assembly model is the correct architectural approach for code context, and the BM25+dependency merge is a meaningful improvement over text-search-only tools. However, three blockers need resolution before recommending it for production use:

1. **License**: obtain a commercial license if deploying in a revenue-generating context. The dual-license model is non-trivial.
2. **Token counting**: validate that the heuristic token estimate is within acceptable tolerance for the target provider and codebase before setting hard budgets.
3. **Benchmark reproducibility**: the 333x compression claim is a single data point. Run against the actual codebase to verify realistic output sizes before committing to the tool.

For personal or open-source use on projects with JS/TS codebases and a local Ollama instance, n2-arachne is a capable context assembly primitive that handles the dependency-traversal problem that most comparable tools ignore.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | n2-arachne |
|---|---|
| Approach | 4-layer budget-aware context assembly (tree + active file + deps + hybrid search) |
| Compression | 333x on single benchmark project (as reported); heuristic token counting |
| Token budget model | Hard cap (default 40,000 tokens); fixed percentage allocation per layer |
| Injection strategy | On-demand via MCP `assemble` action; single round-trip payload |
| Eviction | Budget overflow: lower-priority layer items dropped; deps ranked above search by scoring |
| Benchmark harness | None published; CHANGELOG references internal test file not in repo |
| License | Dual: Apache-2.0 (non-commercial) / Commercial (contact author) |
| Maturity | v4.0.3; created 2026-03-21; 52 stars; no public test harness |
