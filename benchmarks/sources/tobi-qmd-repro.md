# qmd — Benchmark Reproduction

**Source**: `https://github.com/tobi/qmd` (v2.1.0, 2026-04-05)
**Date**: 2026-04-10
**Environment**: not run — methodology documented from source inspection
**Outcome**: not reproduced — harness requires ~2 GB GGUF models and a pre-indexed SQLite database

---

## Harness location

```text
src/bench/bench.ts              # primary harness (qmd bench <fixture.json>)
src/bench/score.ts              # scoring: precision@k, recall, MRR, F1
src/bench/types.ts              # fixture schema
src/bench/fixtures/example.json # example fixture (10 queries, 6 documents)
test/eval.test.ts               # vitest unit-style eval suite
test/eval-harness.ts            # standalone CLI runner (bun test/eval-harness.ts)
test/eval-docs/                 # 6 synthetic markdown documents used by the eval suite
```

npm/bun scripts:

```text
bun test                        # runs all tests including eval suite (CI skips hybrid tests)
bun test/eval-harness.ts        # standalone: runs BM25 + query mode, prints hit-rate table
qmd bench <fixture.json>        # CLI: runs fixture against bm25/vector/hybrid/full backends
```

---

## What the harness tests

### vitest eval suite (`test/eval.test.ts`)

Three test suites with explicit vitest thresholds:

**BM25 (FTS)** — synchronous, no models required:

- easy queries (n=6): Hit@3 ≥ 80%
- medium queries (n=6): Hit@3 ≥ 15%
- hard queries (n=6): Hit@5 ≥ 15%
- overall Hit@3 ≥ 40%

**Vector search** — requires embedding model (~300 MB):

- easy queries: Hit@3 ≥ 80%
- medium queries: Hit@3 ≥ 40%
- hard queries: Hit@5 ≥ 35%
- overall Hit@3 ≥ 60%

**Hybrid RRF** — requires embedding model; skipped in CI (`describe.skipIf(!!process.env.CI)`):

- easy: Hit@3 ≥ 80%
- medium (with vectors): Hit@3 ≥ 50%
- hard (with vectors): Hit@5 ≥ 35%
- fusion queries (n=6): Hit@3 ≥ 50%; hybrid must match or beat best individual method
- overall (with vectors): Hit@3 ≥ 60%

The 24 eval queries are categorized as easy (exact keyword), medium (semantic/conceptual), hard (vague/indirect), and fusion (multi-signal). All target one of six synthetic documents covering: API design, startup fundraising, distributed systems, machine learning, remote work policy, and product launch retrospective.

### Benchmark CLI (`qmd bench`)

Fixture format (JSON): `description`, `version`, `collection`, `queries[]`. Each query specifies `id`, `query`, `type` (exact/semantic/topical/cross-domain/alias), `expected_files[]`, `expected_in_top_k`.

Four backends are measured per query:

- `bm25` — `store.searchLex()`
- `vector` — `store.searchVector()`
- `hybrid` — `store.search({ rerank: false })`
- `full` — `store.search({ rerank: true })`

Metrics per backend per query: precision@k, recall, MRR, F1, wall-clock latency (ms). Aggregated summary averages across all queries per backend.

Output formats: human-readable table (default) or `--json`.

---

## Reproduction requirements

```text
Node.js >= 22 or Bun >= 1.0.0
npm install -g @tobilu/qmd          # or: bun install -g @tobilu/qmd
qmd index /path/to/docs             # builds BM25 index
qmd embed                           # downloads ~300 MB embedding model, generates vectors
                                    # full pipeline also needs ~640 MB reranker + ~1.1 GB query expansion model
```

On macOS with Bun:

```sh
brew install sqlite                 # required for sqlite-vec extension support
```

BM25-only reproduction (no models):

```sh
cd /path/to/qmd-repo
bun test test/eval.test.ts          # BM25 suite runs without models
```

Full reproduction with hybrid tests:

```sh
qmd index test/eval-docs
qmd embed
bun test test/eval.test.ts          # all suites including hybrid (CI skip flag not set locally)
```

Custom fixture benchmark:

```sh
qmd bench src/bench/fixtures/example.json
qmd bench src/bench/fixtures/example.json --json
```

---

## Reported figures (from source, as reported)

All figures below are vitest assertion thresholds — lower bounds, not measured values. No point estimates or mean results are published in the repository.

| Backend | Difficulty | Metric | Threshold |
|---|---|---|---|
| BM25 | easy | Hit@3 | ≥ 80% |
| BM25 | medium | Hit@3 | ≥ 15% |
| BM25 | hard | Hit@5 | ≥ 15% |
| BM25 | overall | Hit@3 | ≥ 40% |
| Vector | easy | Hit@3 | ≥ 80% |
| Vector | medium | Hit@3 | ≥ 40% |
| Vector | hard | Hit@5 | ≥ 35% |
| Vector | overall | Hit@3 | ≥ 60% |
| Hybrid | easy | Hit@3 | ≥ 80% |
| Hybrid | medium | Hit@3 | ≥ 50% (with vectors) |
| Hybrid | hard | Hit@5 | ≥ 35% (with vectors) |
| Hybrid | fusion | Hit@3 | ≥ 50% (with vectors) |
| Hybrid | overall | Hit@3 | ≥ 60% (with vectors) |

---

## Notes

- No pre-run benchmark results are committed to the repository. The harness is a user-facing tool, not a CI artifact.
- The hybrid test suite is explicitly skipped in CI because it requires loaded GGUF models, which are not available in the CI environment.
- The synthetic eval corpus (6 documents, 24 queries) is deliberately small and clean. Real-world precision on large, noisy corpora is unknown.
- The `qmd bench` harness supports user-supplied fixtures, enabling domain-specific evaluation — but no community-contributed fixture results have been published.
- Wall-clock latency is measured by the bench harness but not exposed in any published figure.
