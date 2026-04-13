---
title: "Graphify"
author: "safishamsi"
date: 2026-04-13
type: reference
tags: [tool, knowledge-graph, codebase-intelligence, mcp-server, multi-modal]
source: "https://github.com/safishamsi/graphify"
version: "0.4.10 (PyPI, 2026-04-05)"
context: "Relevant — multi-modal knowledge graph builder for AI coding assistants; claims 71.5× token reduction via graph-based retrieval over mixed code/doc/paper corpora."
---

## TL;DR

- Python CLI skill (`/graphify`) for Claude Code, Codex, OpenCode, Cursor, and others; installs via `pip install graphifyy`.
- Three-pass pipeline: deterministic Tree-sitter AST extraction → local audio/video transcription (faster-whisper) → parallel LLM subagents for docs, PDFs, images.
- Merges all extracted nodes/edges into a NetworkX graph; applies Leiden community detection for semantic clustering.
- Outputs `graph.html` (interactive), `graph.json` (persistent, queryable across sessions), and `GRAPH_REPORT.md` (god nodes, surprises, suggested questions).
- Reports 71.5× fewer tokens per query vs. reading raw files on a mixed 52-file Karpathy-style corpus (as reported).
- MCP server mode available via `pip install graphifyy[mcp]` (`serve.py`).
- SHA256 incremental cache: re-runs only process changed files.

## What's novel / different

Most codebase-intelligence tools handle source code only and produce vector embeddings or AST snapshots. Graphify is explicitly multi-modal: it ingests code, Markdown, PDFs, images, diagrams, and video/audio in a single pipeline and connects them into one graph. The Leiden clustering step surfaces cross-modal "god nodes" — high-degree concepts that span architectural decisions in code and reasoning in prose. Persistence via `graph.json` means the graph survives session resets, unlike tools that rebuild on each query. The design rationale ("why") rather than just structure ("what") is a stated first-class goal.

## Architecture overview

### Core design

Three isolated passes run sequentially:

1. **AST pass** — Tree-sitter extracts classes, functions, imports, call graphs, docstrings from 23 languages. No LLM.
2. **Media pass** — faster-whisper transcribes video/audio locally using a domain-aware prompt derived from corpus god nodes. Cached after first run.
3. **Semantic pass** — Claude subagents run in parallel over docs, PDFs, images, and transcripts to extract concept nodes and design-rationale edges.

The three pass outputs are merged into a NetworkX graph. Leiden algorithm (graspologic, Python <3.13 only) assigns community IDs. Analysis identifies god nodes (highest degree) and surprising cross-community edges.

### Interface / API

- **CLI**: `/graphify <folder>` within an AI coding assistant; also `graphify <folder>` from terminal.
- **MCP server**: `serve.py` exposes MCP protocol; installed via `[mcp]` extra.
- **Query commands**: `/graphify query <text>`, `/graphify path <nodeA> <nodeB>`, `/graphify explain <node>`.
- **Outputs**: `graphify-out/graph.html`, `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/cache/`.
- **Ignore file**: `.graphifyignore` (`.gitignore` syntax) to exclude paths.
- **Neo4j export**: optional via `[neo4j]` extra.

### Dependencies

Core: `networkx`, `tree-sitter>=0.23.0` + 23 language grammars.
Optional extras: `mcp`, `neo4j`, `pypdf`+`html2text`, `watchdog`, `matplotlib`, `graspologic` (Leiden; Python <3.13), `python-docx`+`openpyxl`, `faster-whisper`+`yt-dlp`.
LLM: uses the assistant's configured API key; no bundled model.

### Scope / limitations

- Leiden clustering (`graspologic`) is Python <3.13 only; users on 3.13+ cannot use community detection without the extra.
- Token reduction claim is on a single curated 52-file corpus; no independent benchmark.
- Parallel LLM subagent step sends semantic descriptions (not raw source) to upstream model — cost scales with corpus size and is unquantified.
- No information on graph quality degradation on very large repos (100k+ files).
- `graph.json` format undocumented; no stated stability guarantee.

## Deployment model

- **Runtime**: Python 3.10+; local process.
- **Language**: Python.
- **Storage**: local filesystem (`graphify-out/`); optional Neo4j for graph persistence.
- **LLM dependency**: requires an external model API key (Claude, Codex, etc.); LLM calls made during semantic extraction pass only.
- **Network**: outbound only for LLM API calls and optional URL ingestion; no telemetry.
- **License**: MIT.

## Self-reported metrics

- **71.5× token reduction** — Karpathy mixed corpus: 3 GPT framework repos + 5 attention papers + 4 diagrams (~52 files, ~92k words); average query cost ~1.7k tokens vs ~123k naive (as reported, graphify.net).
- **3.7k+ GitHub stars** (as reported, graphify.net, 2026-04-13).
- **23 languages** via Tree-sitter AST (as reported, PyPI README).

## Open questions

- **Benchmark methodology**: single self-curated corpus; "naive" baseline (reading all raw files) is an extreme lower bound. No comparison against embedding-based retrieval or other graph tools.
- **Graph quality at scale**: no data on repos >1k files; community detection quality with Leiden on very large graphs is untested.
- **LLM cost**: semantic extraction pass makes parallel LLM calls proportional to corpus size; no cost estimate provided.
- **MCP surface**: `serve.py` MCP integration is underdocumented; tool names, schemas, and transport not described on the website.
- **Stability**: version 0.4.10 with rapid iteration (10 patch releases within ~1 week); API/output format stability unconfirmed.
- **graph.json schema**: no published schema; downstream tooling (Neo4j export) may not survive format changes.
