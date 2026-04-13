---
slug: colbymchenry-codegraph
title: "Analysis — CodeGraph"
date: 2026-04-10
updated: 2026-04-13
type: analysis
tool:
  name: "codegraph"
  repo: "https://github.com/colbymchenry/codegraph"
  version: "v0.7.2 (19532a81)"
  language: "TypeScript"
  license: "MIT"
source: "references/colbymchenry-codegraph.md"
local_clone: null
reviewed: false
reviewed_date: null
source_reviewed: true
---

# ANALYSIS: CodeGraph

---

## Summary

CodeGraph is a Node.js MCP server that pre-indexes a codebase into a Tree-sitter AST-backed SQLite knowledge graph. It exposes **8 MCP tools** (not 1 as previously stated) including `codegraph_explore` for deep exploration, `codegraph_context` as the primary lightweight tool, plus `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`, `codegraph_status`, and `codegraph_files`. The original triage claim of "a single MCP tool" is incorrect — source review contradicts this.

Self-reported metrics of 94% fewer tool calls and 77% faster exploration are published in a detailed README benchmark table with per-codebase data. The README has been substantially updated since the original triage: the 8.2× token-reduction table and CRG eval command previously flagged as copied content are **no longer present** in the vendored source. The README now contains CodeGraph-specific benchmark data with named codebases and token counts. However, these figures remain unverified by independent reproduction.

---

## README integrity re-assessment (source review)

The original triage flagged the README for copying from `tirth8205/code-review-graph`. Source review of the vendored commit (19532a81) shows:

- **No 8.2× token-reduction table** — absent from README. (verified from source)
- **No `code-review-graph eval --all` command** — absent from README. (verified from source)
- **No `diagrams/` image references** — no broken image links found. (verified from source)
- The README now contains a per-codebase benchmark table with named open-source repos (VS Code, Excalidraw, Alamofire, Swift Compiler) and specific token counts, which are plausible and internally consistent.

The integrity issue documented in the triage appears to have been resolved in this or a prior commit. **The original README damage notice should not be carried forward as a current concern for this version of the tool.**

---

## What it does (verified from source)

### Indexing pipeline (verified)

The repository is parsed by WASM-bundled `web-tree-sitter` + `tree-sitter-wasms` (verified from `package.json` and `src/extraction/` directory). No native C extension is required — the SQLite layer also uses `node-sqlite3-wasm` with `better-sqlite3` as an optional native alternative. The graph is persisted to `.codegraph/codegraph.db` in the project root. (verified)

**Node kinds** (verified from `src/types.ts`): `file`, `module`, `class`, `struct`, `interface`, `trait`, `protocol`, `function`, `method`, `property`, `field`, `variable`, `constant`, `enum`, `enum_member`, `type_alias`, `namespace`, `parameter`, `import`, `export`, `route`, `component`

**Edge kinds** (verified from `src/types.ts`): `contains`, `calls`, `imports`, `exports`, `extends`, `implements`, `references`, `type_of`, `returns`, `instantiates`, `overrides`, `decorates`

**Edge provenance field** (verified): edges carry a `provenance` attribute (one of `tree-sitter`, `scip`, or `heuristic`) so downstream tooling can distinguish high-confidence AST edges from heuristic inferences.

### Database schema (verified from `src/db/schema.sql`)

Four core tables:

- `nodes` — symbols with full location, visibility, async/static/abstract flags, decorators, type params
- `edges` — relationships with source/target FK cascade delete, kind, line/column, provenance
- `files` — tracked files with content hash for incremental change detection
- `unresolved_refs` — cross-file references pending resolution post-indexing

FTS5 virtual table `nodes_fts` on (name, qualified_name, docstring, signature) with INSERT/UPDATE/DELETE triggers to keep it in sync. Symbol search is backed by SQLite FTS5 — no external embedding server. (verified)

### Language support (verified from `src/types.ts` and `DEFAULT_CONFIG`)

19 languages: TypeScript, JavaScript, TSX, JSX, Python, Go, Rust, Java, C, C++, C# (csharp), PHP, Ruby, Swift, Kotlin, Dart, Svelte, Liquid (Shopify), Pascal/Delphi. The `unknown` language value is also valid in the type system. (verified)

### MCP interface (verified — corrects prior triage)

The tool exposes **9 MCP tools**, not 1. (verified from `src/mcp/tools.ts`)

| Tool | Purpose |
|---|---|
| `codegraph_explore` | Deep exploration — returns source sections + relationship map in one call |
| `codegraph_context` | PRIMARY tool — lightweight context for a task |
| `codegraph_search` | Symbol lookup by name (returns locations, no code) |
| `codegraph_callers` | Find all callers of a symbol |
| `codegraph_callees` | Find all callees of a symbol |
| `codegraph_impact` | Impact radius analysis for a symbol |
| `codegraph_node` | Details + optional source for one symbol |
| `codegraph_status` | Index statistics |
| `codegraph_files` | File tree from the index (replaces Glob/ls) |

