---
slug: jgravelle-jcodemunch-mcp
title: "Analysis — jcodemunch-mcp"
date: 2026-04-13
type: analysis
tool:
  name: "jcodemunch-mcp"
  repo: "https://github.com/jgravelle/jcodemunch-mcp"
  version: "v1.36.0"
  language: "Python"
  license: "Custom (free non-commercial; paid tiers for commercial use)"
source: "references/jgravelle-jcodemunch-mcp.md"
local_clone: "tools/jgravelle-jcodemunch-mcp/"
reviewed: true
reviewed_date: 2026-04-13
source_reviewed: true
updated: null
---

# ANALYSIS: jcodemunch-mcp

---

## Summary

jcodemunch-mcp is a local-first MCP server that indexes a codebase once with tree-sitter AST parsing and serves symbol-level retrieval to AI agents, avoiding whole-file reads. The published benchmark numbers have been updated by the author since the original triage: the current canonical figure is 99.6% aggregate reduction (not 95%) across 15 task-runs on 3 repos, with larger repo snapshots than originally reported (expressjs/express: 165 files, fastapi/fastapi: 951 files, gin-gonic/gin: 98 files). This figure is verified from `benchmarks/results.md` in the vendored source. The benchmark methodology is verified from `benchmarks/harness/run_benchmark.py` and `benchmarks/METHODOLOGY.md`: baseline = all source files concatenated (a lower bound), jcodemunch workflow = `search_symbols` (top 5) + `get_symbol_source` × 3 per query, tokenised with `tiktoken cl100k_base`. All numbers are still author-produced; no independent third-party reproduction exists.

The architecture is sound: tree-sitter extracts deterministic, language-aware symbol metadata including byte offsets; SQLite WAL stores the index; MCP tools serve exact source spans on demand. The tool set has grown substantially beyond basic retrieval into import-graph analysis, dead-code detection, session routing, and complexity metrics — a broad surface that raises maintenance risk but also distinguishes the tool from simple file-reading wrappers.

**Source review note (2026-04-13):** The vendored source is v1.36.0 (up from v1.24.5 at the time of initial analysis). Several implementation details from the original triage and earlier analysis were corrected during source review — see the "Source review" section below.

---

## What it does (verified from source)

### Core mechanism

The retrieval loop has three layers (verified from ARCHITECTURE.md and pyproject.toml):

1. **Parse layer** — `tree-sitter-language-pack>=0.7.0` provides pre-compiled grammars for Python, JavaScript, TypeScript, TSX, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, and others (text-search-only for some). Each file is parsed to an AST; a per-language registry maps node types to symbol kinds (function, class, method, constant, type). Extracted per symbol: kind, name, qualified name, byte-start, byte-end, signature, and docstring (with `docstring -> AI batch -> signature` fallback chain).

2. **Storage layer** — One SQLite database per indexed repository, stored at `~/.code-index/` (configurable via `CODE_INDEX_PATH`). WAL mode allows concurrent reads during writes. Schema tables (verified from `sqlite_store.py`): `meta`, `symbols`, `files`. The original triage listed `imports`, `raw_cache`, and `content_blob` as additional tables — these do not exist in the current schema. Raw source files are cached in a flat content directory alongside the DB; symbol byte offsets point into these cached files, enabling exact retrieval by direct byte-seeking without reparsing.

3. **Retrieval layer** — MCP tool surface (see Interface / API). The token reduction mechanism is simple: instead of returning an entire file, the server returns only the matched symbol source span plus a JSON metadata envelope. `get_ranked_context` assembles multi-symbol bundles within a caller-supplied token budget using Weighted Reciprocal Rank (WRR) fusion across four channels: lexical BM25, structural PageRank, embedding cosine similarity, and identity/exact-match (verified from `src/jcodemunch_mcp/retrieval/signal_fusion.py`). Default channel weights: identity=2.0, lexical=1.0, similarity=0.8, structural=0.4. The earlier description of "BM25 + PageRank" was a simplification — the full fusion pipeline uses all four channels.

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
- Source now vendored at `tools/jgravelle-jcodemunch-mcp/`; the prior caveat about 404s on raw.githubusercontent.com no longer applies.

