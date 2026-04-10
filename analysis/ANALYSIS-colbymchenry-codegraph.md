---
title: "Analysis — CodeGraph"
date: 2026-04-10
type: analysis
tool:
  name: "codegraph"
  repo: "https://github.com/colbymchenry/codegraph"
  version: "v0.7.2 (19532a81)"
  language: "TypeScript"
  license: "MIT"
source: "references/colbymchenry-codegraph.md"
---

# ANALYSIS: CodeGraph

---

## Summary

CodeGraph is a Node.js MCP server that pre-indexes a codebase into a Tree-sitter AST-backed SQLite knowledge graph and exposes a single tool — `codegraph_explore` — so Claude Code agents query structure rather than scan files. Self-reported metrics are 94% fewer tool calls and 77% faster exploration; the 94% figure may be genuine (a separate TypeScript eval runner exists in the test suite: `evaluation/runner.ts`), but the README benchmark section copies architecture diagrams and the 8.2× token-reduction table verbatim from `tirth8205/code-review-graph` without attribution. The diagram image references are broken (the `diagrams/` directory does not exist in this repo). **Treat all README benchmark figures as unverified until independently reproduced.**

---

## What it does (verified from source)

### Indexing pipeline

The repository is parsed by WASM-bundled tree-sitter (no native module dependency) into a graph of nodes (functions, classes, imports) and edges (calls, inheritance, test coverage). The graph is persisted to a SQLite file (`.codegraph/codegraph.db`) in the project root.

### Interface / API

Exposed as an MCP server configured via `claude_mcp_config.json`. A single tool is surfaced:

- **`codegraph_explore`** — accepts a natural-language or structured query; performs blast-radius traversal over the pre-built graph and returns the minimal file/symbol set relevant to the agent's question.

The single-tool surface is a deliberate design choice contrasting with the 22-tool surface of `tirth8205/code-review-graph`.

### Dependencies

- Runtime: Node.js 18+
- Language: TypeScript
- Parser: WASM-bundled tree-sitter (zero native deps)
- Storage: SQLite (local)
- No cloud, embedding server, or external model dependency

### Scope / limitations

- 19 languages documented; coverage beyond those is unspecified.
- Benchmarks (own eval runner) tested against 6 open-source repos with a single Explore-agent query type — generalisability to other agent patterns is unquantified.
- Architecture diagrams and the 8.2× benchmark table in the README are copied from `tirth8205/code-review-graph`; the `diagrams/` directory does not exist; image refs are broken.

---

## Benchmark claims — verified vs as-reported

### README integrity issue

The upstream README copies verbatim from `tirth8205/code-review-graph`:

- Architecture diagrams (image refs broken — `diagrams/` directory absent from this repo).
- The 8.2× token-reduction benchmark table (CRG's data, not CodeGraph's).
- The eval command `code-review-graph eval --all` (CRG's CLI, not this tool's).

These figures **must not be attributed to CodeGraph**.

### Own eval runner

CodeGraph has a separate TypeScript eval runner (`evaluation/runner.ts`) that tests against `.codegraph/codegraph.db`. The following figures derive from this runner (as reported, README):

| Metric | Value | Status |
|---|---|---|
| Fewer tool calls vs no graph | 94% | as reported — not independently reproduced |
| Faster exploration (avg, 6 repos) | 77% | as reported — not independently reproduced |
| Per-repo range (tool calls) | 84–96% fewer | as reported — not independently reproduced |

The existence of the eval runner makes the 94% / 77% figures plausible. No independent reproduction has been attempted.

### What the 8.2× table is NOT

The 8.2× token-reduction table in CodeGraph's README is CRG's benchmark data. Do not cite it as CodeGraph's performance. Until CodeGraph's own runner output is captured and verified, there is no token-reduction figure for this tool.

---

## Architectural assessment

### What's genuinely novel

1. **WASM-bundled tree-sitter**: zero native module dependencies. `npm install -g @colbymchenry/codegraph` completes without a C compiler, node-gyp, or Rosetta translation on any platform. This is the lowest-friction install of any AST-backed graph tool in this survey.

2. **Single-tool surface**: `codegraph_explore` is the entire MCP interface. Agents make one call instead of choosing among 22 tools (CRG). The blast-radius traversal is internal to the server — the agent does not need to know the graph schema. This reduces prompt engineering overhead and eliminates tool-selection errors.

3. **Chronological precedence over CRG**: CodeGraph was created 2026-01-18; `tirth8205/code-review-graph` launched 2026-02-26. The shared README content flowed from CRG into CodeGraph, not the reverse. CodeGraph's architectural approach predates the better-known CRG.

4. **Blast-radius traversal**: `codegraph_explore` computes the minimal file set for the question — it returns not just the target symbol but its callers, callees, and test coverage. This is the same value proposition as `trace_call_path` in `codebase-memory-mcp` but presented as a single opaque call.

### Gaps and risks

- **README damage**: The copied benchmark content and broken diagram refs reduce credibility and make it impossible to assess the tool's actual performance from the README alone. Any evaluation must use the bundled eval runner (`evaluation/runner.ts`) directly.
- **Benchmarks not independently reproduced**: The 94% / 77% figures are plausible but unverified. The eval runner tests only one Explore-agent query pattern against 6 repos — may not generalise.
- **Lower adoption than CRG**: 412 stars vs CRG's higher adoption. Smaller community means fewer bug reports, less ecosystem testing, and a higher risk of unmaintained issues accumulating.
- **Single-tool opacity**: `codegraph_explore` hides the traversal strategy. Debugging a bad result requires inspecting the server internals; there is no graph query tool to run ad-hoc structural queries (contrast with `codebase-memory-mcp`'s 14 tools including `query_graph` Cypher access).
- **Incremental update latency on large monorepos**: not documented.
- **No MRR or recall metric**: there is no stated precision/recall figure for `codegraph_explore` query results.

---

## Recommendation

**Conditionally adopt — but verify benchmarks first.** The WASM-bundled install and single-tool surface are genuine advantages for teams that want zero-friction code intelligence without native deps. The blast-radius traversal approach is sound.

**Do not adopt on the basis of README benchmarks.** The 8.2× table is not CodeGraph's data. Before deploying in a token-sensitive pipeline, run `evaluation/runner.ts` against a target codebase and capture the actual output.

**Prefer `codebase-memory-mcp` if structural graph access is needed.** `codebase-memory-mcp` provides 14 tools including Cypher query access, a persistent incremental index, and a single static binary with no Node.js dependency. CodeGraph's advantage is the zero-native-dep install and the simpler single-tool interface.

**Flag the README integrity issue when sharing this analysis.** The copied content is a reputational liability for the tool; any internal evaluation writeup should note it explicitly.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | CodeGraph |
|---|---|
| Approach | Tree-sitter AST → SQLite graph; single blast-radius tool |
| Compression (tool calls) | 94% fewer (as reported, own eval runner — unverified) |
| Compression (speed) | 77% faster (as reported, own eval runner — unverified) |
| Token budget model | None — agent calls one tool; result size varies by traversal depth |
| Injection strategy | On-demand single MCP call; no session-level injection |
| Eviction | N/A — no context injection pipeline |
| Benchmark harness | Yes — `evaluation/runner.ts`; fixture-based; not yet reproduced |
| License | MIT |
| Maturity | v0.7.2; 412 stars; created 2026-01-18 |
| README integrity | Compromised — architecture diagrams and 8.2× table copied from tirth8205/code-review-graph |