All tools support a `projectPath` parameter for cross-project queries — CodeGraph instances for other projects are opened on-demand and cached. (verified from `ToolHandler.getCodeGraph()`)

The `codegraph_explore` tool dynamically adjusts its description to include a call budget scaled to project file count (e.g., 1 call for <500 files, up to 5 for >25k files). (verified from `getExploreBudget()`)

Output is capped at 35,000 characters for `codegraph_explore` and 15,000 characters for other tools to prevent context bloat. (verified from `EXPLORE_MAX_OUTPUT` and `MAX_OUTPUT_LENGTH` constants)

### Critical path: agent call → token-reduced output (verified)

For `codegraph_explore`:

1. `ToolHandler.handleExplore()` receives query string and optional `maxFiles` (default 12).
2. Calls `cg.findRelevantContext(query, {searchLimit:8, traversalDepth:3, maxNodes:200, minScore:0.2})`.
3. `findRelevantContext` (in `ContextBuilder`) runs hybrid search:
   a. Extracts potential symbol names from query via regex (CamelCase, snake_case, SCREAMING_SNAKE, acronyms, dot.notation, lowercase identifiers ≥3 chars) with a stopword filter.
   b. Exact name lookup against `nodes` table for extracted symbols.
   c. FTS5 semantic search on `nodes_fts` for remaining budget.
   d. Merges results, applies co-location boosting.
   e. BFS traversal from entry-point nodes (prioritising `contains` edges, then `calls`, then others).
4. Groups resulting nodes by file; scores files (entry-point nodes = 10pts, directly-connected = 3pts, others = 1pt); filters to files with score ≥ 3.
5. Sorts files: query-term matches first, deprioritises test/icon/i18n files, then by score.
6. Clusters nearby symbol ranges within 15-line gap threshold; reads contiguous file sections with 3-line padding.
7. Emits markdown: relationship map grouped by edge kind, then per-file code fences.
8. Hard-truncates at 35k characters.

For `codegraph_context` (lighter path):

1. Calls `cg.buildContext(task, {maxNodes:20, maxCodeBlocks:5, maxCodeBlockSize:1500, traversalDepth:1, searchLimit:3})`.
2. Same hybrid search but shallower traversal (depth 1 vs 3) and tighter node budget.
3. Outputs markdown summary with code snippets for up to 5 key nodes.
4. Appends `"Ask user: UX preferences, edge cases, acceptance criteria"` reminder if query appears to be a feature request (heuristic keyword match). (verified)

### Incremental sync (verified)

`FileWatcher` (in `src/sync/`) uses native OS file-system events (FSEvents on macOS, inotify on Linux, ReadDirectoryChangesW on Windows) via Node.js `fs.watch`, with debouncing. The MCP server calls `cg.watch()` on startup and logs sync activity to stderr. Content-hash-based change detection in the `files` table avoids re-indexing unchanged files. (verified from MCP server `startWatching()` and README)

### Dependencies (verified from `package.json`)

Runtime: `web-tree-sitter`, `tree-sitter-wasms`, `node-sqlite3-wasm`, `commander`, `@clack/prompts`, `picomatch`. Optional: `better-sqlite3` (native, faster SQLite). No cloud or embedding dependency. (verified)

Node.js engine constraint: `>=18.0.0 <25.0.0`. (verified)

---

## Benchmark claims — verified vs as-reported

### README benchmark table (as reported — not independently reproduced)

The vendored README (19532a81) presents a per-codebase benchmark table for 6 codebases. Key figures:

| Metric | Value | Status |
|---|---|---|
| Fewer tool calls vs no graph (average) | 92% | as reported — not independently reproduced |
| Faster exploration (average) | 71% | as reported — not independently reproduced |
| Per-repo tool call reduction | 84–96% fewer | as reported — not independently reproduced |
| VS Code TypeScript (4,002 files, 59,377 nodes) | 3 calls vs 52 | as reported — not independently reproduced |
| Swift Compiler (25,874 files, 272,898 nodes) | 6 calls vs 37 | as reported — not independently reproduced |
| Token usage with CG (typical query) | 40.8k–77.4k | as reported — not independently reproduced |
| Token usage without CG (typical query) | 52.4k–99.1k | as reported — not independently reproduced |

The README claims agents "never fell back to reading files" when using CodeGraph. This is consistent with the 35k character explore output cap and the instruction in the installed CLAUDE.md that tells agents not to re-read files returned by `codegraph_explore`. (verified that the mechanism exists; outcome claim as reported)

