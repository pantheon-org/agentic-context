---
slug: tobi-qmd
title: "Analysis — qmd"
date: 2026-04-10
updated: 2026-04-13
type: analysis
tool:
  name: "qmd"
  repo: "https://github.com/tobi/qmd"
  version: "v2.1.0 (2026-04-05)"
  language: "TypeScript"
  license: "MIT"
source: "references/tobi-qmd.md"
local_clone: "tools/tobi-qmd/"
reviewed: false
reviewed_date: null
source_reviewed: false
---

# ANALYSIS: qmd

---

## Summary

qmd is an on-device hybrid search engine for local markdown (and code) files, exposing BM25, dense vector, and HyDE retrieval via a single MCP server. All inference — embeddings (~300 MB), reranking (~640 MB), and query expansion (~1.1 GB) — runs locally using `node-llama-cpp` with GGUF models. No self-reported latency or recall figures are published; the repository ships a full benchmark harness (`qmd bench`) and a vitest-based eval suite with explicit hit-rate thresholds (verified from source). The architectural claim is that RRF fusion over typed sub-queries, combined with chunk-level (not document-level) LLM reranking, avoids the token-count trap that makes full-body reranking impractical.

**Source review note (2026-04-13)**: Source at `tools/tobi-qmd/` has been read directly. The 8-step pipeline is verified verbatim from `src/store.ts`. The `finetune/` directory contradicts the prior claim that training data and evaluation are undocumented — a complete training pipeline with data, configs, eval scripts, and published training results (SFT: 92.0% average score) is present in the repository. See the "Source review" section below for details.

---

## What it does (verified from source)

### Core mechanism

The critical path for `hybridQuery` (the MCP `query` tool) is an 8-step pipeline verified directly from `src/store.ts` (lines 4024–4281, function `hybridQuery`):

1. **BM25 probe** (verified) — `searchFTS()` fires synchronously. If one result dominates by a score threshold and gap margin, and no `intent` field was provided, expansion is skipped (strong-signal bypass). Source: `store.ts` line 4024, constants `STRONG_SIGNAL_MIN_SCORE` and `STRONG_SIGNAL_MIN_GAP`.
2. **Query expansion** (verified) — `expandQuery()` calls the fine-tuned GGUF at `hf:tobil/qmd-query-expansion-1.7B-gguf/qmd-query-expansion-1.7B-q4_k_m.gguf` (the constant `DEFAULT_GENERATE_MODEL` in `llm.ts` line 199; `DEFAULT_QUERY_MODEL = "Qwen/Qwen3-1.7B"` in `store.ts` is the base model identifier, not the deployed GGUF). Returns typed `Queryable` variants (`lex`, `vec`, `hyde`). Result cached in `llm_cache` table keyed by `(query, model, intent)`. Source: `store.ts` lines 4038–4055.
3. **Typed search routing** (verified) — `lex` variants go to `searchFTS()` (synchronous, runs immediately); `vec` and `hyde` variants plus the original query are collected and batch-embedded in a single `llm.embedBatch()` call, then run through `searchVec()` (sqlite-vec KNN). Source: `store.ts` lines 4057–4119.
4. **RRF fusion** (verified) — `reciprocalRankFusion()` merges all ranked lists. The first two lists (original FTS + first vector) receive 2× weight; all other lists receive 1× weight (weights array `rankedLists.map((_, i) => i < 2 ? 2.0 : 1.0)`). Source: `store.ts` lines 4121–4125.
5. **Chunk selection** (verified) — each candidate document is chunked (900-token target, 15% overlap). The best chunk per document is selected by keyword-overlap scoring against query terms and intent terms (weighted 0.5× relative to query terms). Reranking operates on chunks, not full bodies — the source comment at line 4130 reads: "Reranking full bodies is O(tokens) — the critical perf lesson that motivated this refactor." Source: `store.ts` lines 4129–4153.
6. **LLM reranking** (verified) — `store.rerank()` calls the `qwen3-reranker-0.6b-q8_0` GGUF on per-document best chunks. Results cached per `(rerankQuery, model, chunkText)`. Batch of up to `candidateLimit` (default 40) candidates sent. Source: `store.ts` lines 4206–4218.
7. **Score blending** (verified) — RRF rank and reranker score blended with position-aware weights: RRF rank 1–3 → 0.75/0.25 split; rank 4–10 → 0.60/0.40; rank >10 → 0.40/0.60. Formula: `rrfWeight * (1/rrfRank) + (1 - rrfWeight) * rerankScore`. Source: `store.ts` lines 4220–4269.
8. **Dedup, filter, slice** (verified) — deduplication by file path, `minScore` filter, `limit` slice applied to sorted blended results. Source: `store.ts` lines 4272–4281.

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
- The query-expansion model (`tobil/qmd-query-expansion-1.7B-q4_k_m.gguf`) is hosted by the author on HuggingFace. Training data, training code, and evaluation are fully documented in the `finetune/` directory — this contradicts the prior triage claim that they were undocumented. The training pipeline is a two-stage SFT (Qwen3-1.7B base, LoRA rank 16, ~2,290 examples) with a rule-based reward function. Published results: SFT train loss 0.472, eval loss 0.304, token accuracy 93.8%, reward-function score 92.0%. These are training metrics, not retrieval benchmark results.
- HTTP MCP transport has no authentication. Running as a daemon exposes the index to any local process.
- When switching embedding models, all documents must be re-embedded (`qmd embed -f`). The v2.1.0 release adds a hard error on dimension mismatch rather than silently rebuilding the vec0 table.
- AST-aware chunking (`--chunk-strategy auto`) is opt-in; the default remains `regex`. Grammar packages are `optionalDependencies` and fall back gracefully to regex on install failure.
- The `llm_cache` table caches embedding, expansion, and rerank results, but cache invalidation (e.g. on model change) is manual (`qmd maintenance delete-llm-cache`).
- `node-llama-cpp` processes embed contexts sequentially; `embedBatch()` is implemented at the application layer by iterating over texts, not a true parallel GPU batch.

