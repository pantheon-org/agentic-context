# jdocmunch-mcp — Benchmark Reproduction

**Source**: `https://github.com/jgravelle/jdocmunch-mcp` (v1.7.1)
**Date**: 2026-04-10
**Outcome**: not reproduced — no executable harness exists; narrated case studies only

---

## Harness location

There is no executable benchmark harness in the repository. The `benchmarks/` directory
contains three narrated case-study documents:

```text
benchmarks/jDocMunch_Benchmark_Kubernetes.md
benchmarks/jDocMunch_Benchmark_LangChain_MDX.md
benchmarks/jDocMunch_Benchmark_SciPy.md
```

All three were authored by Claude Sonnet 4.6 on the developer's Windows machine on 2026-03-04.
None contain scripts, fixture datasets, or assertion logic that an external party can execute.

---

## What the case studies report (as reported)

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

Where `raw_bytes` is the sum of all section content bytes in matched documents (not just the
returned sections), and `_BYTES_PER_TOKEN = 4`. `tiktoken` (cl100k_base) is used instead if
installed.

This formula systematically overstates savings for documents with many sections where only
one is relevant to the query.

---

## How to attempt reproduction

There is no supported harness. The closest approximation requires:

1. Install jdocmunch-mcp:

```shell
pip install jdocmunch-mcp
```

1. Index a public documentation corpus (Kubernetes docs example):

```shell
jdocmunch-mcp &
# Then via MCP client:
# index_repo(repo="kubernetes/website", subdir="content/en/docs", max_files=500)
```

1. Run the five Kubernetes queries from the benchmark document manually via
   `search_sections` and record `_meta.tokens_saved` and `_meta.latency_ms` from each
   response.
2. Run the batch precision retrieval step via `get_sections` with the five section IDs
   from the query results.

No automated comparison against the reported figures is possible without a fixture dataset
and expected-output assertions.

---

## Assessment

The three case studies demonstrate that the server runs and produces plausible results on
real corpora. The byte figures for the credential plugin section retrieval (863 bytes from
a 95,051-byte file) are consistent with the architecture and independently checkable by
cloning `kubernetes/website` and measuring the relevant file.

The token savings percentages (97–98%) cannot be verified without knowing exactly what "raw
approach" token counts were measured against and which model was used to produce those
estimates. The server's own accounting formula is not equivalent to measuring what an agent
model would have consumed.

Reproducing the latency figures requires Windows 10 Pro / Python 3.14, matching the original
environment; results on other platforms will differ.
