---
title: "Analysis — code-review-graph"
date: 2026-04-10
type: analysis
tool:
  name: "code-review-graph"
  repo: "https://github.com/tirth8205/code-review-graph"
  version: "v2.2.2"
  language: "Python"
  license: "MIT"
source: "references/tirth8205-code-review-graph.md"
---

# ANALYSIS: code-review-graph

---

## Summary

code-review-graph is a Python MCP server that indexes a codebase via Tree-sitter into a local SQLite knowledge graph and exposes 22 MCP tools plus 5 prompt templates for code review, blast-radius analysis, community detection (Leiden), wiki generation, and multi-repo search. The 8.2× average token reduction claim (range 0.7×–16.4×) is self-reported from an internal eval runner (`evaluate/`) and has not been independently reproduced. The feature surface — particularly blast-radius analysis, community detection, cross-repo registry, and D3.js visualisation — is the broadest of any Python MCP tool in this survey, but several capabilities (embeddings, community detection, wiki) require optional dependencies that are disabled by default.

---

## What it does (from reference documentation)

### Indexing pipeline

Repository parsed by Tree-sitter into SQLite nodes and edges stored under `.code-review-graph/`. Blast-radius, dependency chains, and test-coverage gaps are pre-computed at index time. Optional vector embeddings (sentence-transformers, Google Gemini, or MiniMax) stored alongside for hybrid FTS5+vector search. Community detection via the Leiden algorithm groups related code into clusters. Execution flow analysis traces call chains ranked by criticality.

Supported languages: 19 languages plus Jupyter and Databricks notebooks. Incremental updates reported as under 2 seconds (as reported, README — not verified).

### 22 MCP tools

Tool surface includes: `get_impact_radius_tool`, `get_review_context_tool`, `query_graph_tool`, `semantic_search_nodes_tool`, `detect_changes_tool`, `refactor_tool`, `generate_wiki_tool`, `cross_repo_search_tool`, and 14 additional tools. This is the largest MCP tool surface of any tool in this survey (vs 14 for `deusdata-codebase-memory-mcp`, 1 for `colbymchenry/codegraph`).

### 5 prompt templates

`review_changes`, `architecture_map`, `debug_issue`, `onboard_developer`, `pre_merge_check`.

### Slash commands

`/code-review-graph:build-graph`, `/code-review-graph:review-delta`, `/code-review-graph:review-pr`.

### Multi-platform install

`code-review-graph install` auto-configures Claude Code, Cursor, Windsurf, Zed, Continue, OpenCode, and Antigravity — 8 platforms, the broadest auto-configuration story in this category.

---

## Benchmark claims — as-reported vs verified

### Token efficiency (8.2× average claim)

**Claim**: 8.2× average token reduction across 6 repositories (naive vs graph); range 0.7×–16.4×.

**Methodology (from reference)**: Internal eval runner at `evaluate/`; comparison is naive file read vs graph query. The low end (0.7× on small single-file changes) and high end (16.4×) are both self-reported from this runner.

**The 49× claim**: "Up to 49× token reduction on daily coding tasks" has no stated methodology or benchmark data in the README. This figure should not be cited without independent verification.

**MRR 0.35**: The tool's own benchmarks report MRR 0.35 for keyword search — a low retrieval quality score that limits the utility of FTS5-only queries.

**Status**: Not independently reproduced. The eval runner (`evaluate/`) has not been executed against the reported figures in this session. The 8.2× average and 0.7×–16.4× range are directionally consistent with the design (graph queries return targeted results vs scanning all files), but the distribution across real-world repos is unknown.

### Indexing speed (as reported, not verified)

Incremental updates reported as under 2 seconds. Full initial index time not stated in available documentation.

---

## Architectural assessment

### What's genuinely novel

1. **Broadest feature surface in Python MCP category.** 22 tools covering blast-radius analysis, community detection (Leiden), cross-repo multi-registry search, interactive D3.js visualisation, and LLM-assisted wiki generation in a single `pip install`. No other Python MCP code intelligence tool in this survey combines all five capability areas.