---

## Benchmark claims — verified vs as-reported

| Metric | Value | Status |
|---|---|---|
| BM25 easy queries Hit@3 | ≥80% | verified (vitest assertion, `test/eval.test.ts` line 131) |
| BM25 medium queries Hit@3 | ≥15% | verified (vitest assertion, `test/eval.test.ts` line 137) |
| BM25 hard queries Hit@5 | ≥15% | verified (vitest assertion, `test/eval.test.ts` line 143) |
| BM25 overall Hit@3 | ≥40% | verified (vitest assertion, `test/eval.test.ts` line 149) |
| Vector easy queries Hit@3 | ≥60% | verified (vitest assertion, `test/eval.test.ts` line 218; prior analysis incorrectly listed as ≥80%) |
| Vector medium queries Hit@3 | ≥40% | verified (vitest assertion, `test/eval.test.ts` line 230) |
| Vector hard queries Hit@5 | ≥30% | verified (vitest assertion, `test/eval.test.ts` line 243; prior analysis incorrectly listed as ≥35%) |
| Vector overall Hit@3 | ≥50% | verified (vitest assertion, `test/eval.test.ts` line 255; prior analysis incorrectly listed as ≥60%) |
| Hybrid easy queries Hit@3 | ≥80% | verified (vitest assertion, `test/eval.test.ts` line 328) |
| Hybrid medium queries Hit@3 (with vectors) | ≥50% | verified (vitest assertion, `test/eval.test.ts` line 338) |
| Hybrid hard queries Hit@5 (with vectors) | ≥35% | verified (vitest assertion, `test/eval.test.ts` line 351) |
| Hybrid fusion queries Hit@3 (with vectors) | ≥50% | verified (vitest assertion, `test/eval.test.ts` line 362) |
| Hybrid overall Hit@3 (with vectors) | ≥60% | verified (vitest assertion, `test/eval.test.ts` line 395; applies to non-fusion queries only) |
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

