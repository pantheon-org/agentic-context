---
slug: tirth8205-code-review-graph
title: "Analysis — code-review-graph"
date: 2026-04-13
type: analysis
tool:
  name: "code-review-graph"
  repo: "https://github.com/tirth8205/code-review-graph"
  version: "v2.3.1"
  language: "Python"
  license: "MIT"
source: "references/tirth8205-code-review-graph.md"
local_clone: null
reviewed: true
reviewed_date: 2026-04-13
source_reviewed: true
updated: null
---

# ANALYSIS: code-review-graph

---

## Summary

code-review-graph is a Python MCP server that indexes a codebase via Tree-sitter into a local SQLite knowledge graph and exposes **24 MCP tools** (not 22 as triage reported — see Source review below) plus 5 prompt templates for code review, blast-radius analysis, community detection (Leiden), wiki generation, and multi-repo search. The 8.2× average token reduction claim (range 0.7×–16.4×) is self-reported from an internal eval runner; the harness exists in source and is reproducible but has not been executed in this session. The feature surface — particularly blast-radius analysis, community detection, cross-repo registry, and D3.js visualisation — is the broadest of any Python MCP tool in this survey, but several capabilities (embeddings, community detection, wiki) require optional dependencies that are disabled by default.

---

## What it does (from reference documentation)

### Indexing pipeline

Repository parsed by Tree-sitter into SQLite nodes and edges stored under `.code-review-graph/`. Blast-radius, dependency chains, and test-coverage gaps are pre-computed at index time. Optional vector embeddings (sentence-transformers, Google Gemini, or MiniMax) stored alongside for hybrid FTS5+vector search. Community detection via the Leiden algorithm groups related code into clusters. Execution flow analysis traces call chains ranked by criticality.

Supported languages: 19 languages plus Jupyter and Databricks notebooks (as reported, README — README is stale; source at v2.3.1 contains 22 language parsers; see Source review). Incremental updates reported as under 2 seconds (as reported, README — not verified by running the tool).

### 24 MCP tools (verified — README says 22, source has 24)

Tool surface verified from `code_review_graph/main.py` — 24 `@mcp.tool()` decorators registered at server startup:

`build_or_update_graph_tool`, `run_postprocess_tool`, `get_minimal_context_tool`, `get_impact_radius_tool`, `query_graph_tool`, `get_review_context_tool`, `semantic_search_nodes_tool`, `embed_graph_tool`, `list_graph_stats_tool`, `get_docs_section_tool`, `find_large_functions_tool`, `list_flows_tool`, `get_flow_tool`, `get_affected_flows_tool`, `list_communities_tool`, `get_community_tool`, `get_architecture_overview_tool`, `detect_changes_tool`, `refactor_tool`, `apply_refactor_tool`, `generate_wiki_tool`, `get_wiki_page_tool`, `list_repos_tool`, `cross_repo_search_tool`.

The README table lists 22 tools and omits `run_postprocess_tool` and `get_minimal_context_tool`. Both are present in source. `get_minimal_context_tool` is the entry-point tool described in CLAUDE.md as the recommended first call for any task (costs ~100 tokens, returns a full structural overview). `run_postprocess_tool` runs community detection, flow analysis, and embedding after a graph build.

This is the largest MCP tool surface of any tool in this survey (vs 14 for `deusdata-codebase-memory-mcp`, 1 for `colbymchenry/codegraph`).

### 5 prompt templates (verified)

`review_changes`, `architecture_map`, `debug_issue`, `onboard_developer`, `pre_merge_check` — confirmed in `code_review_graph/prompts.py` and registered in `main.py`.

### Slash commands

`/code-review-graph:build-graph`, `/code-review-graph:review-delta`, `/code-review-graph:review-pr`.

### Multi-platform install

`code-review-graph install` auto-configures Claude Code, Cursor, Windsurf, Zed, Continue, OpenCode, and Antigravity — plus Codex (added in v2.3.0). That is 8 named platforms in the README; Codex support is confirmed in CHANGELOG v2.3.0. The README still lists 7 in some places (Antigravity instead of Codex in older text); source and CHANGELOG confirm 8 including Codex.

---

## Benchmark claims — as-reported vs verified

### Token efficiency (8.2× average claim)

**Claim**: 8.2× average token reduction across 6 repositories (naive vs graph); range 0.7×–16.4×.

