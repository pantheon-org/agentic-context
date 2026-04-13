---
slug: "jgravelle-jdocmunch-mcp"
title: "jdocmunch-mcp — Benchmark Reproduction"
source: "https://github.com/jgravelle/jdocmunch-mcp"
local_clone: "../../tools/jgravelle-jdocmunch-mcp"
harness_present: true
harness_path: "benchmarks/wiki/run_benchmark.py"
outcome: "partially verified"
updated: 2026-04-13
---

# jdocmunch-mcp — Benchmark Reproduction

**Source**: `https://github.com/jgravelle/jdocmunch-mcp` (v1.8.0)
**Date**: 2026-04-13
**Outcome**: partially reproducible — one executable harness found at
`benchmarks/wiki/run_benchmark.py`; three older narrated case studies remain non-executable

---

## Harness location

### Executable harness (new in v1.8.0)

```text
benchmarks/wiki/run_benchmark.py     (12.2 KB)
benchmarks/wiki/results_jcodemunch_wiki.json
benchmarks/wiki/results_jcodemunch_wiki.md
```

`run_benchmark.py` is a self-contained Python script that:

1. Accepts a path to a cloned GitHub wiki (`git clone <repo>.wiki.git`)
2. Scans all `.md` files and tokenizes them with tiktoken `cl100k_base`
3. Parses the wiki into heading-delimited sections using an offline approximation of
   jDocMunch's section parser (a simplified in-script splitter, not the production
   `parse_markdown()` code path)
4. For each query, finds the best-matching section by keyword overlap
5. Reports two baselines: full-wiki concatenation and single-file (conservative)
6. Adds a hardcoded `SEARCH_META_TOKENS = 190` overhead to simulate `search_sections` JSON

**Caveats**:

- The section parser in the harness is a stripped-down heading splitter that does not
  replicate the production `make_hierarchical_slug`, byte-offset tracking, or
  `wire_hierarchy()` logic. Section boundaries may differ from what the server would produce.
- `SEARCH_META_TOKENS = 190` is an estimate measured from real responses by the developer;
  it is not computed from live MCP calls in the script.
- The scoring function used to select the best section (`find_best_section`) is a simple
  word-overlap counter, not the weighted multi-field scoring in `DocIndex._lexical_search`.
- The script runs entirely offline and does not require a running MCP server.

### Narrated case studies (non-executable)

```text
benchmarks/jDocMunch_Benchmark_Kubernetes.md
benchmarks/jDocMunch_Benchmark_LangChain_MDX.md
benchmarks/jDocMunch_Benchmark_SciPy.md
benchmarks/jDocMunch_Benchmark_Wiki.md
```

All four were authored by the developer (Claude Sonnet 4.6 on Windows). None contain scripts,
fixture datasets, or assertion logic.

---

## Reproducing the wiki harness

### Prerequisites

```shell
pip install tiktoken
git clone https://github.com/jgravelle/jcodemunch-mcp.wiki.git /tmp/jcodemunch-wiki
```

### Run

```shell
python tools/jgravelle-jdocmunch-mcp/benchmarks/wiki/run_benchmark.py /tmp/jcodemunch-wiki
```

With custom queries and output files:

```shell
python tools/jgravelle-jdocmunch-mcp/benchmarks/wiki/run_benchmark.py /tmp/jcodemunch-wiki \
    --queries "cross repo dependency" "benchmark token" "search scoring" \
    --out /tmp/results.md --json /tmp/results.json
```

### Expected output shape

Markdown tables with:

- Corpus summary (file count, bytes, tokens)
- Full-wiki baseline: baseline tokens vs. jDocMunch tokens per query, savings %, ratio
- Single-file baseline (conservative): assumes the agent already knows which file to open
- Per-query detail: target file, matched section, section bytes/tokens, jDocMunch total tokens

The developer-run results at `benchmarks/wiki/results_jcodemunch_wiki.md` used the
`jcodemunch-mcp` wiki (7 content pages, 68 sections, 29 KB, 7,449 baseline tokens) and
reported 82–97% reduction per query vs. full-wiki baseline.

---

## What the narrated case studies report (as reported)

### Kubernetes corpus

- Corpus: `kubernetes/website` docs directory, 1,569 `.md` files (16 MB), 500 indexed.
- Sections extracted: 4,355.
- Index time: 3,352 ms.
- Five parallel queries at 83–100 ms each.
- Batch precision retrieval (5 sections in one call): 754 ms.
- Tokens saved across 5 queries: ~34,222 (as reported by server `_meta`).
- Largest single-file reduction: 95,051-byte `authentication.md` → 863 bytes fetched (110x).

### SciPy corpus

- Corpus: `scipy/doc`, 430 files (24 MD + 406 RST), 3.4 MB.
- Sections extracted: 10,402.
- Index time: 2,247 ms.
- 12 domain queries at 129–153 ms each.

### LangChain MDX corpus

- Corpus: 500 LangChain/LangGraph/LangSmith `.mdx` files.
- Before MDX support: 200 files indexed, 699 sections (490 MDX files inaccessible).
- After MDX support: 500 files indexed, 5,973 sections (+754%).
- Index time: 5,204 ms (vs ~800 ms for `.md`-only run).

---

## Savings formula (verified from source)

The `tokens_saved` value in each `_meta` response is computed in
`storage/token_tracker.py::estimate_savings()`:

```python
def estimate_savings(raw_bytes: int, response_bytes: int) -> int:
    return max(0, (raw_bytes - response_bytes) // _BYTES_PER_TOKEN)
```

Where `raw_bytes` — as computed in `tools/search_sections.py` — is the sum of all section
content bytes in every document that contributed a result, not just the bytes of sections
actually returned:

```python
matched_doc_paths = {r.get("doc_path") for r in results}
raw_bytes = sum(
    len(s.get("content", "").encode("utf-8"))
    for s in index.sections
    if s.get("doc_path") in matched_doc_paths
)
```

`_BYTES_PER_TOKEN = 4`. `tiktoken` (cl100k_base) is used instead if installed.

This formula systematically overstates savings for documents with many sections where only
one or a few are relevant to the query.

---

## Live MCP reproduction (narrated case studies)

No automated comparison against the reported figures from the three older case studies is
possible. The closest approximation:

1. Install jdocmunch-mcp:

```shell
pip install jdocmunch-mcp
```

1. Index a public documentation corpus (Kubernetes docs example):

```shell
# Start MCP server, then via MCP client:
# index_repo(repo="kubernetes/website", subdir="content/en/docs", max_files=500)
```

1. Run the five Kubernetes queries manually via `search_sections`, record
   `_meta.tokens_saved` and `_meta.latency_ms`.
2. Run batch precision retrieval via `get_sections` with the section IDs from step 3.

No fixture dataset or expected-output assertions exist for these older benchmarks.

---

## Assessment

The wiki harness (`run_benchmark.py`) is reproducible by any external party with `pip install
tiktoken` and a cloned wiki. It is the first independently runnable benchmark in this tool.
However, its offline section parser is a simplified approximation of the production code path,
and its search scoring differs from the server's weighted multi-field algorithm. Results will
be directionally correct but not identical to what a live MCP session would produce.

The three older case studies and the TOKEN_SAVINGS.md figures (97–98%) remain unverifiable
without the original corpora, exact query set, and server state used in measurement. The
server's savings accounting inflates numbers relative to what an agent would actually consume.
Treat those figures as illustrative upper bounds, not reproducible measurements.