2. **Community detection via Leiden algorithm.** Grouping related code into semantic clusters is not present in `deusdata-codebase-memory-mcp` or `colbymchenry/codegraph`. Useful for onboarding and architectural review, though quality on arbitrary codebases is not benchmarked.

3. **8-platform auto-install.** `code-review-graph install` detects and configures 8 AI coding platforms automatically — the most complete multi-platform install story in this category.

4. **Hybrid search architecture (when embeddings enabled).** FTS5 keyword search combined with optional dense vector embeddings (sentence-transformers, Gemini, MiniMax) enables semantic queries not possible in graph-only tools. The MRR 0.35 for keyword-only mode highlights why the optional semantic layer matters.

5. **Active external community.** 7,624 stars, 897 forks, Discord, dedicated website (code-review-graph.com), external contributors. Development pace is high and AI-assisted (Claude Opus 4 co-authorship visible in commit history).

### Gaps and risks

- **8.2× claim is self-reported and unverified.** The eval runner (`evaluate/`) exists but reported figures have not been reproduced. The 49× figure has no methodology and should be treated as marketing until confirmed.
- **MRR 0.35 is low.** FTS5 keyword search alone returns poor recall. Effective use of the tool likely requires enabling optional semantic embeddings — which are disabled by default and require either local model installation or an external API key.
- **Optional dependencies gate key features.** Community detection (igraph), semantic search (sentence-transformers/Gemini/MiniMax), and wiki generation (ollama/Gemini) are all opt-in. The default install is a structural graph only; the advertised feature set requires additional setup.
- **Community detection quality unquantified.** Leiden clustering on arbitrary codebases may produce noisy, unhelpful clusters. No benchmark for cluster quality is provided.
- **Python runtime adds deployment friction vs single-binary alternatives.** `pip install` with optional deps and potential Python version conflicts contrast with the zero-dep binary model of `deusdata-codebase-memory-mcp`.
- **AI-assisted commit pace introduces review risk.** High-velocity AI-assisted development (Claude Opus 4 co-authorship) at 7,624 stars means correctness of recent commits should be treated with some caution until the eval harness is verified.
- **No authentication on visualisation or MCP.** D3.js HTML output and local MCP server have no access controls mentioned in documentation.
- **Relationship to colbymchenry/codegraph**: Independent tools; neither is a fork of the other. codegraph (2026-01-18) predates CRG (2026-02-26) but CRG has eclipsed it in adoption. codegraph's README copies CRG's architecture diagrams and benchmark table without attribution; CRG is the original source.

---

## Recommendation

**Adopt for complex multi-file review and onboarding tasks where token cost is the bottleneck.** The blast-radius and community detection tools offer structural insights that embedding-based RAG cannot replicate. The 22-tool surface provides fine-grained agent control over what context is retrieved.

**Enable optional embeddings before relying on search.** MRR 0.35 for keyword search means default-install search quality is poor. Budget for sentence-transformers (local) or a Gemini API key to unlock hybrid search.

**Do not cite the 49× figure.** It has no stated methodology. Use the 8.2× average (0.7×–16.4× range) with the caveat that it is self-reported and unverified.

**Treat community detection results as exploratory.** Leiden clustering on arbitrary codebases is a starting point for investigation, not authoritative module boundaries.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | code-review-graph |
|---|---|
| Approach | Tree-sitter AST → SQLite knowledge graph; blast-radius + community detection + hybrid search |
| Compression (vs naive) | 8.2× average (self-reported, range 0.7×–16.4×); 49× "daily tasks" claim unverified |
| MCP tool count | 22 tools + 5 prompt templates |
| Token budget model | None — query results bounded by result set size |
| Injection strategy | On-demand MCP tool calls; no session-level injection |
| Eviction | N/A — no context injection pipeline |
| Benchmark harness | `evaluate/` runner (exists, not independently reproduced) |
| Keyword search quality | MRR 0.35 (stated, low) |
| License | MIT |
| Maturity | v2.2.2; 7,624 stars; 897 forks; created 2026-02-26; active external community |
| Runtime | Python 3.10+; optional deps for embeddings, community detection, wiki |
