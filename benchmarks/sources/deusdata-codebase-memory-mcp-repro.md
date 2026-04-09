# codebase-memory-mcp — Benchmark Reproduction

**Source**: `tools/deusdata-codebase-memory-mcp/` (pinned: `d33b9e4`)
**Date**: 2026-04-09
**Environment**: macOS Darwin 25.4.0, codebase-memory-mcp v0.5.7 (pre-built binary)
**Outcome**: partially verified — live queries confirmed compact output; 99.2% reduction claim directional but comparison baseline is naive grep

---

## Live query results (verified)

Indexed `tools/deusdata-codebase-memory-mcp` in fast mode: **24,138 nodes, 51,664 edges**.

5 structural queries run against the live MCP server:

| # | Tool | Query | Response size | Est. tokens |
|---|---|---|---|---|
| 1 | `get_graph_schema` | node/edge type counts | ~600 B | ~150 |
| 2 | `search_graph` | `cbm_pipeline_*` functions (35 found) | ~2.1 KB | ~530 |
| 3 | `trace_call_path` | callers of `cbm_pipeline_run`, depth=3 | ~500 B | ~125 |
| 4 | `search_graph` | `cbm_mcp_handle_tool` with connections | ~250 B | ~65 |
| 5 | `get_architecture` | packages, languages, hotspots | ~900 B | ~225 |
| **Total** | | | **~4.4 KB** | **~1,095** |

Equivalent grep to find all `cbm_pipeline_*` definitions across 673 C files would return hundreds of lines — estimated 5,000–20,000 tokens before model reasoning.

## Notes on 99.2% claim methodology

From the benchmark source file in the repo:

- "Tokens" = all input + output tokens during the 12-question answering session, including Claude's reasoning about tool results — not just raw tool output.
- Baseline = file-by-file grep, not optimized focused reads or RAG.
- Single scenario on one repo (not disclosed which repo).

This means the comparison is favorable: grep forces the model to reason over large raw context; graph queries return pre-structured answers. Savings vs focused file reads or optimized RAG would be lower.

## Reproduction instructions

The token benchmark is not a runnable harness — it is an author-run session whose methodology is documented in a markdown file in the repo. No reproducible benchmark script exists.

To replicate live queries:

```shell
# Install binary
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash

# Index a repo
codebase-memory-mcp cli index_repository '{"repo_path":"/path/to/repo"}'

# Run structural queries via MCP (or CLI)
codebase-memory-mcp cli get_graph_schema '{"project":"<project-name>"}'
codebase-memory-mcp cli search_graph '{"project":"<project-name>","name_pattern":"<pattern>","label":"Function"}'
codebase-memory-mcp cli trace_call_path '{"project":"<project-name>","function_name":"<fn>","direction":"inbound","depth":3}'
```

Compare token counts in Claude Code's `/cost` output or token logging against equivalent `grep -r` operations.

## Test suite

Pure C unit tests in `tests/test_*.c`. Requires building from source:

```shell
make test
```

Tests cover: arena allocator, C LSP, CLI, file discovery, dynamic arrays, hash tables, logging, MCP protocol, memory, parallel execution, platform, simhash, store bulk/edges, traces, UI, and integration. No standalone token benchmark harness.
