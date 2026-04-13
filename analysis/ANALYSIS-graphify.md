---
slug: graphify
title: "Analysis — graphify"
date: 2026-04-13
type: analysis
tool:
  name: "graphify"
  repo: "https://github.com/safishamsi/graphify"
  version: "v0.4.10 (962f28c)"
  language: "Python"
  license: "MIT"
source: ["references/safishamsi-graphify.md", "tools/graphify/"]
local_clone: null
reviewed: true
reviewed_date: 2026-04-13
source_reviewed: true
updated: null
---

# ANALYSIS: graphify

---

## Summary

Graphify is a multi-modal knowledge graph builder for AI coding assistants. The core mechanism is a long markdown skill file (`skill.md`) that Claude reads and executes step-by-step — the LLM orchestrates the pipeline by issuing Python subprocess calls against a set of utility modules (`build.py`, `cluster.py`, `analyze.py`, etc.). This is a prompt-orchestrated architecture, not a conventional server. The Python code is real and well-structured, but the LLM is the runtime, not a caller of it.

The headline **71.5× token reduction** is measured on a single curated 52-file corpus (3 GPT repos + 5 papers + 4 diagrams). There is no standalone benchmark harness — the figure is computed inline during `/graphify` runs when `total_words > 5000`, comparing average graph-query cost against "read all raw files." The baseline is an extreme lower bound. Claims are plausible for mixed-corpus use but are not comparable to peer-reviewed benchmarks.

Genuinely differentiating features: multi-modal ingestion (code + PDF + image + video), persistent `graph.json` across sessions, Leiden community detection with stable IDs, auto-rebuild git hooks, and 7-tool MCP server mode. The architecture is well-layered and the security module is unusually thorough for a solo project.

---

## What it does (verified from source)

### Architecture: prompt-orchestrated pipeline

The entry point is **`graphify/skill.md`** — a 9-step instruction document loaded as a Claude Code slash command. When `/graphify <folder>` is invoked, Claude reads the skill and executes each step by shelling out to Python. The Python modules are called via `python -c "..."` one-liners referencing the installed package; they are utilities, not the orchestrator.

This means:

- Pipeline quality depends on Claude following multi-step instructions correctly.
- Each step writes intermediary files to `graphify-out/` (`.graphify_detect.json`, `.graphify_extract.json`, `.graphify_analysis.json`) that act as the stage handoff.
- The Python CLI entry point handles only `graphify install` — it does not run the pipeline independently.

### Step 2 — Detect (detect.py)

Walks the target folder, classifies files into `code`, `document`, `paper`, and skips binary/ignored patterns. Respects `.graphifyignore` (`.gitignore` syntax). Emits `.graphify_detect.json` with counts, a `needs_graph` flag, and a `total_words` estimate used to gate the benchmark step.

### Step 3A — Structural extraction (extract.py, ~3 057 lines)

Tree-sitter AST extraction for 23 languages. Extracts nodes (classes, functions, imports, call-graph edges, docstrings, rationale comments). **No LLM involved.** Each extractor maintains a `seen_ids` set to deduplicate within-file. Output: structured node/edge dicts keyed by a stable `id`.

### Step 3B — Semantic extraction (parallel Claude subagents)

The skill launches multiple Claude subagents in parallel — one per document/paper/image batch. Each subagent reads the file content and returns a JSON extraction of concept nodes and design-rationale edges. Video/audio is transcribed first via faster-whisper (Step 2.5) using a domain-aware prompt derived from corpus god nodes; transcripts are SHA256-cached so re-runs skip transcription.

Only semantic descriptions are sent to the model, not raw source code. Token budget and character budget limits are applied per file.

### Step 3C — Merge and build (build.py)

`build_from_json()` / `build()` assembles a NetworkX `Graph` (or `DiGraph` with `--directed`). Three-layer node deduplication:

1. **Within-file (AST)**: `seen_ids` in each extractor — first occurrence wins.
2. **Between-file (build)**: `G.add_node()` is idempotent; semantic nodes are added after AST nodes, so semantic attributes (richer labels, cross-file context) silently overwrite AST attributes. Source location from AST is lost on collision.
3. **Semantic merge (skill)**: deduplication via explicit `seen` set before any graph construction.

Dangling edges to external/stdlib imports are explicitly tolerated — logged but not treated as errors.

### Step 4 — Cluster and analyze (cluster.py, analyze.py)