**Fine-tuned query expansion model.** The `qmd-query-expansion-1.7B` model is purpose-built for generating typed `lex`/`vec`/`hyde` variants from a natural-language query. No off-the-shelf model does this; the author fine-tuned and hosts the model. The training pipeline (`finetune/`), training data (~2,290 JSONL examples), and reward function (`reward.py`) are fully documented in the repository — see the Source review section for details.

**AST-aware chunk boundaries.** Tree-sitter grammars for TypeScript/JavaScript, Python, Go, and Rust allow chunking at function and class boundaries rather than arbitrary token positions. This improves retrieval precision for code files by keeping logical units intact.

### Gaps and risks

**Query expansion model training is documented but HuggingFace-hosted.** The `tobil/qmd-query-expansion-1.7B-q4_k_m.gguf` model is hosted on HuggingFace. Contrary to the prior triage claim, the full training pipeline ships in the repo: `finetune/` contains training data (~2,290 JSONL examples across 10+ source files), training code (`train.py`, SFT via LoRA on Qwen3-1.7B), a rule-based eval/reward function (`reward.py`, `SCORING.md`), and published training results (SFT: 92.0% average score, 30/30 excellent on test queries). The residual risk is that the HuggingFace repos (`tobil/qmd-query-expansion-1.7B-gguf`, etc.) could be removed or updated silently — the training artifacts in the repo allow reproduction but not zero-effort recovery of the deployed GGUF.

**No authentication on HTTP daemon.** The `qmd mcp --http --daemon` path is explicitly undocumented regarding authentication. Any local process can query the index. This is a known issue from triage and unfixed as of v2.1.0.

**Eval corpus is synthetic and small.** The vitest eval suite covers six documents and 24 queries. While well-designed for regression testing, it does not validate performance on real-world knowledge bases at scale. The bench harness supports custom fixtures, but no public benchmark results exist.

**Model cache invalidation is manual.** Changing the embedding model requires `qmd embed -f` (full re-embed) and manual cache deletion (`qmd maintenance delete-llm-cache`). There is no automatic detection of model version changes that would trigger re-embedding. Silent staleness is possible.

**`embedBatch()` is sequential at the native layer.** Despite accepting an array of texts, `node-llama-cpp` embeds sequentially. The batch is an application-layer optimization (single LLM context lifecycle), not a GPU batch operation. Latency scales linearly with the number of expansion variants.

**macOS Bun dependency on Homebrew SQLite.** While documented and handled in code, requiring `brew install sqlite` as a prerequisite is a non-trivial installation friction for a globally-installed npm package.

---

## Source review (2026-04-13)

Source vendored at `tools/tobi-qmd/`. Key files read: `src/store.ts`, `src/llm.ts`, `src/bench/bench.ts`, `src/bench/score.ts`, `src/bench/types.ts`, `test/eval.test.ts`, `finetune/README.md`, `finetune/CLAUDE.md`, `finetune/SCORING.md`, `finetune/reward.py`, `package.json`.

### Architecture verification

- **8-step hybridQuery pipeline**: verified verbatim from `src/store.ts` function `hybridQuery` (exported at line 4003). The source comment at lines 3993–4001 documents all 8 steps explicitly. All step details match the prior analysis with two corrections noted below.
- **RRF weight assignment**: verified — `rankedLists.map((_, i) => i < 2 ? 2.0 : 1.0)` at line 4122. First two lists (original FTS + first vec) receive 2× weight exactly as described.
- **Score blending thresholds**: verified — rrfRank ≤3 → 0.75, ≤10 → 0.60, else → 0.40 at lines 4229–4232.
- **Chunk size**: verified — `CHUNK_SIZE_TOKENS = 900`, `CHUNK_OVERLAP_TOKENS = 135` (15%), constants at lines 51–53.
- **Default models**: verified — `DEFAULT_EMBED_MODEL = "embeddinggemma"`, `DEFAULT_RERANK_MODEL = "ExpedientFalcon/qwen3-reranker:0.6b-q8_0"` (store.ts lines 42–43). The query expansion GGUF is `DEFAULT_GENERATE_MODEL = "hf:tobil/qmd-query-expansion-1.7B-gguf/qmd-query-expansion-1.7B-q4_k_m.gguf"` in `llm.ts` line 199. `DEFAULT_QUERY_MODEL = "Qwen/Qwen3-1.7B"` in store.ts is the base HuggingFace model identifier used in some paths — distinct from the deployed GGUF.
- **Strong-signal bypass**: verified — `STRONG_SIGNAL_MIN_SCORE` and `STRONG_SIGNAL_MIN_GAP` constants used at lines 4032–4034. Intent field disables bypass (line 4032).
- **llm_cache table**: verified — `db.ts` schema creates table at line 787 of store.ts; cache used in `expandQuery` (line 3260) and `rerank` (lines 3310–3330).

