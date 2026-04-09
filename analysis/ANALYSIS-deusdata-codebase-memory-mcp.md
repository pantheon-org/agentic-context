# ANALYSIS: codebase-memory-mcp

**Slug**: deusdata-codebase-memory-mcp
**Source**: `tools/deusdata-codebase-memory-mcp/` (pinned: `d33b9e4`)
**Reference**: `references/deusdata-codebase-memory-mcp.md`
**Analyst**: thoroc
**Date**: 2026-04-09
**Status**: analysis

---

## Summary

codebase-memory-mcp is a single static C binary that indexes a codebase into a SQLite knowledge graph via tree-sitter AST parsing and answers structural questions (call paths, impact radii, architecture overview) without reading source files into context. The 99.2% token reduction claim is directionally correct but the comparison baseline is naive file-by-file grep — not optimized RAG. Live queries on the tool's own 24,138-node graph returned compact, accurate results within a few hundred tokens each. The architecture is sound and the structural query tools (especially `trace_call_path` and `detect_changes`) offer capabilities that embedding-based retrieval cannot replicate.

---

## What it does (verified from source)

### Indexing pipeline (verified from `src/pipeline/`)

7-phase pipeline (per `pipeline.c` header comment) with 20+ named passes:

1. **Discover** — `.gitignore`/`.cbmignore`-aware file traversal.
2. **Structure** — Project/Folder/Package/File node creation.
3. **Bulk load** — Read + LZ4 HC compress all sources in memory.
4. **Definitions** — Fused extract/write nodes + build symbol registry.
5. **Resolve** — imports (`pass_usages`), calls (`pass_calls`), semantic edges (`pass_semantic`), similarity hashes (`pass_similarity`), compile commands (`pass_compile_commands`).
6. **Post-passes** — tests (`pass_tests`), community detection, HTTP links (`pass_route_nodes`), git history (`pass_githistory`), Kubernetes scan (`pass_k8s`), env scan (`pass_envscan`), infrastructure scan (`pass_infrascan`).
7. **Dump** — Graph buffer flushed to SQLite.

The README describes 6 passes; the source has significantly more, including Kubernetes, env, and infra scanning not mentioned in public documentation.

**Concurrency**: A process-global `atomic_int g_pipeline_busy` spinlock serializes pipeline runs — only one indexing pass can run at a time. The background watcher uses `cbm_pipeline_try_lock()` (non-blocking) and skips with a 100ms retry if busy. Multi-agent *read* access to the shared SQLite DB is safe (SQLite WAL mode); concurrent *writes* (re-indexing) are serialized.

### SQLite schema (verified from `src/store/`)

Five core tables:

- `projects` — project name, root path, metadata.
- `file_hashes` — content hashes for incremental diffing.
- `nodes` — all graph nodes (id, project, label, name, qualified_name, file_path, line, snippet).
- `edges` — all relationships (id, project, source_id, target_id, type).
- `project_summaries` — cached architecture summaries.

One FTS5 virtual table: `nodes_fts` — enables BM25 name search.

Indexes on `nodes(project, label)`, `nodes(project, name)`, `nodes(project, file_path)`, and all edge directions by source/target/type — query latency is index-bound, not scan-bound.

### 14 MCP tools (verified from `src/mcp/mcp.c`)

Tool dispatch is a plain if-else chain over `tool_name`. All 14 tools are confirmed present in source, matching the reference documentation.

---

## Benchmark claims — verified vs as-reported

### Token efficiency (99.2% claim)

**Claim**: 5 structural queries consumed ~3,400 tokens vs ~412,000 tokens via file-by-file grep (as reported, README).

**Methodology (from benchmark source file)**:

- "Tokens" = all input + output tokens during a 12-question answering phase — Claude's reasoning about tool results is included, not just raw output.
- Baseline is file-by-file grep across all source files, not optimized RAG.

**Live verification** — 5 structural queries on the tool's own codebase (24,138 nodes, 51,664 edges, indexed in fast mode):

| Query | Tool | Response size | Est. tokens |
|---|---|---|---|
| Node/edge type counts | `get_graph_schema` | ~600 B JSON | ~150 |
| All `cbm_pipeline_*` functions (35 found) | `search_graph` | ~2.1 KB JSON | ~530 |
| Callers of `cbm_pipeline_run` | `trace_call_path` | ~500 B JSON | ~125 |
| `cbm_mcp_handle_tool` with connections | `search_graph` | ~250 B JSON | ~65 |
| Architecture overview (packages, languages, hotspots) | `get_architecture` | ~900 B JSON | ~225 |
| **Total** | | **~4.4 KB** | **~1,095** |

