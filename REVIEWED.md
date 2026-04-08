# Triage Log

Reverse-chronological log of all examined tools and papers. Items here have been assessed but not yet promoted to a standalone `ANALYSIS-*.md` or the main `ANALYSIS.md` matrix.

See `AGENTS.md` for the full triage workflow.

---

## Summary table

| Date | Name | Type | Disposition | Notes |
|---|---|---|---|---|
| 2026-04-08 | tidyinfo-qmd | tool | pending | Local BM25+vector hybrid search engine for markdown; MCP server; single Rust binary, no runtime deps |
| 2026-04-08 | juliusbrussee-caveman | tool | pending | Claude Code skill that forces caveman-speak output; claims 65% output-token and 45% input-token reduction via companion compress sub-tool |
| 2026-04-08 | choihyunsus-n2-arachne | tool | pending | MCP server that assembles code context (tree/deps/semantic) into a token-budgeted payload; hybrid BM25 + vector search with dependency graph traversal |
| 2026-04-08 | deusdata-codebase-memory-mcp | tool | pending | Code intelligence MCP server; indexes codebase into SQLite knowledge graph; 66 languages; claims 99% fewer tokens vs file-by-file grep |
| 2026-04-08 | jgravelle-jdocmunch-mcp | tool | pending | Token-efficient MCP server for structured doc retrieval via section-level indexing |
| 2026-04-08 | oraios-serena | tool | pending | MCP server providing LSP-backed semantic code retrieval and editing for coding agents |
| 2026-04-08 | context-mode | tool | pending | MCP plugin that sandboxes tool output into subprocesses; claims 98% token reduction and session continuity via SQLite/FTS5 |
| 2026-04-08 | jgravelle-jcodemunch-mcp | tool | pending | MCP server for token-efficient code exploration via tree-sitter AST parsing; claims 95% token reduction on code-reading tasks |
| 2026-04-08 | rtk | tool | pending | CLI proxy; filters tool output noise, 60-90% token reduction on dev commands |
| 2026-04-08 | giancarloerra-socraticode | tool | pending | MCP server for codebase intelligence: hybrid semantic+BM25 search, polyglot dependency graphs, zero-config local-first; claims 61.5% token reduction |

---

## Detailed entries

_Entries added below in reverse-chronological order as triage proceeds._
