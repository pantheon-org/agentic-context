---
slug: "glitterkill-sdl-mcp"
title: "glitterkill-sdl-mcp — Benchmark Reproduction Guide"
source: "https://github.com/GlitterKill/sdl-mcp"
local_clone: "../../tools/glitterkill-sdl-mcp"
harness_present: true
harness_path: "scripts/real-world-benchmark.ts"
outcome: "repro guide (not run)"
updated: 2026-04-14
---

# glitterkill-sdl-mcp — Benchmark Reproduction Guide

**Source**: `tools/glitterkill-sdl-mcp/` (pinned: `492b5e8`)
**Date**: 2026-04-14
**Status**: repro guide only — harness not executed

---

## Harness location

The primary real-world benchmark is at:

```text
tools/glitterkill-sdl-mcp/scripts/real-world-benchmark.ts
tools/glitterkill-sdl-mcp/scripts/real-world-benchmark-matrix.ts
```

Supporting files:

```text
benchmarks/real-world/
  tasks.json               — Task definitions (code review, bug fix, feature review, etc.)
  matrix.json              — Matrix of task × repo combinations
  CLAIMS.md                — Formal claim policy and gate thresholds
  external-repos.config.json — External OSS repos used as benchmark corpora
  symptom-tasks.json       — Symptom-driven task definitions

config/
  benchmark.ci.config.json   — CI threshold config (indexing + quality metrics)
  benchmark.config.json      — Local benchmark config (repo paths)

scripts/
  check-benchmark-claims.ts  — Validates aggregate output against claim gates
  benchmark.ts               — Indexing microbenchmark
  budget-sensitivity-sweep.ts — Sensitivity analysis over budget parameters
```

npm scripts:

```json
"benchmark:real":   "node scripts/real-world-benchmark.ts",
"benchmark:matrix": "node scripts/real-world-benchmark-matrix.ts",
"benchmark:claims": "node scripts/check-benchmark-claims.ts",
"benchmark:ci":     "node dist/cli/index.js benchmark:ci"
```

---

## What the harness measures

The real-world benchmark compares two workflows end-to-end for engineering tasks:

- **Traditional**: file search + open files (approximates baseline LLM file reads)
- **SDL-MCP**: symbol search → Symbol Cards → slice → skeletons

Task families covered by `tasks.json`:

| Family | Examples |
|--------|---------|
| Code review | PR review, diff analysis |
| Feature review | Understanding new code paths |
| Bug fixing | Locating and diagnosing failures |
| Feature understanding | Comprehending architectural areas |
| Code change implementation | Implementing a described change |
| Performance investigation | Profiling and bottleneck analysis |
| Impact analysis | Blast-radius for a proposed change |
| Test triage | Identifying failing or flaky tests |

**Key metrics** (from `benchmarks/real-world/README.md`):

| Metric | Definition |
|--------|-----------|
| Token Reduction | % fewer tokens than traditional at task completion |
| File Coverage | relevant files found / relevant files total |
| Symbol Coverage | relevant symbols found / relevant symbols total |
| Composite Score | Weighted: token efficiency + coverage quality + efficiency + precision |

**Formal claim gates** (from `benchmarks/real-world/CLAIMS.md`):

- `p50(capped token reduction) >= 50%` per family (realism profile)
- `p25(capped token reduction) >= 40%` per family
- Per-task floor: `capped reduction >= 20%`

**Important distinction**: the headline 81% figure in the README applies to `tools/list` payload size reduction (gateway vs. flat schema surface), which is **not** what this harness measures. The harness measures end-to-end task-level token reduction. These are separate claims with different methodologies.

---

## Environment requirements

- Node.js 24+ (required by SDL-MCP)
- A built SDL-MCP (run `npm run build:all` first)
- External benchmark repos (downloaded by `benchmark:setup-external`)
- The `benchmarks/real-world/benchmark.config.json` must be built by merging the local config with external-repos config (see step 3 below)
- A running SDL-MCP server instance (for the SDL-MCP workflow arm)

The benchmark config at `benchmarks/real-world/benchmark.config.json` contains Windows-absolute paths (`F:/Claude/projects/...`) indicating it was authored on a Windows machine. These paths must be updated to local absolute paths before running.

---

## How to run

### Step 1: Build SDL-MCP

```bash
cd tools/glitterkill-sdl-mcp
npm install
npm run build:all
```

### Step 2: Download external benchmark repos

```bash
cd tools/glitterkill-sdl-mcp
npm run benchmark:setup-external
```

This clones the OSS repos referenced in `benchmarks/real-world/external-repos.config.json` (e.g., zod, preact) into `.tmp/external-benchmarks/`.

### Step 3: Build merged benchmark config

```bash
cd tools/glitterkill-sdl-mcp
node -e "
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('config/sdlmcp.config.json', 'utf8'));
const e = JSON.parse(fs.readFileSync('benchmarks/real-world/external-repos.config.json', 'utf8'));
fs.writeFileSync(
  'benchmarks/real-world/benchmark.config.json',
  JSON.stringify({ ...b, repos: [...(b.repos || []), ...(e.repos || [])] }, null, 2) + '\n'
);
"
```

Then edit `benchmarks/real-world/benchmark.config.json` to replace any Windows-absolute `rootPath` values with local paths.

### Step 4: Run the matrix benchmark

```bash
cd tools/glitterkill-sdl-mcp
npm run benchmark:matrix -- \
  --matrix benchmarks/real-world/matrix.json \
  --config benchmarks/real-world/benchmark.config.json \
  --out-dir benchmarks/real-world/runs/coverage-matrix
```

### Step 5: Validate claim thresholds

```bash
cd tools/glitterkill-sdl-mcp
node --experimental-strip-types scripts/check-benchmark-claims.ts \
  --in benchmarks/real-world/runs/coverage-matrix/aggregate.json \
  --profile realism
```

Exit code 0 = all claim gates pass. Results are written to `aggregate.json`.

### CI regression benchmarks (indexing + quality)

```bash
cd tools/glitterkill-sdl-mcp
npm run benchmark:ci
```

This runs the indexing microbenchmark against CI thresholds defined in `config/benchmark.ci.config.json` (e.g., max 3000ms per file, min 5 symbols per file, graph connectivity ≥ 0.3).

---

## Notes on this guide

- This guide was written from source review only — neither the real-world benchmark nor the CI regression suite has been executed in this analysis.
- The benchmark config contains Windows-absolute paths that require updating for non-Windows environments; this is a friction point for reproduction.
- The 81% `tools/list` token reduction (gateway vs. flat mode) is a separate claim not tested by this harness; it would require measuring the raw schema payload size of `tools/list` responses under each mode, which is not covered by any script in the repo.
- The formal claim gates in `CLAIMS.md` apply only to the benchmarked matrix (specific OSS repos × task families); performance on other repos or task shapes is not guaranteed.
- LLM-generated Symbol Card summaries are produced at index time; the benchmark does not disclose which model was used for this step or what it cost.