### Corrections to prior analysis

| Claim | Prior | Source verdict |
|---|---|---|
| Training data undocumented | "not documented in the repository" | **Incorrect** — `finetune/data/` contains ~2,290 JSONL training examples across 10+ files |
| Evaluation undocumented | "not documented" | **Incorrect** — `finetune/eval.py` + `reward.py` + `SCORING.md` provide full eval pipeline |
| Training results unpublished | implied gap | **Incorrect** — `finetune/README.md` publishes SFT results (loss, accuracy, reward score) |
| Vector easy Hit@3 threshold | ≥80% | **Wrong** — source says ≥60% (`test/eval.test.ts` line 218) |
| Vector hard Hit@5 threshold | ≥35% | **Wrong** — source says ≥30% (`test/eval.test.ts` line 243) |
| Vector overall Hit@3 threshold | ≥60% | **Wrong** — source says ≥50% (`test/eval.test.ts` line 255) |

### Fine-tune training pipeline (verified from `finetune/`)

The `finetune/` directory is a self-contained Python ML training project:

- **Base model**: `Qwen/Qwen3-1.7B` (not a custom architecture — LoRA fine-tune)
- **Method**: SFT only in production path; GRPO is experimental in `experiments/grpo/`
- **Training data**: ~2,290 examples (after dedup) from 10+ JSONL source files. Schema enforced by Pydantic (`dataset/schema.py`). Format: `{"query": "...", "output": [["lex", "..."], ["vec", "..."], ["hyde", "..."]]}`
- **Reward function**: rule-based, 5 dimensions — Format (0–30), Diversity (0–30), HyDE (0–20), Quality (0–20), Entity preservation (−45 to +20). Max 140 with HyDE, 120 without. No LLM judge.
- **Eval set**: 31 test queries across 8 categories in `finetune/evals/queries.txt`
- **Published training results** (from `finetune/README.md`, Qwen3-1.7B SFT v2):

  | Metric | Value |
  |---|---|
  | Final train loss | 0.472 |
  | Final eval loss | 0.304 |
  | Token accuracy (train) | 97.4% |
  | Token accuracy (eval) | 93.8% |
  | Reward-function score (avg) | 92.0% |
  | Excellent-rated outputs | 30/30 test queries |
  | Hardware | A10G 24 GB VRAM, ~45 min, ~$1.50 |

- **Experiments directory**: LFM2-1.2B (hybrid architecture) and GEPA (DSPy prompt optimization) experiments present but not in production path.

---

## Recommendation

qmd is the most fully-realized local RAG-for-agents tool surveyed to date. The architecture is sound: the layered retrieval pipeline is well-reasoned, the implementation is clean and well-tested, and the MCP integration is first-class. The 20k+ stars and 25+ community PRs in v2.1.0 suggest active real-world use.

Primary concerns before production adoption: (1) the query-expansion model's training is fully documented in the repo (training data, code, reward function), but the deployed GGUF is hosted on HuggingFace and could be removed or silently updated — the training artifacts allow reproduction but not instant recovery; (2) no wall-clock latency data is published, making it impossible to predict performance on large indexes without self-testing; (3) the HTTP daemon has no authentication.

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
