---
slug: "ryandonofrio3-osgrep"
title: "ryandonofrio3-osgrep — Benchmark Reproduction"
source: "https://github.com/Ryandonofrio3/osgrep"
local_clone: "../../tools/osgrep"
harness_present: false
harness_path: null
outcome: "not reproducible — harness missing from repo"
updated: 2026-04-14
---

# ryandonofrio3-osgrep — Benchmark Reproduction

**Source**: `tools/osgrep/` (pinned: `9f2faf7`, v0.5.16)
**Date**: 2026-04-14
**Environment**: not run — harness missing from working tree
**Outcome**: README benchmark is not reproducible from source; internal MRR harness is runnable but covers retrieval quality only, not token counts

---

## Benchmark claims

The README states:

> "In our public benchmarks, `osgrep` can save about 20% of your LLM tokens and deliver a 30% speedup."

Source of these figures: `benchmark/benchmark_opencode.csv` — 10 queries run against the [opencode](https://github.com/sst/opencode) codebase, comparing baseline (no osgrep) vs with osgrep on wall-clock time and API cost.

Raw LLM responses are committed in `benchmark/raw_responses/baseline/` (10 files) and `benchmark/raw_responses/with_osgrep/` (10 files). An HTML chart is at `benchmark/output/benchmark-results.html`.

### CSV summary (as observed from source)

| Query | Baseline time (s) | Baseline cost ($) | osgrep time (s) | osgrep cost ($) | Winner |
|---|---|---|---|---|---|
| authentication + authorization checks | 145 | 0.26 | 94 | 0.26 | tie |
| file watching implementation | 284 | 0.50 | 205 | 0.59 | baseline |
| LSP integration configured | 87 | 0.33 | 68 | 0.23 | osgrep |
| TUI client–server communication | 131 | 0.26 | 134 | 0.38 | osgrep |
| agent types defined | 46 | 0.13 | 93 | 0.31 | baseline |
| terminal rendering + UI state | 179 | 0.66 | 104 | 0.30 | osgrep |
| AI model provider integration | 147 | 0.24 | 63 | 0.21 | osgrep |
| codebase search + navigation | 216 | 0.83 | 93 | 0.23 | osgrep |
| bash command execution + sandboxing | 78 | 0.07 | 58 | 0.11 | osgrep |
| mobile app remote control architecture | 258 | 0.41 | 90 | 0.23 | osgrep |
| **Mean** | **157.1** | **0.359** | **100.2** | **0.285** | **6–2 osgrep** |

Observed from CSV: −36% mean time, −21% mean cost, consistent with README headline.

---

## Harness status

### README benchmark harness — missing

`package.json` defines three benchmark scripts:

```text
benchmark:       ./run-benchmark.sh
benchmark:index: ./run-benchmark.sh $HOME/osgrep-benchmarks --index
benchmark:agent: npx tsx src/bench/benchmark-agent.ts
benchmark:chart: npx tsx src/bench/generate-benchmark-chart.ts
```

**None of these files exist in the working tree** (commit `9f2faf7`):
- `run-benchmark.sh` — absent
- `src/bench/benchmark-agent.ts` — absent (`src/bench/` directory does not exist)
- `src/bench/generate-benchmark-chart.ts` — absent

The benchmark infrastructure has been removed or was never committed alongside the CSV results. Reproduction is not possible from the repo in its current state.

### Internal MRR harness (`src/eval.ts`) — runnable

`eval.ts` defines 70+ `EvalCase` records asserting that specific source files within the osgrep codebase rank first for given natural-language queries. This is a retrieval quality regression suite, **not** a token count or cost benchmark.

To run (requires an indexed copy of the osgrep repo):

```bash
cd tools/osgrep
pnpm install
pnpm build

# First, index the repo against itself
node dist/index.js index --reset

# Then run eval (no dedicated script — must import and execute manually)
# eval.ts exports EvalCase[] and EvalResult types; it must be driven by a runner
# No committed runner script found; experiments/ scripts are ad-hoc explorations
```

`experiments/mrr-sweep.ts`, `experiments/ranking-test.ts`, `experiments/quick_check.ts`, and `experiments/verify-fix.ts` are present but undocumented and not part of a repeatable harness.

### `vitest` test suite

```bash
pnpm test
```

Tests cover unit logic; no integration tests against a real indexed repo were found.

---

## Methodology gaps

| Gap | Detail |
|---|---|
| No runnable harness | `run-benchmark.sh` and `src/bench/` are absent from the repo |
| Corpus undisclosed in README | Identified from CSV content as the opencode codebase; not stated in README |
| No answer quality assessment | CSV records only wall-clock time and API cost; whether osgrep answers were correct or equivalent to baseline is not evaluated |
| 10-query sample | Statistical power is low; 2/10 queries favoured baseline on time; 3/10 cost same or more with osgrep |
| Single codebase | Generalization to other repos is unknown |
| Agent and model unspecified | The agent framework (opencode), model, and prompt templates used are not documented in the CSV or README |

---

## Repro status

**Not reproducible.** The harness scripts referenced in `package.json` are absent from the repository. The raw LLM responses and CSV are committed, but there is no code to re-run the collection or compute aggregate figures from them.

The internal MRR harness (`eval.ts`) is runnable and tests retrieval quality independently of the CSV benchmark, but it measures file-ranking precision, not token or cost savings.