**Methodology (partially verified)**: Internal eval runner at `code_review_graph/eval/`; comparison is naive file read (full file contents of changed files) vs graph query (`get_review_context`). The harness clones each of 6 real open-source repos at pinned commits, builds the graph, and runs `_count_file_tokens` (naive) vs `get_review_context` JSON output (`graph_tokens`). Token counting uses `len(text) // 4` — a rough approximation, not a tokenizer. The low end (0.7× on express single-file changes) and high end (16.4× on gin) are consistent with the methodology: small single-file repos produce more metadata overhead than file content saved; large multi-file repos see large savings. The per-repo table in the README is reproducible using `code-review-graph eval --all` with the 6 YAML configs in `code_review_graph/eval/configs/`.

**The 49× claim**: Sourced from the monorepo diagram caption ("Next.js monorepo: 27,732 files funnelled through code-review-graph down to ~15 files — 49x fewer tokens"). The diagram is a static image asset (`diagrams/diagram6_monorepo_funnel.png`); the 49× figure is not backed by a benchmark config or harness entry. It should not be cited without independent reproduction. (attempted — inconclusive)

**MRR 0.35**: The tool's own benchmarks report MRR 0.35 for keyword search. The MRR harness is implemented in `code_review_graph/eval/benchmarks/search_quality.py` using reciprocal rank against `expected` qualified-name substrings from YAML configs. The score is consistent with known limitations of FTS5 on module-pattern naming (express module exports return 0 hits). (partially verified — methodology confirmed in source; numeric value not re-executed)

**Status**: The eval runner is present and executable (`pip install code-review-graph[eval]` + `code-review-graph eval --all`). The 8.2× average and 0.7×–16.4× range are directionally consistent with the methodology and the design. No independent execution was performed in this session; the per-repo table is self-reported but backed by a reproducible harness. See `benchmarks/sources/tirth8205-code-review-graph-repro.md` for reproduction instructions.

### Indexing speed (as reported, not verified)

Incremental updates reported as under 2 seconds. README cites a 2,900-file project re-indexing in under 2 seconds. Build performance benchmark in `code_review_graph/eval/benchmarks/build_performance.py` measures full build time; incremental timing is not separately benchmarked.

---

## Source review

### Architecture (verified)

The package is organised as a single Python package (`code_review_graph/`) with the following key modules confirmed in source:

