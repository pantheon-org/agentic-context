---
slug: "tobi-qmd"
title: "qmd — Benchmark Reproduction"
source: "https://github.com/tobi/qmd"
local_clone: "../../tools/tobi-qmd"
harness_present: true
harness_path: "src/bench/bench.ts"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# qmd — Benchmark Reproduction

**Source**: `https://github.com/tobi/qmd` (v2.1.0, 2026-04-05)
**Date**: 2026-04-10; source-verified 2026-04-13
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

**Vector search** — requires embedding model (~300 MB); skipped in CI:

- easy queries: Hit@3 ≥ 60%
- medium queries: Hit@3 ≥ 40%
- hard queries: Hit@5 ≥ 30%
- overall Hit@3 ≥ 50%

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

## Fine-tune training harness (`finetune/`)

A complete Python training pipeline for the `qmd-query-expansion-1.7B` model ships in the repo under `finetune/`. This is separate from the search benchmark harness and covers the model training side.

### Structure

```text
finetune/
├── train.py                     # SFT entrypoint (Qwen3-1.7B + LoRA)
├── eval.py                      # Generate + score expansion outputs
├── reward.py                    # Rule-based scoring function (single source of truth)
├── convert_gguf.py              # GGUF conversion for deployment
├── SCORING.md                   # Full scoring rubric
├── configs/sft.yaml             # SFT hyperparameters
├── data/                        # JSONL training data (~2,290 examples)
│   ├── qmd_expansion_balanced_deduped.jsonl
│   ├── qmd_expansion_v3_structured.jsonl
│   └── ... (10+ source files, concatenated for training)
├── dataset/
│   ├── schema.py                # Pydantic TrainingExample schema
│   ├── prepare_data.py          # Format, dedup, split train/val
│   └── validate_schema.py       # Schema validation
├── evals/queries.txt            # 31 test queries across 8 categories
├── experiments/
│   ├── grpo/                    # Experimental GRPO path
│   └── lfm2/                    # LiquidAI LFM2-1.2B experiments
└── jobs/                        # Self-contained HuggingFace Jobs scripts
```

### Running the fine-tune eval

```sh
cd finetune
pip install uv
uv run eval.py tobil/qmd-query-expansion-1.7B       # score deployed model
uv run eval.py ./outputs/sft                         # score local SFT output
uv run eval.py tobil/qmd-query-expansion-1.7B -v    # verbose with deduction details
uv run eval.py tobil/qmd-query-expansion-1.7B -o scores.json
```

The `reward.py` scoring function is entirely rule-based (no LLM judge): five dimensions — Format (0–30), Diversity (0–30), HyDE (0–20), Quality (0–20), Entity preservation (−45 to +20) — normalized to 0.0–1.0. Max score is 140 (with HyDE), 120 without.

### Running SFT training

```sh
cd finetune
uv run dataset/prepare_data.py                       # create data/train/train.jsonl + val.jsonl
uv run train.py sft --config configs/sft.yaml        # requires CUDA GPU
# or via HuggingFace Jobs (no local GPU):
hf jobs uv run --flavor a10g-large --secrets HF_TOKEN --timeout 2h jobs/sft.py
```

Training hyperparameters (from `configs/sft.yaml`): base model `Qwen/Qwen3-1.7B`, LoRA rank 16 alpha 32, all projection layers, ~2,290 training examples, effective batch 16, 5 epochs, lr 2e-4 cosine.

### Published training results (from `finetune/README.md`)

| Stage | Metric | Value |
|---|---|---|
| SFT | Final train loss | 0.472 |
| SFT | Final eval loss | 0.304 |
| SFT | Token accuracy (train) | 97.4% |
| SFT | Token accuracy (eval) | 93.8% |
| SFT | Eval average score (reward fn) | 92.0% |
| SFT | Excellent-rated outputs (30/30) | 30/30 test queries |
| Hardware | | A10G (24 GB VRAM), ~45 min, ~$1.50 |

These are training metrics, not retrieval benchmark results. They measure model format compliance and query expansion quality, not end-to-end search Hit@k.

### HuggingFace repositories

| Repo | Purpose |
|---|---|
| `tobil/qmd-query-expansion-1.7B` | Final merged model (SFT) |
| `tobil/qmd-query-expansion-1.7B-gguf` | GGUF quantized for deployment |
| `tobil/qmd-query-expansion-1.7B-sft` | SFT adapter checkpoint |
| `tobil/qmd-query-expansion-train` | Prepared training dataset |
| `tobil/qmd-query-expansion-1.7B-grpo` | Experimental GRPO adapter |

---

## Reported figures (from source, as reported)

All figures below are vitest assertion thresholds — lower bounds, not measured values. No point estimates or mean results are published in the repository.

| Backend | Difficulty | Metric | Threshold |
|---|---|---|---|
| BM25 | easy | Hit@3 | ≥ 80% |
| BM25 | medium | Hit@3 | ≥ 15% |
| BM25 | hard | Hit@5 | ≥ 15% |
| BM25 | overall | Hit@3 | ≥ 40% |
| Vector | easy | Hit@3 | ≥ 60% |
| Vector | medium | Hit@3 | ≥ 40% |
| Vector | hard | Hit@5 | ≥ 30% |
| Vector | overall | Hit@3 | ≥ 50% |
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