---

## Benchmark claims — verified vs as-reported

**Important**: The benchmark figures in the original triage (95% aggregate) and the in-source `results.md` (99.6% aggregate) differ substantially. Both sets of numbers are from the same author; the difference reflects either an updated index state or re-running the harness on larger repo snapshots. The figures below are from the vendored `benchmarks/results.md` (verified from source, run 2026-03-28).

| Metric | Value | Status |
|---|---|---|
| expressjs/express: files indexed | 165 | verified from results.md (triage claimed 34 — contradicted) |
| expressjs/express: symbols | 181 | verified from results.md (triage claimed 117 — contradicted) |
| expressjs/express: baseline tokens | 137,978 | verified from results.md (triage claimed 73,838 — contradicted) |
| expressjs/express: avg reduction | 99.4% | verified from results.md (triage claimed 98.4% — superseded) |
| fastapi/fastapi: files indexed | 951 | verified from results.md (triage claimed 156 — contradicted) |
| fastapi/fastapi: symbols | 5,325 | verified from results.md (triage claimed 1,359 — contradicted) |
| fastapi/fastapi: baseline tokens | 699,425 | verified from results.md (triage claimed 214,312 — contradicted) |
| fastapi/fastapi: avg reduction | 99.8% | verified from results.md (triage claimed 92.7% — superseded) |
| gin-gonic/gin: files indexed | 98 | verified from results.md (triage claimed 40 — contradicted) |
| gin-gonic/gin: symbols | 1,489 | verified from results.md (triage claimed 805 — contradicted) |
| gin-gonic/gin: baseline tokens | 187,018 | verified from results.md (triage claimed 84,892 — contradicted) |
| gin-gonic/gin: avg reduction | 99.4% | verified from results.md (triage claimed 98.0% — superseded) |
| Grand total aggregate | 99.6% (5,122,105 -> 19,406 tokens, 15 runs) | verified from results.md (triage claimed 95% / 1,865,210 tokens — contradicted) |
| Per-query range | 99.2% – 99.9% (current results.md) | verified from results.md; triage range 79.7%–99.8% is outdated |
| Tokeniser | tiktoken cl100k\_base | verified from source (METHODOLOGY.md, run\_benchmark.py) |
| Benchmark harness exists and is public | `benchmarks/harness/run_benchmark.py` + `benchmarks/tasks.json` | verified from source |
| Baseline definition | lower bound (single-pass full concatenation) | verified from METHODOLOGY.md |
| Query corpus size | 5 queries x 3 repos = 15 task-runs | verified from tasks.json |
| Real-world A/B test result | 20% token savings (Wilcoxon p=0.0074) on a Vue3+Firebase codebase, 50-iteration test by @Mharbulous | verified from results.md; independent contributor, not author |
| Independent third-party reproduction of headline figure | none found | unverified |
| Retrieval quality / precision measurement | not in harness; tracked separately in jMunchWorkbench | verified from METHODOLOGY.md |

The benchmark methodology is honest about its own limits: the baseline is a lower bound, the query corpus is small (5 queries), and retrieval quality is not measured. The current 99.6% figure comes from larger repo snapshots than the original triage. The real-world A/B test (20% savings, p=0.0074) is a more meaningful production signal — it reflects end-to-end cost on a real codebase including all fixed overhead, not just symbol retrieval.

---

## Architectural assessment

### What's genuinely novel

- **Byte-offset symbol retrieval**: storing start/end byte offsets at index time and using direct byte-seeking at retrieval time eliminates reparsing. The exact-span guarantee matters for agents that must not hallucinate code.
- **Token-budgeted context assembly** (`get_ranked_context`): BM25 + PageRank scoring within a caller-supplied token budget is a principled approach to context window management that goes beyond naive top-k retrieval.
- **Session-aware routing** (`plan_turn`, turn budgets, negative evidence): framing context assembly as a per-turn budget problem with negative-evidence avoidance is a more sophisticated abstraction than most retrieval tools expose.
- **AST-derived call graph and import graph**: `find_importers`, `get_blast_radius`, `get_dependency_graph`, and class hierarchy traversal from tree-sitter parse results without requiring an LSP process is a meaningful differentiator for codebases that cannot run a language server.
- **watch-claude mode**: automatic Claude Code worktree discovery and incremental hot-reindexing provides practical integration that raw file-reading tools lack.