- `main.py` — FastMCP server entry point (stdio transport). Registers 24 tools and 5 prompts. Uses `asyncio.to_thread` for 5 heavy tools to prevent event-loop blocking on Windows (added v2.3.1).
- `parser.py` — Tree-sitter multi-language AST parser. `EXTENSION_TO_LANGUAGE` dict at line 74 contains 38 extension mappings across 22 distinct language backends (Python, JavaScript, TypeScript, TSX, Go, Rust, Java, C#, Ruby, C, C++, Kotlin, Swift, PHP, Scala, Solidity, Vue, Dart, R, Perl, Lua, LuaU, Objective-C, Bash, Elixir, notebook). The README still states "19 languages" — it was not updated when Elixir, Objective-C, and Bash/Shell were added in v2.3.0.
- `graph.py` — SQLite-backed graph store. Blast-radius analysis implemented as a SQLite recursive CTE (`WITH RECURSIVE impacted(node_qn, depth) AS (...)`) walking both forward and backward edges up to `MAX_IMPACT_DEPTH`. A legacy NetworkX BFS path exists and is selectable via `CRG_BFS_ENGINE=networkx`.
- `communities.py` — Leiden algorithm via `igraph.Graph.community_leiden(objective_function="modularity", weights="weight", n_iterations=2)`. Falls back to file-path grouping when `igraph` is not installed. Edge weights are typed: CALLS=1.0, INHERITS=0.8, IMPLEMENTS=0.7, DEPENDS_ON=0.6, TESTED_BY=0.4, IMPORTS_FROM=0.5, CONTAINS=0.3.
- `eval/` — Full benchmark harness. Five benchmark types: `token_efficiency`, `impact_accuracy`, `flow_completeness`, `search_quality`, `build_performance`. Six YAML configs (`express`, `fastapi`, `flask`, `gin`, `httpx`, `nextjs`) with pinned commit SHAs and search queries. The runner clones repos, builds graphs, and writes CSV results to `evaluate/results/`.
- `tools/` — Tool implementations split across: `build.py`, `context.py`, `query.py`, `review.py`, `flows_tools.py`, `community_tools.py`, `refactor_tools.py`, `registry_tools.py`, `docs.py`, `_common.py`.
- `visualization.py` — D3.js interactive HTML graph generator (79 KB; embeds a full force-directed graph template with SRI-hashed CDN script tag).
- `migrations.py` — SQLite schema migrations v1–v5; WAL mode enabled.

### Tool count discrepancy

The README and triage both report 22 tools. Source (`main.py`) has **24 `@mcp.tool()` decorators**. The two undocumented tools are:

1. `get_minimal_context_tool` — The recommended entry point per CLAUDE.md: "First call: `get_minimal_context(task="<description>")` — costs ~100 tokens, gives you the full picture." Returns a compact structural summary to guide subsequent tool selection. Not listed in the README tool table.
2. `run_postprocess_tool` — Triggers community detection, flow analysis, and optional embedding computation after a graph build. Added as a separate async tool in v2.3.1 to allow background post-processing without blocking. Not listed in the README tool table.

This is a documentation lag, not a feature gap — both tools are fully implemented.

### Blast-radius mechanism (verified)

`GraphStore.get_impact_radius()` in `graph.py` delegates to `get_impact_radius_sql()` by default. The SQL implementation uses a bidirectional recursive CTE walking `edges` forward (`source → target`) and backward (`target → source`) up to `MAX_IMPACT_DEPTH` hops, seeding from all nodes in the changed files. Results are truncated at `MAX_IMPACT_NODES`. The legacy NetworkX BFS path is available via env var but not the default. The impact accuracy benchmark (`eval/benchmarks/impact_accuracy.py`) defines ground truth as changed files plus files with CALLS or IMPORTS_FROM edges pointing into changed nodes — this circular definition (the graph is both the system under test and the ground truth source) is a methodological limitation not disclosed in the README.

### Community detection algorithm (verified)

`communities.py` implements `_detect_leiden()` using `igraph.Graph.community_leiden()` with `objective_function="modularity"`, typed edge weights, and `n_iterations=2` (capped to avoid exponential blow-up on large repos, per code comment). Undirected graph. Falls back to file-path grouping when igraph is absent. Community names are auto-generated from dominant class names or most-frequent non-stopword tokens in member node names. Cohesion scores are computed as internal edge density. The quality of Leiden partitions on code dependency graphs is not benchmarked in the eval suite.

### Version discrepancy

pyproject.toml specifies `version = "2.3.1"`. The README version badge still shows `v2.1.0` (stale static badge). The prior triage recorded v2.2.2. The vendored source is v2.3.1.

---

## Architectural assessment

### What's genuinely novel

1. **Broadest feature surface in Python MCP category.** 24 tools (verified) covering blast-radius analysis, community detection (Leiden), cross-repo multi-registry search, interactive D3.js visualisation, and LLM-assisted wiki generation in a single `pip install`. No other Python MCP code intelligence tool in this survey combines all five capability areas.

2. **Community detection via Leiden algorithm (verified).** Grouping related code into semantic clusters is not present in `deusdata-codebase-memory-mcp` or `colbymchenry/codegraph`. Useful for onboarding and architectural review, though quality on arbitrary codebases is not benchmarked.

3. **9-platform auto-install (partially verified — 8 in README, Codex confirmed in CHANGELOG v2.3.0).** `code-review-graph install` detects and configures AI coding platforms automatically — the most complete multi-platform install story in this category.

4. **Hybrid search architecture (when embeddings enabled).** FTS5 keyword search combined with optional dense vector embeddings (sentence-transformers, Gemini, MiniMax) enables semantic queries not possible in graph-only tools. The MRR 0.35 for keyword-only mode highlights why the optional semantic layer matters.

5. **Active external community.** 7,624 stars (as reported, 2026-04-08), Discord, dedicated website (code-review-graph.com), external contributors. Development pace is high and AI-assisted (Claude Opus 4 co-authorship visible in commit history).

6. **`get_minimal_context_tool` as a guided entry point (verified, not in triage).** The undocumented 23rd tool returns a compact structural overview (~100 tokens) and a `next_tool_suggestions` field guiding the agent's next call. This is a deliberate UX pattern for token-efficient multi-step agent workflows, documented in the project's CLAUDE.md but absent from the public README.

### Gaps and risks

- **8.2× claim is self-reported; harness is reproducible but not executed here.** The eval runner exists (`pip install code-review-graph[eval]` + `code-review-graph eval --all`), is backed by pinned commits and YAML configs, and the methodology is sound. The 49× figure has no harness entry and should be treated as marketing.
- **Impact accuracy ground truth is circular.** The `impact_accuracy` benchmark computes ground truth from the same graph it is evaluating. A file is "actually impacted" if the graph contains a CALLS or IMPORTS_FROM edge from it to a changed node. This inflates the recall metric (100%) since the predicted set is a superset of what the graph's own edges return.
- **MRR 0.35 is low.** FTS5 keyword search alone returns poor recall. Effective use of the tool likely requires enabling optional semantic embeddings — which are disabled by default and require either local model installation or an external API key.
- **Optional dependencies gate key features.** Community detection (igraph), semantic search (sentence-transformers/Gemini/MiniMax), and wiki generation (ollama) are all opt-in. The default install is a structural graph only; the advertised feature set requires additional setup.
- **Community detection quality unquantified.** Leiden clustering on arbitrary codebases may produce noisy, unhelpful clusters. No benchmark for cluster quality is provided.
- **README is out of date.** Version badge shows v2.1.0 (actual: v2.3.1). Tool count says 22 (actual: 24). Language count says 19 (actual: 22 after v2.3.0 additions). Relying on the README for capability assessment will undercount the tool surface.
- **Python runtime adds deployment friction vs single-binary alternatives.** `pip install` with optional deps and potential Python version conflicts contrast with the zero-dep binary model of `deusdata-codebase-memory-mcp`.
- **AI-assisted commit pace introduces review risk.** High-velocity AI-assisted development (Claude Opus 4 co-authorship) at 7,624 stars means correctness of recent commits should be treated with some caution until the eval harness is verified.
- **No authentication on visualisation or MCP.** D3.js HTML output and local MCP server have no access controls mentioned in documentation.
- **Relationship to colbymchenry/codegraph**: Independent tools; neither is a fork of the other. codegraph (2026-01-18) predates CRG (2026-02-26) but CRG has eclipsed it in adoption. codegraph's README copies CRG's architecture diagrams and benchmark table without attribution; CRG is the original source.

---

## Recommendation

**Adopt for complex multi-file review and onboarding tasks where token cost is the bottleneck.** The blast-radius and community detection tools offer structural insights that embedding-based RAG cannot replicate. The 24-tool surface provides fine-grained agent control over what context is retrieved.

**Enable optional embeddings before relying on search.** MRR 0.35 for keyword search means default-install search quality is poor. Budget for sentence-transformers (local) or a Gemini API key to unlock hybrid search.

**Do not cite the 49× figure.** It has no stated methodology or harness entry. Use the 8.2× average (0.7×–16.4× range) with the caveat that it is self-reported; the harness is reproducible but has not been independently executed.

**Treat community detection results as exploratory.** Leiden clustering on arbitrary codebases is a starting point for investigation, not authoritative module boundaries.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | code-review-graph |
|---|---|
| Approach | Tree-sitter AST → SQLite knowledge graph; blast-radius + community detection + hybrid search |
| Compression (vs naive) | 8.2× average (self-reported, range 0.7×–16.4×); 49× "daily tasks" claim (attempted — inconclusive, no harness entry) |
| MCP tool count | 24 tools (verified from source) + 5 prompt templates; README states 22 (stale) |
| Token budget model | None — query results bounded by result set size |
| Injection strategy | On-demand MCP tool calls; no session-level injection |
| Eviction | N/A — no context injection pipeline |
| Benchmark harness | `code_review_graph/eval/` runner (verified — exists, pinned configs, reproducible; not independently executed) |
| Keyword search quality | MRR 0.35 (partially verified — methodology confirmed in source; numeric value not re-executed) |
| License | MIT |
| Maturity | v2.3.1 (pyproject.toml); 7,624 stars (as reported, 2026-04-08); 897 forks; created 2026-02-26; active external community |
| Runtime | Python 3.10+; optional deps for embeddings, community detection, wiki |