**Clustering** — `cluster.py`:

- Runs Leiden via `graspologic.partition.leiden` (suppresses ANSI output to avoid PowerShell 5.1 scroll-buffer corruption).
- Falls back to `networkx.community.louvain_communities` with `seed=42, threshold=1e-4` and `max_level=10` if available.
- Oversized communities (>25% of graph, minimum 10 nodes) are split by running a second Leiden pass on the subgraph.
- Community IDs are stable: 0 = largest community after splitting.
- `DiGraph` inputs are converted to undirected internally (Leiden/Louvain require undirected).

**Analysis** — `analyze.py`:

- `god_nodes()`: returns nodes sorted by weighted degree.
- `surprising_connections()`: flags edges crossing community boundaries where source and target communities have low inter-community edge density.
- `suggest_questions()`: LLM-generated questions seeded by god nodes and community labels.
- `graph_diff()`: used by `--update` to show added/removed nodes and edges.

### Step 5–6 — Label, export, visualize

Community labels are generated by a second LLM call over the top nodes in each community. Outputs: `graph.html` (D3.js interactive, rendered via `export.py`), `GRAPH_REPORT.md` (god nodes, surprises, suggested questions), `graph.json` (persistent NetworkX node-link format).

Optional: Obsidian vault export, SVG, GraphML, Neo4j push.

### MCP server (serve.py, 372 lines)

Started with `python3 -m graphify.serve graphify-out/graph.json` (or `--mcp` flag). Stdio MCP protocol. Exposes 7 tools:

| Tool | Description |
|---|---|
| `query_graph` | Keyword/substring search over node labels and attributes |
| `get_node` | Fetch full node attributes by ID |
| `get_neighbors` | Return adjacent nodes (with optional depth) |
| `get_community` | Return all nodes in a community |
| `god_nodes` | Return top-N highest-degree nodes |
| `graph_stats` | Node/edge/community counts |
| `shortest_path` | Shortest path between two nodes |

Loads the graph from `graph.json` at startup; graph is read-only at runtime (no write tools).

### Incremental updates (`--update` flag)

Detects changed files via git diff. If only code files changed: runs Step 3A (AST) only, skipping LLM subagents entirely. If docs/papers/images changed: full 3A–3C pipeline. Merges new extraction into existing graph with node pruning for deleted files.

### Git hooks

`graphify hook install` registers post-commit and post-checkout hooks that auto-rebuild the graph after each commit (AST-only, no LLM, no cost). Activated only if `graphify-out/` exists.

### Security (security.py, 197 lines)

