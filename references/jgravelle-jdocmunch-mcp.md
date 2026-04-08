---
title: "jDocMunch MCP"
author: "J. Gravelle"
date: 2026-04-08
type: reference
tags: [tool, mcp, retrieval, token-efficiency, context-management]
source: "https://github.com/jgravelle/jdocmunch-mcp"
version: "v1.5.3"
context: "MCP server for structured doc retrieval; directly relevant to token budgeting and context window hygiene in agent workflows"
---

## TL;DR

- MCP server that indexes documentation into structured sections and exposes them via 13 MCP tools, enabling agents to retrieve only the sections they need rather than full documents.
- Implements the jMRI-Full open specification: discover, search, retrieve, and metadata operations with batch retrieval, hash-based drift detection, and byte-offset addressing.
- Supports local folders and GitHub repositories as documentation sources; indexes to `~/.doc-index/` as JSON + raw files.
- Wide format support: Markdown, MDX, RST, AsciiDoc, HTML, Jupyter notebooks, OpenAPI/Swagger, JSON, XML, Godot scene files, and plain text.
- Every tool response includes a `_meta` envelope reporting `tokens_saved` (per call) and `total_tokens_saved` (lifetime), accumulated in `~/.doc-index/_savings.json`.
- Self-reports 97–98% token reduction for common doc tasks versus feeding raw document trees (as reported, TOKEN_SAVINGS.md).
- Dual license: free for non-commercial use; commercial license required for production revenue-generating deployments.

## What's novel / different

Most documentation retrieval tools either dump entire files into context or rely on embedding-based semantic search. jDocMunch takes a structural approach: it parses each document format's native section boundaries (headings, tags, keys, cells), assigns stable byte-offset section IDs, and builds an in-memory index that allows O(1) retrieval of any section by ID. Agents can first call `get_toc` or `search_sections` (which return summaries only) to orient themselves, then `get_section` or `get_sections` for exact content — never pulling more than needed. This section-first discipline is the primary source of its token savings claim and distinguishes it from tools that either chunk by character count or require semantic embedding infrastructure.

## Architecture overview

### Core design

Six-stage pipeline per indexed documentation set:

1. **Discovery** — GitHub API walk or local directory traversal.
2. **Security filtering** — path traversal protection, `.gitignore`-pattern exclusion via `pathspec`, binary detection, secret exclusion.
3. **Parsing** — format-aware section splitting dispatched by `parse_file()` in `src/jdocmunch_mcp/parser/__init__.py`; 12 specialised parsers covering all supported formats.
4. **Hierarchy wiring** — `parent_id` / `children` relationships established in `parser/hierarchy.py`.
5. **Summarization** — heading text sent to an AI provider (Claude Haiku by default, Gemini Flash or OpenAI optional) for batch summaries; falls back to heading text if no API key supplied.
6. **Storage** — `DocStore` (JSON index + raw files) written to `~/.doc-index/<slug>/`; byte-range reads enable O(1) section retrieval without re-parsing.

Section IDs are stable slugs of the form `owner/repo::path/to/file.md::heading-slug#N`, making them safe to cache across agent turns.

### Interface / API

13 MCP tools exposed via the MCP framework:

| Tool | Purpose |
|---|---|
| `index_local` | Index a local folder |
| `index_repo` | Index a GitHub repository |
| `list_repos` | List indexed documentation sets |
| `get_toc` | Flat ordered section list (summaries only) |
| `get_toc_tree` | Nested section tree per document |
| `get_document_outline` | Section hierarchy for one document |
| `search_sections` | Weighted keyword search, summaries only |
| `get_section` | Full content of one section by ID |
| `get_sections` | Batch content retrieval |
| `get_section_context` | Section + ancestor headings + child summaries |
| `delete_index` | Remove a doc index |
| `get_broken_links` | Detect internal links/anchors that no longer resolve |
| `get_doc_coverage` | Which code symbols have matching doc sections |

Every response includes a `_meta` envelope: `latency_ms`, `sections_returned`, `tokens_saved`, `total_tokens_saved`, `cost_avoided`.

### Dependencies

Core (always installed): `mcp>=1.10.0`, `httpx>=0.27.0`, `pathspec>=0.12.0`, `pyyaml>=6.0`.
Optional extras: `anthropic>=0.40.0` (AI summaries via Claude Haiku), `google-generativeai>=0.8.0` (Gemini Flash), `openai>=1.0.0`.
No database; all state is JSON files under `~/.doc-index/`.

### Scope / limitations

- Optimised for heading-structured documentation; unstructured prose (plain text) falls back to paragraph-block splitting which may produce coarser sections.
- Summarization quality depends on the AI provider key supplied; without a key, summaries fall back to raw heading text, reducing `search_sections` relevance.
- No persistent vector index; search is weighted keyword matching over section summaries, not semantic embedding. Embedding providers (`sentence-transformers`, Gemini) are referenced in `src/jdocmunch_mcp/embeddings/provider.py` but not documented as production-ready.
- Storage is local-only (`~/.doc-index/`); no multi-user or remote-index support described.

## Deployment model

- **Runtime**: Python 3.10+, installed via `pip install jdocmunch-mcp`.
- **Entry point**: `jdocmunch-mcp` CLI, registered as an MCP server (stdio or SSE transport).
- **Storage**: JSON index files at `~/.doc-index/`; no database dependency.
- **Configuration**: environment variables (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `DOC_INDEX_PATH`, etc.); optional `server.json` for MCP client config.
- **Integrations**: Claude Desktop, Claude Code, OpenClaw, Google Antigravity (documented in README).

## Benchmarks / self-reported metrics

All figures are from `TOKEN_SAVINGS.md` and the README; none are independently verified.

| Task | Raw approach | With jDocMunch | Savings |
|---|---|---|---|
| Find a specific topic | ~12,000 tokens | ~400 tokens | ~97% (as reported) |
| Browse doc structure | ~40,000 tokens | ~800 tokens | ~98% (as reported) |
| Read one section | ~12,000 tokens | ~300 tokens | ~97.5% (as reported) |
| Explore a doc set | ~100,000 tokens | ~2,000 tokens | ~98% (as reported) |

No benchmark methodology, dataset, or model used in measurement is disclosed. Figures should be treated as illustrative estimates, not reproducible measurements.

## Open questions / risks / missing details

- Benchmark methodology is absent: no disclosure of which models were tested, what documentation corpora were used, or how "raw approach" token counts were measured.
- The embedding/semantic search path (`embeddings/provider.py`) is referenced in the codebase but not documented as a supported feature; it is unclear whether it is production-ready or experimental.
- Dual-license structure (NOASSERTION SPDX) means the exact commercial threshold is defined only in the LICENSE file prose, which is non-standard and may create ambiguity for enterprise adopters.
- No mention of index staleness handling beyond hash-based drift detection; unclear how frequently indexes should be rebuilt for rapidly-evolving documentation.
- `get_doc_coverage` tool references "jcodemunch symbols" — this cross-tool dependency is not explained in the README or ARCHITECTURE.md.
- Stars (136 as of 2026-04-08) suggest modest but real adoption; no production case studies or third-party evaluations are cited.