Note: the average figures in the headline (94% / 77%) differ slightly from the per-row averages (92% / 71%) in the detailed table — the headline appears to use a different aggregation. This inconsistency is as-reported.

### Own eval runner (verified harness exists — output not reproduced)

The eval runner is at `tests/evaluation/runner.ts`. (verified)

- Runs against a pre-indexed codebase (`EVAL_CODEBASE` env var or CLI arg).
- Requires `.codegraph/codegraph.db` to exist.
- Executes 12 test cases: 6 `searchNodes` cases (exact symbol lookup) and 6 `findRelevantContext` cases (exploration quality).
- Metrics: recall (found/expected symbols), MRR (mean reciprocal rank for search), edge density.
- Pass threshold: recall ≥ 0.5. (verified from `scoring.ts`)
- Saves JSON report to `tests/evaluation/results/`.
- Test cases are hardcoded against an Elasticsearch/OpenSearch-like codebase (symbols: `TransportService`, `RestController`, `AllocationService`, etc.) — the harness is not a general benchmark; it is a regression harness for one specific target codebase. (verified from `test-cases.ts`)

No stored results exist in the vendored snapshot (`results/` directory absent). The harness measures recall and MRR for symbol retrieval — it does **not** directly measure tool-call count reduction or exploration speed (those figures come from the README benchmark, not this runner). (verified)

### What the 8.2× table is (update)

The 8.2× token-reduction table that was flagged in the original triage as copied CRG content is **not present** in the vendored source (19532a81). The README has been updated. The prior warning about CRG-copied content is no longer applicable to this version. (verified from source)

---

## Source review

### Architecture (verified)

```text
src/
  index.ts              Main CodeGraph class — public API
  types.ts              All TypeScript interfaces (Node, Edge, Subgraph, TaskContext, …)
  db/
    schema.sql          4 tables + FTS5 virtual table + 13 indexes
    queries.ts          QueryBuilder with prepared statements
  extraction/
    index.ts            ExtractionOrchestrator (41.7k — largest file)
    tree-sitter.ts      Universal AST parser (86k — language dispatch)
    grammars.ts         Grammar detection + WASM loading
    languages/          Per-language grammar WASM files
  resolution/
    index.ts            ReferenceResolver (post-indexing cross-file resolution)
    frameworks/         Framework-specific patterns (React, Express, Laravel, …)
  graph/
    traversal.ts        BFS + DFS + getCallers/getCallees/getCallGraph/getImpactRadius
    queries.ts          High-level graph queries
  context/
    index.ts            ContextBuilder — hybrid search + BFS expansion + formatter
    formatter.ts        Markdown/JSON output
  sync/                 FileWatcher (debounced fs.watch)
  mcp/
    tools.ts            9 tool definitions + ToolHandler execution
    index.ts            MCPServer — JSON-RPC over stdio
  bin/codegraph.ts      CLI entry point
```

### Key data structures (verified from source)

- **`Node`**: id (hash of path+qualifiedName), kind, name, qualifiedName, filePath, language, startLine, endLine, docstring, signature, visibility, isExported, isAsync, isStatic, isAbstract, decorators (JSON array), typeParameters (JSON array), updatedAt.
- **`Edge`**: source (nodeId), target (nodeId), kind (EdgeKind), metadata (JSON), line, column, provenance (one of `tree-sitter`, `scip`, or `heuristic`).
- **`Subgraph`**: nodes (Map<id, Node>), edges (Edge[]), roots (string[]).
- **`TaskContext`**: query, subgraph, entryPoints (Node[]), codeBlocks (CodeBlock[]), relatedFiles (string[]), summary, stats.

### Context compression mechanism (verified)

CodeGraph does not use token counting or semantic similarity embeddings. Compression is structural:

1. Graph traversal prunes the result to symbols reachable from query entry points within a depth budget.
2. Node-kind filters exclude `import`/`export` nodes from output (high noise, low information density).
3. File scoring (entry 10pts, depth-1 3pts, others 1pt) ensures only structurally-relevant files appear.
4. Symbol clustering merges nearby code ranges, skipping large gaps, so output is dense sections not sparse snippets.
5. Hard output caps (35k explore, 15k others) prevent unbounded context inflation.

There is no embedding model, vector store, or LLM-based summarisation in the pipeline — the entire pipeline is deterministic FTS5 + BFS traversal + file I/O. (verified)

---

## Architectural assessment

### What's genuinely novel (updated from source)

1. **WASM-bundled tree-sitter**: zero native module dependencies. (verified)

