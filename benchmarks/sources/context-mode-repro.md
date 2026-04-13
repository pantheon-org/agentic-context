---
slug: "context-mode"
title: "context-mode — Benchmark Reproduction"
source: "https://github.com/mksglu/context-mode"
local_clone: "../../tools/context-mode"
harness_present: true
harness_path: "tests/benchmark.ts"
outcome: "partially verified"
updated: 2026-04-13
---

# context-mode — Benchmark Reproduction

**Source**: `tools/context-mode/` (pinned: `601aaf1`)
**Date**: 2026-04-09
**Environment**: macOS Darwin 25.4.0, Node.js v24.14.1
**Outcome**: partially verified — context savings confirmed; session aggregate unverified (fixture-based)

---

## Harness location

```text
tools/context-mode/tests/benchmark.ts           # primary harness
tools/context-mode/tests/context-comparison.ts  # side-by-side comparison
tools/context-mode/tests/ecosystem-benchmark.ts # cross-platform scenarios
```

npm scripts (from `package.json`):

```text
npm run benchmark        # npx tsx tests/benchmark.ts
npm run test:use-cases   # npx tsx tests/use-cases.ts
npm run test:compare     # npx tsx tests/context-comparison.ts
npm run test:ecosystem   # npx tsx tests/ecosystem-benchmark.ts
```

## Reproduction attempt

Run at pinned commit `601aaf1`, macOS Darwin 25.4.0, Node.js v24.14.1, Bun 1.3.11, Python 3.14.3.
Dev dependencies required a separate `npm install` in the submodule before `npx tsx` was available.

**Context savings (verified)**:

| Scenario | Raw | Output | Savings |
|---|---|---|---|
| API Response (200 users) | ~49 KB | 22 B | 100% |
| Build Output (500 lines) | ~24 KB | 37 B | 100% |
| Log File (1000 entries) | ~78 KB | 67 B | 100% |
| npm ls output | ~39 KB | 25 B | 100% |

**Cold start latency (verified)**:

| Runtime | Avg | Min | P95 |
|---|---|---|---|
| JavaScript (Bun) | 2851 ms | 2315 ms | 3650 ms |
| TypeScript (Bun) | 3418 ms | 3062 ms | 3854 ms |
| Python | 1958 ms | 1558 ms | 2679 ms |
| Shell | 2553 ms | 2402 ms | 3122 ms |
| Perl | 1182 ms | 289 ms | 3671 ms |

Note: the README and BENCHMARK.md do not disclose subprocess cold start overhead.

## How to reproduce

```shell
cd tools/context-mode
npm install                          # install dev deps (tsx, vitest, etc.)
npm run benchmark 2>&1 | tee benchmark-out.txt
```

Expected output: per-scenario table with raw KB, context KB, and savings %.
Compare against `BENCHMARK.md` figures in the same directory.

## Reported figures (from BENCHMARK.md, as reported)

| Metric | Value |
|---|---|
| Total scenarios | 21 |
| Total raw data | 376 KB |
| Total context consumed | 16.5 KB |
| Overall savings | 96% |

Session aggregate (curated fixture): 177 KB raw → 10.2 KB context (94%, ~45,300 → ~2,600 tokens)

## Notes

- Fixture corpus is curated (Playwright snapshots, GitHub Issues, CSV data, etc.) — not drawn from a real debugging session.
- Savings on `ctx_execute_file` (95–100%) depend on the agent writing an effective summarization script. The harness likely uses pre-written scripts optimized for the fixture data.
- `ctx_index`+`ctx_search` savings (44–93%) depend on query quality and corpus density.
