---
title: "Analysis — jcodemunch-mcp"
date: 2026-04-10
type: analysis
tool:
  name: "jcodemunch-mcp"
  repo: "https://github.com/jgravelle/jcodemunch-mcp"
  version: "v1.24.5"
  language: "Python"
  license: "Custom (free non-commercial; paid tiers for commercial use)"
source: "references/jgravelle-jcodemunch-mcp.md"
---

# ANALYSIS: jcodemunch-mcp

---

## Summary

jcodemunch-mcp is a local-first MCP server that indexes a codebase once with tree-sitter AST parsing and serves symbol-level retrieval to AI agents, avoiding whole-file reads. The headline 95% token reduction is plausible given the verified benchmark methodology: baseline = all source files concatenated (a lower bound), jcodemunch workflow = `search_symbols` (top 5) + `get_symbol_source` × 3 per query, tokenised with `tiktoken cl100k_base`. The benchmark harness is public and reproducible (`python benchmarks/harness/run_benchmark.py`), but all published numbers were produced by the author against small-to-medium web-framework repos. No independent third-party reproduction exists. The 95% figure is an aggregate across 15 task-runs on 3 repos (as reported). Per-query range is 79.7%–99.8%.

The architecture is sound: tree-sitter extracts deterministic, language-aware symbol metadata including byte offsets; SQLite WAL stores the index; MCP tools serve exact source spans on demand. The tool set has grown substantially beyond basic retrieval into import-graph analysis, dead-code detection, session routing, and complexity metrics — a broad surface that raises maintenance risk but also distinguishes the tool from simple file-reading wrappers.

---

## What it does (verified from source)

### Core mechanism

The retrieval loop has three layers (verified from ARCHITECTURE.md and pyproject.toml):

1. **Parse layer** — `tree-sitter-language-pack>=0.7.0` provides pre-compiled grammars for Python, JavaScript, TypeScript, TSX, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, and others (text-search-only for some). Each file is parsed to an AST; a per-language registry maps node types to symbol kinds (function, class, method, constant, type). Extracted per symbol: kind, name, qualified name, byte-start, byte-end, signature, and docstring (with `docstring -> AI batch -> signature` fallback chain).

2. **Storage layer** — One SQLite database per indexed repository, stored at `~/.code-index/` (configurable via `CODE_INDEX_PATH`). WAL mode allows concurrent reads during writes. Schema tables: `meta`, `symbols`, `files`, `imports`, `raw_cache`, `content_blob`. Raw source files are cached alongside the DB. Symbol byte offsets point into these cached files, enabling exact retrieval by direct byte-seeking without reparsing.

3. **Retrieval layer** — MCP tool surface (see Interface / API). The token reduction mechanism is simple: instead of returning an entire file, the server returns only the matched symbol source span plus a JSON metadata envelope. `get_ranked_context` assembles multi-symbol bundles within a caller-supplied token budget using BM25 ranking and PageRank-derived centrality scores.

The benchmark methodology (verified from `benchmarks/METHODOLOGY.md` and `benchmarks/harness/run_benchmark.py`) defines:

- **Baseline**: all indexed source files concatenated, tokenised with `tiktoken cl100k_base` — explicitly a lower bound; real agents that re-read files produce higher actual baselines.
- **jcodemunch workflow**: `search_symbols` (top 5 results) + `get_symbol_source` x 3 hits. Token count = serialised JSON response tokens, which includes field-name overhead and slightly understates the reduction relative to raw-source comparisons.
- **Reduction formula**: `(1 - jmunch_tokens / baseline_tokens) * 100`.

### Interface / API

MCP tool groups (verified from ARCHITECTURE.md):

| Group | Key tools |
|---|---|
| Indexing / repo management | `index_repo`, `index_folder`, `index_file`, `list_repos`, `resolve_repo`, `invalidate_cache` |
| Discovery / outlines | `get_repo_outline`, `get_file_tree`, `get_file_outline`, `suggest_queries` |
| Retrieval | `get_file_content`, `get_symbol_source`, `get_context_bundle`, `get_ranked_context` |
| Search | `search_symbols`, `search_text`, `search_columns` |
| Relationship / impact | `find_importers`, `find_references`, `get_dependency_graph`, `check_references`, `get_related_symbols`, `get_class_hierarchy`, `get_blast_radius`, `get_symbol_diff` |
| Session / routing | `plan_turn`, `get_symbol_importance`, `find_dead_code`, `get_untested_symbols`, `get_changed_symbols` |

CLI mirrors the MCP surface: `list`, `index`, `outline`, `search`, `get`, `text`, `file`, `invalidate`, `watch`, `watch-claude`.

### Dependencies

Core (verified from `pyproject.toml`):

- Python >= 3.10
- `mcp>=1.10.0,<2.0.0`
- `tree-sitter-language-pack>=0.7.0,<1.0.0`
- `httpx>=0.27.0`
- `pathspec>=0.12.0`, `pyyaml>=6.0`

Optional extras: `anthropic`, `gemini`, `openai` (AI-assisted summarisation); `watchfiles` (watch mode); `uvicorn`/`starlette` (HTTP/SSE transport); `sentence-transformers` (semantic/hybrid search).

### Scope / limitations

- Macro-generated or dynamically defined symbols are invisible to the parser.
- Anonymous arrow functions without assigned names are not indexed in JavaScript.
- Deep inner-class nesting may be flattened in Java.
- AI-assisted summarisation backends (Anthropic, Gemini, OpenAI) send code to external APIs — relevant for private-codebase deployments.
- No versioned grammar lockfile beyond the semver range in `pyproject.toml`; tree-sitter-language-pack updates can silently alter extraction behaviour.
- `indexer.py` and `mcp_server.py` returned 404 from raw.githubusercontent.com during this analysis; internal implementation details (SQL schema, BM25 coefficients) are taken from ARCHITECTURE.md rather than primary source inspection.