2. **Tiered tool surface**: The claim of "single-tool surface" in the triage was incorrect. The tool surface is 9 tools with a clear hierarchy: `codegraph_explore` for deep agent use (via spawned Explore subagents), `codegraph_context` for inline main-session use, and focused tools (callers, callees, impact, node, search, files, status) for targeted lookups. This is a richer and more ergonomic design than the triage described.

3. **Context-budget-aware explore**: `codegraph_explore` dynamically adjusts its call budget recommendation based on project file count — the MCP tool description itself contains "Budget: make at most N calls for this project (X files indexed)". This allows agents to self-regulate without hardcoded limits. (verified from `getExploreBudget()`)

4. **Contiguous section reading over snippet extraction**: `codegraph_explore` reads contiguous file sections (with a 15-line gap merge threshold) rather than extracting individual function bodies. This preserves surrounding context and avoids the "decontextualised snippet" failure mode. (verified)

5. **Hybrid search combining exact symbol lookup with FTS5**: The `findRelevantContext` pipeline first extracts potential symbol names from the query via regex, performs exact DB lookups for those symbols, then supplements with FTS5 search for concept matching. Exact matches are prioritised. (verified)

6. **Installed CLAUDE.md injection**: The installer adds instructions to `~/.claude/CLAUDE.md` that tell the main session to never call `codegraph_explore` directly (to prevent context bloat) and to instead spawn Explore subagents. The main session is restricted to lightweight tools. This is a deliberate architectural pattern for managing context pressure at the session level. (verified from README and installer)

### Gaps and risks (updated from source)

- **Eval harness measures retrieval quality, not token reduction**: The bundled eval runner measures symbol recall and MRR against a fixed Elasticsearch-like codebase. The 92%/94% tool-call reduction figures in the README come from a separate manual benchmark, not the automated runner. The runner cannot validate the headline claims without running CodeGraph against the same codebases used for those benchmarks.
- **Test cases hardcoded to one codebase**: `test-cases.ts` uses Elasticsearch/OpenSearch-specific symbol names. The harness is a regression guard for one target, not a general benchmark suite.
- **No stored eval results**: The `results/` directory is absent from the vendored snapshot. The runner has never been publicly executed against the benchmark codebases with output preserved.
- **Incremental update latency on large monorepos**: `startWatching()` fires sync on every file change. On a codebase with 25k files (Swift Compiler), debounce and batch size behaviour is undocumented. The README claims "<4 minutes for initial index" but ongoing sync latency is unquantified.
- **No MRR or recall metric for explore queries**: The eval harness measures recall for `findRelevantContext` but only tests 6 hardcoded queries. There is no reported aggregate recall figure for `codegraph_explore` over a broad query distribution.
- **Cross-project cache has no eviction policy**: `ToolHandler.projectCache` accumulates open CodeGraph instances with no LRU eviction. Long-running MCP sessions with many cross-project queries will hold all instances open indefinitely. (verified from source)

---

## Recommendation

**Conditionally adopt — the tool is more capable than the triage suggested.** The 9-tool surface, contiguous section reading, dynamic call budgets, and CLAUDE.md injection pattern are all genuine engineering decisions that address context management at multiple levels. The WASM-bundled install is the lowest-friction AST-backed graph tool in this survey.

**The README integrity concern from the original triage is resolved** in this version. The benchmark table is CodeGraph-specific. However, no token-reduction figures are independently verified — use the bundled eval runner against target codebases before deploying in token-sensitive pipelines.

**Prefer `codebase-memory-mcp` if ad-hoc graph query access is required.** `codebase-memory-mcp` provides Cypher query access and a richer tool surface for complex structural analysis. CodeGraph's advantage is zero-native-dep install, the contiguous section reading strategy, and the CLAUDE.md-injection context management pattern.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | CodeGraph |
|---|---|
| Approach | Tree-sitter AST → SQLite (FTS5) graph; hybrid FTS + BFS traversal |
| Compression (tool calls) | 92% fewer avg across 6 codebases (as reported — not independently reproduced) |
| Compression (speed) | 71% faster avg (as reported — not independently reproduced) |
| Token budget model | Dynamic per-project call budget in tool description; hard output caps (35k explore, 15k others) |
| Injection strategy | Main-session CLAUDE.md injection restricts agent to lightweight tools; explore calls delegated to subagents |
| Eviction | N/A — no context injection pipeline; output cap + node budget limit result size |
| Benchmark harness | Yes — `tests/evaluation/runner.ts`; recall+MRR; hardcoded to one Elasticsearch-like codebase; no stored results |
| License | MIT |
| Maturity | v0.7.2; 412 stars; created 2026-01-18 |
| README integrity | Resolved in v0.7.2 — CRG-copied content removed; own benchmark data present |
| MCP tools | 9 (explore, context, search, callers, callees, impact, node, status, files) |
| Native deps | Zero — WASM-bundled tree-sitter + SQLite |
