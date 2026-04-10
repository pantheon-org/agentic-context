---
title: "Benchmark Reproduction — jcodemunch-mcp"
date: 2026-04-10
type: benchmark-repro
tool: "jcodemunch-mcp"
repo: "https://github.com/jgravelle/jcodemunch-mcp"
harness: "benchmarks/harness/run_benchmark.py"
status: "not-yet-run"
---

# Benchmark Reproduction: jcodemunch-mcp

## Harness location

`benchmarks/harness/run_benchmark.py` in the upstream repo, with task corpus at `benchmarks/tasks.json`.

## Methodology (as documented by author)

- **Baseline**: concatenate all indexed source files; count tokens with `tiktoken cl100k_base`.
- **jcodemunch workflow**: `search_symbols` (top 5) + `get_symbol_source` x 3 hits per query.
- **Token count**: serialised JSON response tokens (includes field-name overhead; slightly understates reduction vs raw-source comparison).
- **Reduction formula**: `(1 - jmunch_tokens / baseline_tokens) * 100`.

## Canonical results (as reported)

| Repository | Baseline tokens | jCodeMunch avg tokens | Reduction |
|---|---:|---:|---:|
| expressjs/express (34 files, 117 symbols) | 73,838 | ~1,300 | 98.4% |
| fastapi/fastapi (156 files, 1,359 symbols) | 214,312 | ~15,600 | 92.7% |
| gin-gonic/gin (40 files, 805 symbols) | 84,892 | ~1,730 | 98.0% |
| Grand total (15 task-runs) | 1,865,210 | 92,515 | 95.0% |

Per-query range: 79.7% (dense FastAPI router query) – 99.8% (sparse context-bind query on Express).

## Reproduction steps

```sh
pip install "jcodemunch-mcp[all]" tiktoken

# Index the three benchmark repos
jcodemunch-mcp index_repo expressjs/express
jcodemunch-mcp index_repo fastapi/fastapi
jcodemunch-mcp index_repo gin-gonic/gin

# Clone the repo to access the harness
git clone https://github.com/jgravelle/jcodemunch-mcp
cd jcodemunch-mcp

# Run the benchmark; output written to results.md
python benchmarks/harness/run_benchmark.py --out benchmarks/results.md
```

## Task corpus

Five queries defined in `benchmarks/tasks.json`, run against all three repos:

| Query | Intent |
|---|---|
| `router route handler` | Core route registration / dispatch |
| `middleware` | Middleware chaining and execution |
| `error exception` | Error handling and exception propagation |
| `request response` | Request/response object definitions |
| `context bind` | Context creation and parameter binding |

## Verification status

Not yet run independently. The harness is public and the steps above are sufficient to reproduce. Key checks to perform:

- Confirm baseline token counts match published figures (verifies index completeness).
- Confirm jcodemunch token counts match published figures per repo.
- Record any divergence in the results table below.

## Reproduced results

Not yet run.

| Repository | Baseline tokens | jCodeMunch avg tokens | Reduction | Delta vs reported |
|---|---:|---:|---:|---:|
| expressjs/express | — | — | — | — |
| fastapi/fastapi | — | — | — | — |
| gin-gonic/gin | — | — | — | — |

## Known methodology limitations

1. Baseline is a lower bound — real agents re-read files, so production savings are typically higher.
2. Five queries cannot represent all code exploration patterns; results for specific use cases will vary.
3. No quality / retrieval precision measurement in this harness; precision is tracked separately in jMunchWorkbench (separate repo, not publicly accessible).
4. Single tokeniser (`cl100k_base`); Claude-specific tokeniser may produce slightly different counts.
