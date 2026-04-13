---
slug: "colbymchenry-codegraph"
title: "colbymchenry-codegraph — Benchmark Reproduction Guide"
source: "https://github.com/colbymchenry/codegraph"
local_clone: "../../tools/colbymchenry-codegraph"
harness_present: true
harness_path: "tests/evaluation/runner.ts"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# colbymchenry-codegraph — Benchmark Reproduction Guide

**Source**: `tools/colbymchenry-codegraph/` (pinned: `19532a81`)
**Date**: 2026-04-13
**Status**: repro guide only — harness not executed

---

## Harness location

The eval runner is at:

```text
tools/colbymchenry-codegraph/tests/evaluation/runner.ts
```

Supporting files:

```text
tests/evaluation/
  runner.ts       — Main runner (CLI entry point)
  scoring.ts      — Recall and MRR scoring functions
  test-cases.ts   — 12 hardcoded test cases
  types.ts        — EvalReport, EvalResult, EvalTestCase interfaces
```

The harness is also wired into `package.json` as:

```json
"eval": "npm run build && npx tsx tests/evaluation/runner.ts"
```

---

## What the harness measures

The runner tests two CodeGraph APIs:

1. **`searchNodes`** (6 cases) — symbol lookup precision, scored by recall and MRR.
2. **`findRelevantContext`** (6 cases) — exploration quality, scored by recall and edge density.

Pass threshold: `recall >= 0.5` (defined in `scoring.ts`).

**Important caveat**: the 12 test cases are hardcoded to an Elasticsearch/OpenSearch-like codebase (symbols such as `TransportService`, `RestController`, `AllocationService`, `BulkRequest`). The runner is a regression guard for one target codebase, not a general benchmark. The README headline figures (92% fewer tool calls, 71% faster) come from a separate manual benchmark using VS Code, Excalidraw, Alamofire, and Swift Compiler codebases — **the automated runner does not reproduce those figures**.

---

## Environment requirements

- Node.js 18–24 (engine constraint: `>=18.0.0 <25.0.0`)
- npm or npx available
- A pre-indexed codebase with `.codegraph/codegraph.db` present
- The target codebase must contain Elasticsearch/OpenSearch-like symbols for the default test cases to pass; for a different codebase, `test-cases.ts` must be modified with project-specific expected symbols

---

## How to run

### Step 1: Build the package

```bash
cd tools/colbymchenry-codegraph
npm install
npm run build
```

### Step 2: Prepare a target codebase

The default test cases target an Elasticsearch-like Java codebase. To use a different codebase, either:

- Use a clone of Elasticsearch (https://github.com/elastic/elasticsearch) — the test cases reference symbols present in that repo, or
- Edit `tests/evaluation/test-cases.ts` to replace `expectedSymbols` arrays with symbols from your target codebase.

### Step 3: Index the target codebase

```bash
cd /path/to/target-codebase
node /path/to/tools/colbymchenry-codegraph/dist/bin/codegraph.js init -i
```

Or, if installed globally:

```bash
codegraph init -i
```

This creates `.codegraph/codegraph.db`.

### Step 4: Run the eval runner

```bash
cd tools/colbymchenry-codegraph
EVAL_CODEBASE=/path/to/target-codebase npx tsx tests/evaluation/runner.ts
```

Or via npm script (requires build step to be complete):

```bash
cd tools/colbymchenry-codegraph
npm run eval -- /path/to/target-codebase
```

### Step 5: Read results

The runner prints a per-case table to stdout:

```text
  search-class-exact     PASS  recall=1.00  mrr=1.00   12ms
  explore-rest-layer     FAIL  recall=0.25  density=0.42  340ms
        missed: BaseRestHandler, RestHandler
```

A JSON report is saved to `tests/evaluation/results/<timestamp>.json`.

---

## Reproducing the README benchmark (manual, not automated)

The README reports tool-call counts for 6 codebases (VS Code, Excalidraw, Claude Code Python+Rust, Claude Code Java, Alamofire, Swift Compiler) comparing Claude Code with and without CodeGraph. These were produced by manually running Claude Code sessions, not by the eval runner.

To reproduce:

1. Install and index one of the named codebases (e.g., VS Code source).
2. Run Claude Code with CodeGraph enabled and use the exact query from the README benchmark table (e.g., "How does the extension host communicate with the main process?").
3. Record tool call count, elapsed time, and token usage from the Claude Code session log.
4. Repeat without CodeGraph (remove the MCP server config) using the same query.
5. Compare.

This reproduction requires a paid Claude Code session and is not automatable without an API-level tool-call tracing harness.

---

## Notes on this guide

- This guide was written from source review only — neither the eval runner nor the manual benchmark has been executed.
- No stored results exist in the vendored snapshot (`tests/evaluation/results/` is absent).
- The eval runner's test cases use `npx tsx` to run TypeScript directly; `tsx` is not listed as a dev dependency in `package.json` but is available via `npx`. Alternatively, run after `npm run build` against the compiled output.
