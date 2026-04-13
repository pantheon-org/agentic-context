---
slug: "danjdewhurst-git-semantic-bun"
title: "danjdewhurst-git-semantic-bun — Benchmark Reproduction"
source: "https://github.com/danjdewhurst/git-semantic-bun"
local_clone: "../../tools/danjdewhurst-git-semantic-bun"
harness_present: true
harness_path: "scripts/perf-ci.ts"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# danjdewhurst-git-semantic-bun — Benchmark Reproduction

**Source**: `tools/danjdewhurst-git-semantic-bun/` (pinned: `1743d3e9`, 2026-02-26)
**Date**: 2026-04-13
**Environment**: not yet run — this is a repro guide only
**Outcome**: not attempted

---

## Harness location

Two distinct harnesses are present:

```text
scripts/perf-ci.ts                  # CI performance regression suite
src/commands/benchmark.ts           # gsb benchmark command (ranking latency + ANN recall)
test/performance-baseline.test.ts   # Bun unit test: performance smoke test
test/performance-smoke.test.ts      # Bun unit test: warm search smoke test
```

npm scripts (from `package.json`):

```text
bun run perf:ci       # scripts/perf-ci.ts --baseline .github/perf-baseline.json --output perf-artifacts/perf-snapshot.json
bun run perf:baseline # scripts/perf-ci.ts --write-baseline ...  (writes a new baseline)
bun test              # full test suite including performance smoke tests
```

## What the harnesses measure

### `bun run perf:ci` (scripts/perf-ci.ts)

- Builds a synthetic 5,000-commit index with 32-dimension fake vectors (`GSB_FAKE_EMBEDDINGS=1`).
- Runs three suites: cold search (load + embed + search, 15 iterations), warm search (model pre-loaded, 30 iterations), and index load (20 iterations).
- Compares results against `.github/perf-baseline.json` and fails if any metric exceeds the allowed regression threshold (300% of baseline by default).
- Does **not** test real embedding model throughput — vectors are synthetic.

Committed baseline (`.github/perf-baseline.json`):

| Suite | p50 ms | p95 ms | mean ms |
|---|---|---|---|
| cold (load+embed+search) | 8.7 | 26.8 | 10.3 |
| warm (model pre-loaded) | 1.5 | 2.3 | 1.6 |
| index load | 4.0 | 6.3 | 4.6 |

Note: these figures use 32-dim fake vectors, not 384-dim `Xenova/all-MiniLM-L6-v2` embeddings.

### `gsb benchmark <query>` (src/commands/benchmark.ts)

- Runs against a real indexed repository.
- Measures ranking latency: full O(n log n) sort vs heap O(n log k) top-K.
- With `--ann`: measures ANN (HNSW) recall@k vs exact search, and latency speedup.
- Supports `--save` / `--history` to track results in `benchmarks.jsonl`.
- Does **not** measure semantic recall — no relevance labels required or used.

## Environment requirements

```text
Bun >= 1.3.9     (hard requirement — Bun-native project, not Node-compatible)
git              (for gsb commands; not needed for perf-ci.ts on its own)
usearch          (optional — bun add usearch — for ANN benchmark)
```

The perf CI script (`bun run perf:ci`) creates and destroys a temp directory; no real git repo is needed. The `gsb benchmark` command requires an initialised and indexed git repository.

## How to run the CI performance harness

```bash
cd tools/danjdewhurst-git-semantic-bun
bun install
bun run perf:ci
```

Expected output (if no regression):

```text
Perf snapshot written: perf-artifacts/perf-snapshot.json
cold: p50=...ms p95=...ms mean=...ms
warm: p50=...ms p95=...ms mean=...ms
indexLoad: p50=...ms p95=...ms mean=...ms
Perf guardrails: PASS
```

To write a new baseline from the current machine:

```bash
bun run perf:baseline
```

## How to run the unit test suite

```bash
cd tools/danjdewhurst-git-semantic-bun
bun install
bun test
```

The test suite includes `test/performance-baseline.test.ts` and `test/performance-smoke.test.ts`, which assert on warm search latency using fake embeddings against a small fixture index. The golden ranking test (`test/ranking-golden.test.ts`) validates the hybrid scoring formula against `test/fixtures/ranking-golden.json`.

## How to run gsb benchmark against a real repo

```bash
cd <any git repository>
bun add -g github:danjdewhurst/git-semantic-bun  # or use local clone

gsb init
gsb index
gsb benchmark "fix authentication timeout" -i 50 -n 10
gsb benchmark "fix authentication timeout" -i 50 -n 10 --ann  # if usearch installed
gsb benchmark "fix authentication timeout" --save
gsb benchmark --history
```

## Repro status

Not attempted. This guide covers how to run the harnesses; actual reproduction (comparing measured figures to the committed baseline on the same synthetic dataset) was not performed.

To reproduce, run `bun run perf:ci` as described above. The baseline in `.github/perf-baseline.json` was produced on the author's machine; expect different absolute numbers on different hardware, but relative regressions should be consistent within the same machine.