### Gaps and risks

- **Self-reported benchmarks only**: the harness is public, but all canonical numbers come from the author. The three benchmark repos are small-to-medium (98–951 files), and the 99.6% headline figure comes from the author's own index state. The real-world A/B test by @Mharbulous (20% savings, p=0.0074) is a better signal, but still a single codebase. Large monorepos where task queries require broad cross-file context are not represented.
- **Benchmark measures tokens, not quality**: a tool that returns 100% fewer tokens but misses the relevant symbol produces worse outcomes than the baseline. Retrieval precision is tracked in a separate tool (jMunchWorkbench) and not reported alongside token savings.
- **Broad capability surface**: the tool set has grown to 40+ tools including complexity metrics, dead-code detection, hotspot analysis, and architectural enforcement hooks. Each additional tool adds schema tokens per turn (mitigated by `disabled_tools` config) and maintenance surface.
- **Commercial license terms** (verified from `LICENSE` in source): the `LICENSE` file is present and defines three commercial tiers: Builder $79 (1 developer), Studio $349 (up to 5 developers), Platform $1,999 (org-wide). The triage figure of $2,249 is incorrect. The PyPI `license` metadata field may still be `None` — the license text is in the repo file, not the package metadata.
- **Anonymous telemetry** (verified from `src/jcodemunch_mcp/storage/token_tracker.py`): the tool sends an anonymous `{delta, anon_id}` payload to `https://j.gravelle.us/APIs/savings/post.php` on each session flush (every 3 tool calls by default). Only byte-approximated token-savings counts and a UUID are sent — no code or paths. Opt-out via `JCODEMUNCH_SHARE_SAVINGS=0`. This was not noted in the original triage or analysis.
- **Private-codebase data exposure**: optional AI summarisation backends (Anthropic, Gemini, OpenAI, MiniMax, ZhipuAI, OpenRouter) send symbol text to external APIs. This is documented but easy to activate inadvertently. The auto-detect order checks for API keys in the environment at startup (verified from `src/jcodemunch_mcp/summarizer/batch_summarize.py`).
- **Grammar version drift**: the `tree-sitter-language-pack>=0.7.0,<1.0.0` range permits minor-version bumps that may change AST node types and silently break symbol extraction.

---

## Recommendation

Adopt with caveats for retrieval-heavy workflows on medium-sized codebases. The architecture is sound, the benchmark methodology is transparent, and the harness is reproducible. Token savings of 99%+ on structured web-framework codebases are credible for symbol-targeted queries. The 99.6% headline figure reflects larger repo snapshots than originally reported and should be read against the real-world A/B test (20% end-to-end savings, p=0.0074), which is a more representative production figure.

Do not deploy on private commercial codebases without a paid license, explicit opt-out of AI summarisation backends, and opt-out of anonymous telemetry (`JCODEMUNCH_SHARE_SAVINGS=0`). The non-commercial restriction, optional external-API summarisation, and default-on telemetry are three distinct compliance risks.

Independent benchmark reproduction is the outstanding gap. The harness is runnable; reproducing against the same three repos with an independent install would confirm whether the 99.6% figure holds on a clean environment distinct from the author's own index state.

---

## Source review (2026-04-13)

Source at `tools/jgravelle-jcodemunch-mcp/` is v1.36.0 (pyproject.toml). Key findings from primary source inspection:

### Architecture — critical path