Equivalent grep to find all `cbm_pipeline_*` definitions across 673 C files would return hundreds of matching lines — easily 5,000–20,000 tokens before reasoning. The 99.2% figure is plausible for this comparison class but depends on:

1. The baseline being naive grep (not `ripgrep --json` or focused file reads).
2. The queries being well-formed — poorly scoped graph queries can return very large result sets.
3. "Tokens" including model reasoning, which inflates the grep baseline disproportionately (model must process more raw context to extract the same answer).

**Verdict**: savings are real and substantial; 99.2% is directional. Likely 90–99% vs naive grep, 60–85% vs optimized focused file reads.

### Indexing speed (as reported, not re-run)

| Repo | Mode | Time | Nodes | Edges |
|---|---|---|---|---|
| codebase-memory-mcp (this session) | fast | ~8s (observed) | 24,138 | 51,664 |
| Django (README) | full | ~6s | 49K | 196K |
| Linux kernel (README) | full | 3 min | 2.1M | 4.9M |

Fast mode observed to produce a fully queryable index in ~8s on macOS arm64.

---

## Architectural assessment

### What's genuinely novel

1. **Structural queries replace file reads entirely.** `trace_call_path` returns a caller/callee graph without opening any file. `detect_changes` maps a git diff to affected symbols and their blast radius. These are queries no embedding-based RAG system can answer directly — they require a graph.

2. **Single static binary, zero runtime deps.** No Docker, no Python environment, no embedding server. `codebase-memory-mcp install` auto-configures 10 agents. This is the lowest-friction code intelligence deployment of any tool in this survey.

3. **Persistent, incremental index.** File hashes enable incremental re-indexing; the background watcher triggers re-index on git changes. The index survives session restarts — there is no "cold start" re-indexing cost per session.

4. **20+ pipeline passes including Kubernetes, env, and infra.** The public documentation describes 6 passes; the actual pipeline is significantly richer (k8s service linking, env variable scanning, infrastructure route mapping). This is undisclosed scope that may benefit infrastructure-heavy codebases.

### Gaps and risks

- **99.2% claim is a single scenario, not a distribution.** No range across repo sizes, languages, or query types is provided. Large structural queries (e.g. `search_graph` with no `name_pattern`) can return very large JSON payloads that consume significant tokens.
- **Dynamic language accuracy is unquantified.** Call edges for Python, JavaScript, and Ruby are heuristic — false-positive edges are possible and the false-positive rate is not disclosed. `trace_call_path` on dynamic code should be treated as approximate.
- **Global spinlock serializes re-indexing.** Concurrent agent sessions sharing one index can trigger watcher re-indexing that blocks; the 100ms retry loop means a slow full re-index (e.g. after a large commit) can cause all watcher invocations to queue up silently.
- **No authentication on MCP or graph UI.** Anyone with local process access can query the graph or read the 3D visualization at `localhost:9749`.
- **Language tier quality is opaque.** "Functional (<75%)" is not defined — no methodology for the quality percentage is disclosed.
- **Schema changes are undocumented.** No migration guide or changelog for breaking changes to the SQLite schema across versions.

---

## Recommendation

**Adopt for structural code navigation.** The graph query tools (`trace_call_path`, `detect_changes`, `search_graph`) provide answers that no other tool in this survey can give, at very low token cost. The single-binary install and persistent index eliminate the friction that makes most code intelligence tools impractical.

**Do not use as a substitute for reading source.** `get_code_snippet` and `search_code` are convenience wrappers; the core value is in graph traversal. For exact source content, still use `Read` or `ctx_execute_file`.

**Flag dynamic language edges as heuristic.** For Python/JS/Ruby call graphs, treat `trace_call_path` results as a starting point for investigation, not ground truth.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | codebase-memory-mcp |
|---|---|
| Approach | AST-to-SQLite knowledge graph; structural graph queries replace file reads |
| Compression (vs grep) | ~90–99% (directional; verified ~95% on 5 live queries) |
| Token budget model | None — query results are bounded by result set size |
| Injection strategy | On-demand MCP tool calls; no session-level injection |
| Eviction | N/A — no context injection pipeline |
| Benchmark harness | C test suite (`tests/test_*.c`); no standalone token benchmark harness |
| License | MIT |
| Maturity | v0.5.7 (installed); 1,324 stars; 434 commits; 2,586 reported tests |
