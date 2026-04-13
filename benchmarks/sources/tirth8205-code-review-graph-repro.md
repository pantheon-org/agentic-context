---
slug: "tirth8205-code-review-graph"
title: "tirth8205-code-review-graph — Benchmark Reproduction Guide"
source: "https://github.com/tirth8205/code-review-graph"
local_clone: "../../tools/tirth8205-code-review-graph"
harness_present: true
harness_path: "code_review_graph/eval/runner.py"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# tirth8205-code-review-graph — Benchmark Reproduction Guide

**Source**: `tools/tirth8205-code-review-graph/` (pinned: v2.3.1, commit `36777165`)
**Date**: 2026-04-13
**Status**: repro guide only — harness not executed in this session

---

## Harness location

The eval runner lives inside the Python package:

```text
tools/tirth8205-code-review-graph/
  code_review_graph/eval/
    init.py              — Public API; lazy-imports runner (requires pyyaml)
    runner.py            — Orchestrator: clone repos, build graphs, run benchmarks, write CSVs
    scorer.py            — compute_token_efficiency, compute_mrr, compute_precision_recall
    reporter.py          — Markdown and CSV report generators
    token_benchmark.py   — Workflow-level token benchmarks (review, architecture, debug, onboard, pre_merge)
    benchmarks/
      token_efficiency.py   — Per-commit naive vs diff vs graph token counts
      impact_accuracy.py    — Precision/recall/F1 for blast-radius predictions
      search_quality.py     — MRR for keyword search
      flow_completeness.py  — Flow detection recall
      build_performance.py  — Full build time and search latency
    configs/
      express.yaml    — 2 pinned commits (qs CVE fix, res.type edge-case tests)
      fastapi.yaml    — 2 pinned commits
      flask.yaml      — 2 pinned commits
      gin.yaml        — 3 pinned commits
      httpx.yaml      — 2 pinned commits
      nextjs.yaml     — 2 pinned commits
```

The runner is also wired into the CLI as `code-review-graph eval` (defined in `cli.py`).

---

## What the harness measures

Five benchmark types, each backed by a `run(repo_path, store, config)` function:

| Benchmark | Primary metric | Notes |
|---|---|---|
| `token_efficiency` | naive_to_graph_ratio | Naive = full changed-file contents; graph = `get_review_context` JSON output; token count = `len(text) // 4` |
| `impact_accuracy` | precision / recall / F1 | Ground truth = changed files + files with CALLS/IMPORTS_FROM edges to changed nodes |
| `search_quality` | MRR | Expected result matched by substring of qualified_name |
| `flow_completeness` | recall | Entry points detected vs expected from YAML config |
| `build_performance` | build_ms, search_latency_ms | Wall time for full build and single search |

The README table (8.2× average, 100% recall, MRR 0.35) is produced by running all five benchmarks across all six repos.

---

## Key methodological notes

**Token counting approximation**: token count is `len(text) // 4` — a rough character-to-token ratio. For code, actual token counts from a BPE tokenizer (e.g., tiktoken/cl100k) will differ, typically by 10–30%. The 8.2× ratio may shift when re-run with a real tokenizer.

**Impact accuracy ground truth is circular**: the benchmark computes ground truth from the same graph's edge data (`CALLS`, `IMPORTS_FROM` edges). This means a file is "actually impacted" only if the graph contains a relevant edge — inflating recall to 100% by construction. The benchmark validates internal consistency, not independent ground truth.

**Token efficiency methodology gap**: the benchmark compares naive (full changed files) to graph (`get_review_context`) but does not include a diff-only baseline. A reviewer using only `git diff` would produce far fewer tokens than reading full files. The `standard_tokens` field (diff tokens) is computed but not used in the headline ratio.

---

## Environment requirements

- Python 3.10–3.13
- `uv` recommended (or `pip`)
- `pyyaml` (included in `[eval]` extra)
- `matplotlib` (included in `[eval]` extra)
- Git (for cloning benchmark repos and computing diffs)
- Network access (clones 6 real repos from GitHub)
- Disk: ~500 MB for 6 repo clones

---

## How to run

### Step 1: Install with eval extras

From the vendored source:

```bash
cd tools/tirth8205-code-review-graph
pip install -e ".[eval]"
```

Or with uv:

```bash
cd tools/tirth8205-code-review-graph
uv pip install -e ".[eval]"
```

To also reproduce community detection (Leiden) and search quality with semantic embeddings:

```bash
pip install -e ".[eval,communities,embeddings]"
```

### Step 2: Run the full benchmark suite

```bash
code-review-graph eval --all
```

This will:

1. Clone or update all 6 repos into `evaluate/test_repos/`
2. Build the code graph for each repo
3. Run all 5 benchmark types against each repo
4. Write CSV results to `evaluate/results/`
5. Print a summary table

To run a single repo:

```bash
code-review-graph eval --repo fastapi
```

To run a single benchmark type:

```bash
code-review-graph eval --benchmark token_efficiency
```

### Step 3: Generate the report

```bash
code-review-graph eval --report
```

Writes a Markdown summary to `evaluate/reports/summary.md`.

Alternatively, invoke the reporter directly:

```python
from code_review_graph.eval import generate_markdown_report
report = generate_markdown_report(results)
print(report)
```

---

## Expected output (as reported in README)

| Repo | Commits | Avg Naive Tokens | Avg Graph Tokens | Reduction |
|------|--------:|-----------------:|----------------:|----------:|
| express | 2 | 693 | 983 | 0.7x |
| fastapi | 2 | 4,944 | 614 | 8.1x |
| flask | 2 | 44,751 | 4,252 | 9.1x |
| gin | 3 | 21,972 | 1,153 | 16.4x |
| httpx | 2 | 12,044 | 1,728 | 6.9x |
| nextjs | 2 | 9,882 | 1,249 | 8.0x |
| **Average** | **13** | | | **8.2x** |

Impact accuracy across all repos: 100% recall, 0.54 average F1, 0.38 average precision.

Search quality (MRR): 0.35 (keyword search only; not re-run with semantic embeddings in this guide).

---

## Notes on this guide

- This guide was produced from source review only. The harness has not been executed; figures above are as-reported by the tool authors.
- The 49x figure from the README monorepo diagram has no corresponding benchmark config or YAML entry and cannot be reproduced using the eval harness.
- The `evaluate/reports/summary.md` referenced in the README does not exist in the vendored snapshot — it is generated on first run.
- For a meaningful token efficiency comparison, consider adding a `diff_to_graph_ratio` column (`standard_tokens / graph_tokens`) to see how the tool compares to a reviewer using only `git diff`.