---

## Benchmark claims — verified vs as-reported

| Metric | Value | Status |
|---|---|---|
| expressjs/express reduction | 98.4% (73,838 -> ~1,300 tokens avg) | as reported; harness is public and runnable |
| fastapi/fastapi reduction | 92.7% (214,312 -> ~15,600 tokens avg) | as reported; harness is public and runnable |
| gin-gonic/gin reduction | 98.0% (84,892 -> ~1,730 tokens avg) | as reported; harness is public and runnable |
| Grand total aggregate | 95.0% (1,865,210 -> 92,515 tokens, 15 runs) | as reported |
| Per-query range | 79.7% – 99.8% | as reported |
| Tokeniser | tiktoken cl100k\_base | verified from source (METHODOLOGY.md, run\_benchmark.py) |
| Benchmark harness exists and is public | `benchmarks/harness/run_benchmark.py` + `benchmarks/tasks.json` | verified from source |
| Baseline definition | lower bound (single-pass full concatenation) | verified from METHODOLOGY.md |
| Query corpus size | 5 queries x 3 repos = 15 task-runs | verified from tasks.json |
| Independent third-party reproduction | none found | unverified |
| Retrieval quality / precision measurement | not in harness; tracked separately in jMunchWorkbench | verified from METHODOLOGY.md |

The benchmark methodology is honest about its own limits: the baseline is a lower bound, the query corpus is small (5 queries), and retrieval quality is not measured. The 95% figure is internally consistent but depends on small-to-medium public web-framework repos, a workflow that fetches only 3 of the top 5 search hits, and JSON-response token counts rather than raw-source comparisons.

---

## Architectural assessment

### What's genuinely novel

- **Byte-offset symbol retrieval**: storing start/end byte offsets at index time and using direct byte-seeking at retrieval time eliminates reparsing. The exact-span guarantee matters for agents that must not hallucinate code.
- **Token-budgeted context assembly** (`get_ranked_context`): BM25 + PageRank scoring within a caller-supplied token budget is a principled approach to context window management that goes beyond naive top-k retrieval.
- **Session-aware routing** (`plan_turn`, turn budgets, negative evidence): framing context assembly as a per-turn budget problem with negative-evidence avoidance is a more sophisticated abstraction than most retrieval tools expose.
- **AST-derived call graph and import graph**: `find_importers`, `get_blast_radius`, `get_dependency_graph`, and class hierarchy traversal from tree-sitter parse results without requiring an LSP process is a meaningful differentiator for codebases that cannot run a language server.
- **watch-claude mode**: automatic Claude Code worktree discovery and incremental hot-reindexing provides practical integration that raw file-reading tools lack.

### Gaps and risks

- **Self-reported benchmarks only**: the harness is public, but all canonical numbers come from the author. The three benchmark repos are small (34–156 files), making the published figures optimistic for large monorepos where task queries often require broad cross-file context.
- **Benchmark measures tokens, not quality**: a tool that returns 100% fewer tokens but misses the relevant symbol produces worse outcomes than the baseline. Retrieval precision is tracked in a separate tool (jMunchWorkbench) and not reported alongside token savings.
- **Broad capability surface**: the tool set has grown to 40+ tools including complexity metrics, dead-code detection, hotspot analysis, and architectural enforcement hooks. Each additional tool adds schema tokens per turn (mitigated by `disabled_tools` config) and maintenance surface.
- **Commercial license ambiguity**: the PyPI `license` metadata field is `None` (as reported, triage); license terms are enforced only by self-reporting. The distinction between personal and commercial use is not defined in an OSI-approved license.
- **Private-codebase data exposure**: optional AI summarisation backends send symbol text to Anthropic, Gemini, or OpenAI APIs. This is documented but easy to activate inadvertently.
- **Grammar version drift**: the `tree-sitter-language-pack>=0.7.0,<1.0.0` range permits minor-version bumps that may change AST node types and silently break symbol extraction.

---

## Recommendation

Adopt with caveats for retrieval-heavy workflows on medium-sized codebases. The architecture is sound, the benchmark methodology is transparent, and the harness is reproducible. Token savings of 80–99% on clean, well-structured web-framework codebases are credible. The 95% aggregate should be treated as an upper-bound estimate for well-matched workloads rather than a general production figure.

Do not deploy on private commercial codebases without a paid license and explicit opt-out of AI summarisation backends. The non-commercial restriction and optional external-API summarisation are non-trivial compliance risks.

Independent benchmark reproduction is the outstanding gap. The harness is runnable; reproducing against the same three repos with an independent install would confirm or qualify the published numbers before relying on the 95% figure in any external comparison.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | jcodemunch-mcp |
|---|---|
| Approach | Tree-sitter AST parse -> SQLite symbol index -> byte-offset retrieval |
| Compression | Symbol-span extraction (only matched code spans returned) |
| Token budget model | Explicit per-call budget in `get_ranked_context`; per-turn budget via `plan_turn` |
| Injection strategy | MCP tool responses replace whole-file reads; agent controls what to fetch |
| Eviction | No eviction; index is persistent; incremental reindex on file change |
| Benchmark harness | Public (`benchmarks/harness/run_benchmark.py`); tiktoken cl100k\_base; 5 queries x 3 repos |
| License | Free non-commercial; paid tiers $79–$2,249 for commercial use |
| Maturity | v1.24.5; 1.5k stars; 658 commits; active development |
