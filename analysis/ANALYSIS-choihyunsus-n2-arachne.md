---
slug: choihyunsus-n2-arachne
title: "Analysis — n2-arachne"
date: 2026-04-10
updated: 2026-04-13
type: analysis
tool:
  name: "n2-arachne"
  repo: "https://github.com/choihyunsus/n2-arachne"
  version: "v4.0.3"
  language: "TypeScript / Rust / C++"
  license: "Dual: Apache-2.0 (non-commercial) / Commercial (contact author)"
source: "references/choihyunsus-n2-arachne.md"
local_clone: "tools/choihyunsus-n2-arachne/"
reviewed: true
reviewed_date: 2026-04-13
source_reviewed: true
---

# ANALYSIS: n2-arachne

---

## Summary

n2-arachne is a local MCP server that assembles a token-budgeted code context payload for LLMs by stacking four layers in priority order: project file tree, actively edited file, transitive dependency chain, and BM25+vector hybrid search results. All state is stored in a local SQLite database; embeddings are computed by a locally running Ollama instance. The v4.0 ("Titanium Edition") release rewrote hot paths in Rust (via napi-rs) and uses the sqlite-vec C++ SIMD extension for vector KNN. The single-benchmark compression claim (333x on the author's own N2 Browser project) is plausible from first principles but unverified independently. No dedicated benchmark harness exists in the vendored source tree; both the CHANGELOG reference to `test/test-benchmark.js` and the README references to `test/bench-hybrid-engine.js` / `test/bench-10mb.js` point to files absent from the repository.

---

## Source review

Source vendored at `tools/choihyunsus-n2-arachne/`. All claims in the "What it does" section below are verified directly against that source unless labelled "as reported".

### Critical path: agent call → token-reduced output

```text
MCP client → stdio transport (n2_arachne tool, action: "assemble")
  └─ context-tools.ts: handleAssemble()
       └─ assembler.ts: Assembler.assemble(query, options)
            ├─ _buildLayer1(): file tree from store.getAllFiles() → depth-limited render
            ├─ _buildLayer2(): active file (full or chunked) + recent files from access_log
            ├─ _buildLayer3():
            │    ├─ vectorStore.isReady?
            │    │    ├─ yes: search.hybridSearch() → BM25 + sqlite-vec KNN merge
            │    │    └─ no:  search.search() → BM25 only (Rust cached or TS fallback)
            │    ├─ _getDependencyChunks(): store.getTransitiveDependencies() (BFS, depth ≤ 2)
            │    └─ _mergeSearchAndDeps(): dep chunks scored at 0.8 × lowest_search_score
            └─ _buildLayer4(): most-accessed files from access_log, smallest chunks first
```

Each layer receives a fixed budget fraction (10/30/40/20); the spare layer (L4) is capped at `min(spare_budget, total_remaining)`. Output is assembled in order: Project Structure, Related Code, Frequently Referenced Code, Current Work Context.

### Data structures

- **`Store`** (`src/lib/store.ts`): SQLite wrapper using `better-sqlite3`. Three schema versions migrated in-process. Tables: `meta`, `files`, `chunks`, `dependencies`, `access_log`, `embeddings_meta`. WAL mode enabled.
- **`ChunkRecord`** (`src/types.ts`): `{ type, name, startLine, endLine, content, tokenCount, searchText }` — produced by `chunkCode()` in `chunker.ts` via regex pattern matching. `searchText` is a space-joined list of the chunk type, name, and up to 50 unique identifiers extracted from content.
- **`CachedSearchData`** (Rust, `native/src/bm25.rs`): `{ ids: Vec<i64>, lowered_bytes: Vec<Vec<u8>>, avg_dl: f64 }` — stored behind a `OnceLock<Mutex<...>>`. Pre-lowercased byte slices enable `memchr`-accelerated substring search without JS heap allocation on each query.
- **`KVBridge`** (`src/lib/kv-bridge.ts`): session memory written to `data/arachne-kv.json` as a JSON snapshot: `{ version, lastSavedAt, projectDir, fileCount, chunkCount, totalTokens, hotFiles[], searchHistory[] }`. Restored on next startup; not tied to the SQLite DB.
- **`VectorStore`** (`src/lib/vector-store.ts`): SQLite virtual table `vec_chunks` created by `sqlite-vec` (`vec0`, `embedding float[N]`). KNN search via `WHERE embedding MATCH ?` using sqlite-vec's built-in distance operator.

### Architecture notes confirmed by source

- The Rust module (`native/arachne-native.node`) is loaded via a three-path candidate list in `native-bridge.ts`; the prebuilt `.node` in the repo was compiled for one platform/arch. Unsupported platforms silently fall back to TypeScript equivalents.
- `src/lib/chunker.ts` notes AST chunking as `Phase 2` with `'ast'` as a config placeholder; the implemented strategy is `'regex'` only.
- The `embedding.ts` client tries both `/api/embeddings` and `/api/embed` Ollama API paths to handle different Ollama versions; input text is truncated to 2,000 characters before embedding.
- The `batch_cosine_similarity` export in `vector.rs` is a utility function (operates on `Float64Array`). The production vector search path in `VectorStore.search()` uses sqlite-vec KNN exclusively; the batch cosine path was retired because FFI vector marshaling caused V8 GC pauses and heap OOM on large corpora (documented in README).
- The TS indexer path (`_indexFile`) uses `crypto.createHash('sha256')` for file hashing. The Rust `scan_files()` function uses `DefaultHasher` — a non-stable, non-cryptographic 64-bit hash. These are separate code paths; the Rust function is only used for file metadata scanning (the TS path performs the actual DB upsert with the SHA-256 hash).

---

## What it does (verified from source)

### Core mechanism

Context assembly is implemented in `src/lib/assembler.ts` as an `Assembler` class. The `assemble(query, options)` method distributes a token budget across four named layers using fixed percentage allocations (verified from `config.default.js`):

- `fixed` (10%) — compact project file tree, depth-limited to 2-3 levels, rendered from the SQLite file index. (verified: `assembler.ts:_buildLayer1`, `config.default.js`)
- `shortTerm` (30%) — active file content (full if it fits within 70% of the layer budget; otherwise top chunks from the DB), plus the most recently accessed files. (verified: `assembler.ts:_buildLayer2`, `_loadActiveFile`)
- `associative` (40%) — hybrid search results merged with transitive dependency chunks. If Ollama is available, `BM25Search.hybridSearch()` is called; otherwise BM25 only. Dependency chunks are scored at `0.8 x lowest_search_score` and deduplicated before merge. (verified: `assembler.ts:_buildLayer3`, `_mergeSearchAndDeps`)
- `spare` (20%) — most frequently accessed files by access-log count, smallest chunks first. (verified: `assembler.ts:_buildLayer4`)

Token counting uses a character-ratio heuristic (`Math.ceil(text.length / 3.5)`) — no provider-specific tokenizer is called (verified from `assembler.ts:estimateTokens` and `chunker.ts:estimateTokens`). The `3.5` multiplier is configurable (`config.tokenMultiplier`; a separate value of `1.5` is documented for CJK). (verified: `config.default.js`)

Dependency traversal is implemented in `src/lib/dependency.ts` using per-language regex patterns:

- JS/TS: ES6 `import`, CommonJS `require`, dynamic `import()`. (verified)
- Python: `from X import` and `import X`. (verified)
- Rust: `use crate::` and `mod X;`. (verified)
- Go: `import "..."` blocks. (verified)
- Java: `import` statements. (verified)

Resolution is relative-path only — external package imports are classified `external` and skipped (`isRelativePath()` check in `dependency.ts`). (verified) Transitive depth defaults to 2 (configurable via `assembly.dependencyDepth`). (verified: `config.default.js`, `store.ts:getTransitiveDependencies`) Dependencies are stored in the `dependencies` table and resolved lazily by `store.getTransitiveDependencies(fileId, depth)`. (verified)

The hybrid search merge in `search.ts` normalises BM25 scores to `[0, 1]` by dividing by the max BM25 score, normalises vector distances to `[0, 1]` by dividing by the max distance, then combines as `(1 - alpha) * bm25_norm + alpha * semantic_norm` where `alpha = 0.5` by default. (verified: `search.ts:_mergeHybridResults`)

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
| 1 GB codebase search time | 0.54 s | as reported — single project, no repro harness in vendored source |
| Real-world project size | 3,219 files / 4.68 M tokens | as reported — N2 Browser project only |
| Arachne output size | 14,074 tokens (333x compression, 99.7% reduction) | as reported — token count uses heuristic (chars/3.5), not tiktoken |
| Initial index time | 627 ms | as reported |
| Incremental index time | 0 ms | partially verified — hash-diff skip logic confirmed in `src/lib/indexer.ts` `upsertFile()`; the "0 ms" floor is mechanically correct but elides DB-open and file-stat loop startup cost |
| SQLite DB size | 24 MB | as reported |
| BM25 speedup vs JS | 1.3x | as reported — README benchmark table shows 4.98 ms/query for Rust BM25 vs TS fallback; speedup ratio sourced from author's environment only |
| BatchCosine speedup vs JS | 19.9x (96 ms to 4.8 ms) | partially verified — `batch_cosine_similarity()` exists in `native/src/vector.rs` as a utility export; it is NOT called in the primary `VectorStore.search()` path which delegates entirely to sqlite-vec KNN; the README now labels this path "Legacy" and notes it caused GC/OOM on large corpora |
| sqlite-vec scan (10,000 x 768D vectors) | 25 ms (v4.0 intro) / 29.52 ms (benchmark table) | as reported — README contains two contradictory figures: "25ms" in the v4.0 feature callout and "29.52 ms" in the detailed benchmark table; source confirms sqlite-vec KNN is the production path but no harness is available to reproduce either figure |

Notes on claim hygiene:

- The 333x compression figure is computed from a single query on a single project. The token budget allocation (10/30/40/20 split) means output size is determined by the budget cap, not by what was actually relevant. On a project with fewer files the same budget produces less compression; on a sparser query the result could be smaller or larger.
- The token counting heuristic (`chars / 3.5`) is confirmed in `src/lib/assembler.ts:estimateTokens` and `src/lib/chunker.ts:estimateTokens`. It produces results that will differ from any provider tokenizer (cl100k, o200k, gemma-tokenizer). The README does not attribute 14,074 to a specific tokenizer.
- No benchmark harness is published in the repository. The CHANGELOG references `test/test-benchmark.js` and the README references `test/bench-hybrid-engine.js` / `test/bench-10mb.js`; none of these paths exist in the current tree. The `package.json` test script is `echo 'Tests run via CI pipeline'` — no runnable harness is available to the public.
- The incremental index time of 0 ms is technically correct as a floor: if no files changed, `upsertFile()` in `src/lib/store.ts` returns `action: 'skipped'` after a hash comparison and the indexer increments only the `skipped` counter. In practice there is still startup cost (DB open, WAL setup, file stat loop). The 0 ms headline is mechanically accurate but misleading.
- The 19.9x BatchCosine speedup applies to `batch_cosine_similarity()` in `native/src/vector.rs`. The README itself now labels this the "Legacy" path, explaining it caused V8 GC pauses and heap OOM on 1GB+ codebases. The production path in `VectorStore.search()` uses sqlite-vec KNN only. The speedup headline is for a path that was explicitly retired from production.
- The sqlite-vec figure discrepancy (25 ms vs 29.52 ms) is an internal README inconsistency; both values are as-reported from the same benchmark run on the same hardware (AMD Ryzen 5 5600G). Neither has been independently reproduced.

---

## Architectural assessment

### What's genuinely novel

**Budget-aware 4-layer paging with structural priority.** The design choice to allocate a fixed percentage budget per layer (fixed/shortTerm/associative/spare) and fill each before the next gives deterministic, bounded output. The dependency-first ordering within the associative layer (dep chunks scored above the lowest search score) encodes a correct intuition: import chains are higher-signal than textual similarity for debugging tasks. This combination is not found as a single primitive in repomix, context7, or the standard MCP filesystem server.

**Zero-marshal Rust BM25 cache.** `bm25InitStore` loads all chunk IDs and search texts into the Rust heap once; subsequent `bm25SearchCached` calls cross the FFI boundary with only the query string. JS GC pressure is eliminated for large corpora. This is a legitimate optimisation for the hot path (repeated queries during a session against a stable index).

**Graceful degradation path.** Every Rust hot-path has a TypeScript fallback (`getNative() ?? tsImplementation()`). The same is true for the semantic layer (BM25-only if Ollama is absent). The system is always functional, even if slower.

**Incremental re-indexing via content hashing.** The TS indexer computes a SHA-256 hash per file and compares it against the stored hash in `store.upsertFile()`. Only files whose hash changed are re-indexed and re-chunked. Combined with the KV-bridge JSON snapshot (hot files, search history), subsequent starts skip the full scan. This is correctly described as sub-second for unchanged codebases. (Note: the Rust `scan_files()` function also computes a fast non-cryptographic hash via `DefaultHasher`, but this is used only for file metadata scanning — the authoritative hash stored in the DB comes from the TS path.)

### Gaps and risks

**Token counting is approximate.** Using `chars / 3.5` as a universal token estimator is confirmed in `src/lib/assembler.ts:estimateTokens` and `src/lib/chunker.ts:estimateTokens`. The multiplier is configurable (`config.tokenMultiplier`; `1.5` for CJK), but the default English/code value is a well-known heuristic that over-counts tokens for dense code and under-counts for long identifiers. Callers who set a budget of 40,000 expecting to stay within a provider's context window may find the actual token count differs by 10-30%. A production tool should offer optional tiktoken/transformers integration for accurate counting.

**Dependency parser is regex-only.** The triage flagged this; source confirms it in `src/lib/dependency.ts`. All five language handlers use literal regex patterns. Barrel files (`export * from './foo'`), re-exports, path aliases (`@/utils`), and monorepo workspace packages are not resolved. `resolveImport()` returns `null` for any non-relative import path, meaning all package-level imports are silently dropped from the dependency graph. For real-world TypeScript or Python projects with these patterns the dependency layer will be incomplete.

**Hash algorithm inconsistency between TS and Rust paths.** The TypeScript indexer (`src/lib/indexer.ts`) uses `crypto.createHash('sha256')` (a cryptographic 256-bit hash). The Rust `scan_files()` in `native/src/indexer.rs` uses `std::collections::hash_map::DefaultHasher` — a non-cryptographic, non-stable 64-bit hash. Since the Rust `scan_files` path is only used to return file metadata and the TS `_indexFile` path calls `crypto.createHash` for the actual hash stored in the DB, these paths are not directly compared. However, if the integration is ever changed so Rust hash results are persisted directly, hash values would differ between runs on the same file due to `DefaultHasher` not being stable across Rust versions.

**No benchmark harness in repo.** Neither `test/test-benchmark.js` (CHANGELOG reference), `test/bench-hybrid-engine.js`, nor `test/bench-10mb.js` (README references) exist in the vendored source tree. The `package.json` `test` script outputs `'Tests run via CI pipeline'` — no runnable harness is available to the public.

**README contains contradictory benchmark figures.** The sqlite-vec KNN scan figure appears as both "25ms" and "29.52ms" for the same 10,000 × 768D test. The BatchCosine speedup is cited as both "19.9x" (CHANGELOG) and "22.3x" (README benchmark table). Neither set is reproducible without the benchmark scripts.

**Dual license commercial restriction.** The `LICENSE` file is explicit: commercial use (generating revenue, SaaS, enterprise deployment) requires a separate paid license. The Apache 2.0 grant applies only to non-commercial, personal, educational, and open-source use. GitHub's license detection (`NOASSERTION`) flagged this correctly; teams must obtain a commercial license before embedding n2-arachne in a product.

**Ollama hard dependency for semantic layer.** `nomic-embed-text` is the hardcoded default model in both `config.default.js` and `src/lib/embedding.ts`. No alternative embedding providers (OpenAI, Cohere, local HuggingFace) are supported. The embedding client issues raw HTTP POST to `http://127.0.0.1:11434`; no configuration for HTTPS or auth headers exists. Organisations without Ollama lose the semantic retrieval layer entirely; the alpha parameter in the hybrid merge formula has no effect in BM25-only mode.

**MCP-only API surface.** No library export or REST API is provided. Embedding n2-arachne in non-MCP pipelines requires wrapping the stdio MCP server process, which adds latency and process management complexity.

**Early maturity.** The project was created 2026-03-21; v4.0 shipped one week later (2026-03-28). Multiple benchmark script references in public documentation point to files that do not exist. With 52 stars and 5 forks, long-term maintenance is unproven.

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
| Benchmark harness | None published; CHANGELOG and README reference three script paths not present in the vendored source tree |
| License | Dual: Apache-2.0 (non-commercial) / Commercial (contact author) |
| Maturity | v4.0.3; created 2026-03-21; 52 stars; no public test harness |