1. **Entry point**: `src/jcodemunch_mcp/server.py` (201 KB) — async MCP dispatcher, CLI subcommand routing, auth/rate-limit middleware.
2. **Parse**: `src/jcodemunch_mcp/parser/extractor.py` (285 KB) — imports `tree_sitter_language_pack.get_parser`, dispatches to per-language `LanguageSpec` (defined in `languages.py`). Each spec maps AST node types to symbol kinds and defines docstring extraction strategy (python: `next_sibling_string`; JS/TS: `first_child_comment`; Go/Rust/Java: `preceding_comment`). Custom regex extractors for Erlang, Fortran, SQL/dbt, and Razor bypass tree-sitter for those languages.
3. **Storage**: `src/jcodemunch_mcp/storage/sqlite_store.py` — `PRAGMA journal_mode = WAL` applied once at DB creation; ongoing connections use `PRAGMA synchronous = NORMAL`, `PRAGMA wal_autocheckpoint = 1000`, 256 MB mmap. Schema: **3 tables** (`meta`, `symbols`, `files`) plus indexes — not 6 tables as stated in the original triage. The `raw_cache` and `content_blob` tables from the triage do not exist in the current schema. File content for byte-offset retrieval is stored in a flat content directory alongside the DB, referenced via paths in `CodeIndex.source_files`.
4. **Index version**: `INDEX_VERSION = 8` (verified from `index_store.py`). Migrations v4→v8 are implemented in `sqlite_store.py`.
5. **Symbol lookup**: O(1) via `CodeIndex._symbol_index` dict built in the `post_init` constructor method (verified from `index_store.py`).
6. **Retrieval ranking**: `signal_fusion.py` — Weighted Reciprocal Rank (WRR) across 4 channels. The description "BM25 + PageRank" in earlier analysis was a simplification. WRR formula: `score(s) = sum(weight[c] / (k + rank(c, s)))` with default smoothing k=60.
7. **Summarization**: `summarizer/batch_summarize.py` — 3-tier: docstring extraction → AI provider (Anthropic/Gemini/OpenAI/MiniMax/ZhipuAI/OpenRouter) → signature fallback. Auto-detect order checks env vars at startup.
8. **Telemetry**: `storage/token_tracker.py` — anonymous `{delta, anon_id}` batches posted to `https://j.gravelle.us/APIs/savings/post.php` via a background daemon thread. Default-on; disable with `JCODEMUNCH_SHARE_SAVINGS=0`.

### Key data structures

- `CodeIndex` (`index_store.py`): dataclass with `symbols: list[dict]`, `source_files: list[str]`, `file_hashes`, `imports`, `file_mtimes`. Post-init builds `_symbol_index: dict[str, dict]` for O(1) lookup and `_bm25_cache` (lazy).
- `Symbol` (`parser/symbols.py`): id, name, kind, file, byte_offset, byte_length, signature, docstring, qualified_name, language, decorators, keywords, cyclomatic, max_nesting, param_count.
- `ChannelResult` / `FusedResult` (`retrieval/signal_fusion.py`): per-channel ranked list merged by WRR.

### Claims corrected by source

| Claim (original triage / prior analysis) | Source finding | Status |
|---|---|---|
| SQLite schema has 6 tables: meta, symbols, files, imports, raw_cache, content_blob | Schema SQL defines 3 tables: meta, symbols, files. No raw_cache or content_blob table. | contradicted |
| Retrieval uses BM25 + PageRank | Retrieval uses WRR fusion: lexical BM25 + structural PageRank + embedding similarity + identity (4 channels) | partially contradicted (BM25+PageRank are present but are 2 of 4 channels) |
| Commercial tiers: $79–$2,249 | LICENSE file: $79 (Builder), $349 (Studio), $1,999 (Platform) | corrected — $2,249 figure is wrong |
| No mention of telemetry | Anonymous savings telemetry is enabled by default; opt-out via JCODEMUNCH_SHARE_SAVINGS=0 | new finding |
| Benchmark: express=34 files/117 symbols, fastapi=156/1,359, gin=40/805 | results.md: express=165/181, fastapi=951/5,325, gin=98/1,489 | contradicted — repo snapshots are substantially larger |
| Benchmark aggregate: 95% (1,865,210 → 92,515 tokens) | results.md: 99.6% (5,122,105 → 19,406 tokens) | contradicted — superseded by larger repo run |

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
| License | Free non-commercial; paid tiers $79/$349/$1,999 for commercial use (verified from LICENSE) |
| Maturity | v1.36.0 (vendored source); active development |
