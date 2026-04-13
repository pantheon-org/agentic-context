---
slug: "jgravelle-jcodemunch-mcp"
title: "Benchmark Reproduction — jcodemunch-mcp"
source: "https://github.com/jgravelle/jcodemunch-mcp"
local_clone: "../../tools/jgravelle-jcodemunch-mcp"
harness_present: true
harness_path: "benchmarks/harness/run_benchmark.py"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# Benchmark Reproduction: jcodemunch-mcp

## Harness location

`benchmarks/harness/run_benchmark.py` in the upstream repo (verified from vendored source at `tools/jgravelle-jcodemunch-mcp/benchmarks/harness/run_benchmark.py`). Task corpus at `benchmarks/tasks.json` (verified present in vendored source).

The harness:

- Bootstraps `src/` into `sys.path` (line 43) so it imports `jcodemunch_mcp` directly without installing.
- Reads `benchmarks/tasks.json` for repos and queries (falls back to hardcoded values if absent).
- Calls `search_symbols` and `get_symbol_source` from `jcodemunch_mcp.tools` directly (not via MCP transport).
- Counts tokens with `tiktoken cl100k_base` on serialised JSON responses.
- Outputs markdown tables; optional `--out FILE` and `--json FILE` flags.

## Methodology (verified from source)

Verified from `benchmarks/harness/run_benchmark.py` and `benchmarks/METHODOLOGY.md`:

- **Baseline**: iterate `index.source_files`, read each file from the content cache directory, count tokens with `tiktoken cl100k_base`. This is the minimum cost for a "read everything once" agent.
- **jcodemunch workflow**: `search_symbols(repo, query, max_results=5)` (count JSON response tokens) + `get_symbol_source(repo, symbol_id)` for the top 3 hits (count each JSON response). Total = search tokens + 3 × symbol-source tokens.
- **Token count**: serialised JSON response tokens (includes field-name overhead; slightly understates reduction vs raw-source comparison).
- **Reduction formula**: `(1 - jmunch_tokens / baseline_tokens) * 100`.
- **AI summaries**: disabled during benchmarking (signature-only fallback).

## Canonical results (verified from vendored source)

The results in `benchmarks/results.md` (run 2026-03-28) differ from the original triage. The triage figures were from an earlier, smaller index state. The figures below are verified from the vendored source file.

| Repository | Files indexed | Symbols | Baseline tokens | jMunch avg tokens | Avg reduction |
|---|---:|---:|---:|---:|---:|
| expressjs/express | 165 | 181 | 137,978 | ~924 | 99.4% |
| fastapi/fastapi | 951 | 5,325 | 699,425 | ~1,834 | 99.8% |
| gin-gonic/gin | 98 | 1,489 | 187,018 | ~1,124 | 99.4% |
| Grand total (15 task-runs) | — | — | 5,122,105 | 19,406 | **99.6%** |

Per-query range (from results.md): 99.2% (context-bind on gin) – 99.9% (error-exception on fastapi).

**Real-world A/B test** (from `benchmarks/results.md`, contributor @Mharbulous): 50-iteration test on a Vue3+Firebase production codebase comparing JCodeMunch vs native Grep/Glob/Read tools. End-to-end token savings: 36% (mean total tokens: 449,356 native → 289,275 jCodemunch). Cost savings: 20% (Wilcoxon p=0.0074). Success rate: 80% vs 72% on naming audit task. Raw data: https://gist.github.com/Mharbulous/bb097396fa92ef1d34d03a72b56b2c61

## Reproduction steps

```sh
# Install the tool plus the tiktoken dependency
pip install "jcodemunch-mcp[all]" tiktoken

# Index the three benchmark repos (downloads and indexes from GitHub)
jcodemunch-mcp index expressjs/express
jcodemunch-mcp index fastapi/fastapi
jcodemunch-mcp index gin-gonic/gin

# Option A: run from the installed package (harness imports jcodemunch_mcp from sys.path)
git clone https://github.com/jgravelle/jcodemunch-mcp
cd jcodemunch-jcodemunch-mcp
python benchmarks/harness/run_benchmark.py --out benchmarks/results.md

# Option B: run from the vendored source (no separate clone needed)
# (from the research repo root)
cd tools/jgravelle-jcodemunch-mcp
pip install -e ".[all]"
pip install tiktoken
python benchmarks/harness/run_benchmark.py --out benchmarks/results.md
```

## Environment requirements

- Python >= 3.10
- `jcodemunch-mcp[all]` — installs `tree-sitter-language-pack`, `mcp`, `httpx`, `pathspec`, `pyyaml`, optional extras
- `tiktoken` — token counting (not included in jcodemunch-mcp dependencies; must be installed separately)
- Internet access to GitHub API for `index` commands (repos are downloaded and cached locally at `~/.code-index/`)
- Disk space: allow ~500 MB for the three repos plus their indexes

## Task corpus

Five queries defined in `benchmarks/tasks.json` (verified present in vendored source):

| Query ID | Query string | Intent |
|---|---|---|
| `router-route-handler` | `router route handler` | Core route registration / dispatch |
| `middleware` | `middleware` | Middleware chaining and execution |
| `error-exception` | `error exception` | Error handling and exception propagation |
| `request-response` | `request response` | Request/response object definitions |
| `context-bind` | `context bind` | Context creation and parameter binding |

## Verification status

Not yet run independently. The harness is present in vendored source and verified to be runnable. Key checks to perform during reproduction:

1. Confirm baseline token counts match the figures in results.md (verifies that the same repo state / index version was used).
2. Confirm jcodemunch token counts match published per-query figures.
3. Record any divergence in the reproduced results table below.

Note: the harness reads from the locally indexed repos in `~/.code-index/`. If the benchmark repos are indexed at a different commit than the author's run, baseline token counts may differ.

## Reproduced results

Not yet run.

| Repository | Baseline tokens | jCodeMunch avg tokens | Avg reduction | Delta vs reported |
|---|---:|---:|---:|---:|
| expressjs/express | — | — | — | — |
| fastapi/fastapi | — | — | — | — |
| gin-gonic/gin | — | — | — | — |
| Grand total | — | — | — | — |

## Known methodology limitations

1. Baseline is a lower bound — real agents re-read files, so production savings are typically higher.
2. Five queries cannot represent all code exploration patterns; results for specific use cases will vary.
3. No quality / retrieval precision measurement in this harness; precision is tracked separately in jMunchWorkbench (separate repo, not publicly accessible in vendored source).
4. Single tokeniser (`cl100k_base`); Claude-specific tokeniser may produce slightly different counts.
5. Benchmark repos are web-framework codebases; flat script collections or large monorepos with highly interdependent files may show lower savings.
6. The harness calls tool functions directly (no MCP transport), so latency and transport overhead are not measured.