- `_ALLOWED_SCHEMES = {"http", "https"}` — no file:// or data:// URLs.
- Hard caps: 50 MB for binary downloads, 10 MB for text/HTML.
- `_blocked_hosts`: AWS metadata (169.254.169.254, 100.100.100.200), link-local, common cloud metadata endpoints.
- Path containment: output paths are resolved and checked against the target directory.
- Label sanitisation: `html.escape()` on all node labels (mirrors code-review-graph's `_sanitize_name` pattern, as noted in a source comment).

---

## Benchmark claims — verified vs as-reported

### Methodology (from source)

The benchmark runs inline at **Step 8** of the skill, triggered only when `total_words > 5000`. It compares:

- **Baseline**: estimated token cost of reading all raw files naively.
- **Graph**: estimated average token cost per query against `graph.json`.

The 71.5× figure appears in the website example ("Karpathy mixed corpus") but is **not** produced by a standalone harness. There are no fixture corpora or reproducible test scripts in `tools/graphify/tests/`. The `benchmark.py` module exists (154 lines) but is not used by a test runner.

### Self-reported figures

| Corpus | Files | Naive tokens | Graph tokens/query | Reduction |
|---|---|---|---|---|
| Karpathy mixed (3 repos + 5 papers + 4 diagrams) | ~52 | ~123k | ~1.7k | **71.5×** (as reported) |

### Assessment

The 71.5× figure is directionally plausible — graph-query retrieval over pre-built communities does return small, targeted subgraphs. However:

- The baseline ("read all raw files") is the worst possible retrieval strategy.
- No comparison against embedding-based retrieval, BM25 search, or other graph tools.
- A single self-curated example is not a benchmark.
- Real-world reduction depends on query specificity; broad queries will return large subgraphs, shrinking savings.
- LLM extraction cost during build is unquantified and not included in the denominator.

**Reproduction status: not attempted** — no harness to run.

---

## Architectural assessment

### What's genuinely novel

1. **Prompt-orchestrated multi-modal pipeline**: The skill.md approach means the pipeline is transparent and debuggable — every step is readable English + shell commands in Claude's context. Failures surface as Claude explaining what went wrong rather than opaque exceptions. The tradeoff is that pipeline fidelity depends on instruction-following quality.

2. **Multi-modal to single graph**: Combining Tree-sitter AST edges (precise, structural) with LLM semantic edges (cross-file rationale, design intent) into one NetworkX graph is architecturally clean. No other tool in this repo's scope does this. `lum1104-understand-anything` is the closest; it uses 5 agents but produces a dashboard, not a persistent queryable graph.

3. **Persistent `graph.json` across sessions**: Most tools rebuild on each invocation. A pre-built, session-persistent graph means query latency is low after the initial build. The `--update` incremental mode and git hooks extend this with near-zero cost for code-only changes.

4. **Leiden community detection with split logic**: The oversized-community splitting (25% threshold, recursive Leiden subpass) is a practical engineering detail not found in comparable tools. Community IDs are stable across re-runs (0 = largest after splitting), enabling reproducible references.

5. **Security module**: The SSRF-aware URL validator (blocks cloud metadata, link-local, enforces http/https), 50 MB hard cap, and path containment checks are unusually thorough for a solo-maintained Python tool.

### Gaps and risks

- **Prompt-orchestrated = non-deterministic**: Two runs on the same corpus may produce different graphs because the LLM semantic extraction is stochastic. Graph quality is not reproducible without pinned seeds and model versions.
- **AST node overwritten by semantic on ID collision**: When the same entity is extracted by both passes, semantic attributes win silently. Source location precision from the AST pass is lost. Documented in `build.py` comments but not surfaced to the user.
- **Leiden requires Python <3.13**: `graspologic` does not support Python 3.13+. Falls back to Louvain silently. Users on 3.13 get lower-quality clustering with no warning.
- **LLM extraction cost at scale**: Parallel subagents are launched per document/paper/image batch. On a large corpus (hundreds of PDFs), this is unbounded API spend. No cost cap mechanism exists.
- **No benchmark harness**: The 71.5× reduction cannot be reproduced independently. `benchmark.py` exists but has no test runner or fixture corpus.
- **`graph.json` schema unstable**: Rapid version iteration (v0.4.10, ~10 patch releases in a week); no published schema or stability guarantee for `graph.json`. Downstream tools (Neo4j export, MCP server) may break silently.
- **Community label quality**: LLM-generated community labels are not validated. A community spanning unrelated concepts may receive a misleading label.
- **MCP server is read-only**: The 7 MCP tools expose querying only. There is no tool to add nodes, trigger re-extraction, or update the graph via the MCP interface.

---

## Recommendation

**Worth adopting for mixed-corpus research workflows** (code + papers + notes). The persistent graph, incremental update hooks, and multi-modal ingestion address a real gap. The context-mode + qmd combo handles session protection and doc retrieval but does not build a relational graph across modalities.

**Do not adopt** as a primary codebase navigation tool for large production repos — the non-deterministic extraction and Python <3.13 Leiden constraint are blockers, and the token reduction claim is unverified against any realistic baseline.

**Recommended trial scope**: run `/graphify` on the `agentic-context` repo itself (this repo) — mixed code + markdown + papers, well within the tested corpus size. Compare `GRAPH_REPORT.md` god nodes against known key files.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | graphify |
|---|---|
| Approach | Prompt-orchestrated multi-modal knowledge graph (code + docs + PDFs + images + video) |
| Extraction | Tree-sitter AST (deterministic) + LLM subagents (stochastic) |
| Graph | NetworkX; Leiden (graspologic) or Louvain fallback; oversized-community split |
| Persistence | `graph.json` across sessions; `--update` incremental; git post-commit hooks |
| MCP tools | 7 (query, node lookup, neighbors, community, god nodes, stats, path) — read-only |
| Token reduction | 71.5× (as reported, single self-curated corpus; no harness) |
| Benchmark harness | No standalone harness; inline Step 8 estimate only |
| Python version | 3.10+; Leiden requires <3.13 |
| License | MIT |
| Maturity | v0.4.10; actively iterated; API unstable |
