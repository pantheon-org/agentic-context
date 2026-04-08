# Reference Index

Topic-organized index of all local references. Each entry links to the summary file in `references/` and gives a one-line description.

For full content, open the linked file. For papers, see `references/papers/` for PDFs and extracted text snapshots.

---

## Compression & summarization

_Papers and tools focused on reducing token count while preserving semantics._

| Slug | Author | Description |
|---|---|---|
| [juliusbrussee-caveman](juliusbrussee-caveman.md) | JuliusBrussee | Claude Code skill: forces caveman-speak output via system-prompt constraint; companion compress sub-tool rewrites memory files; claims 65% output / 45% input token reduction (MIT) |
| [choihyunsus-n2-arachne](choihyunsus-n2-arachne.md) | choihyunsus | MCP server: 4-layer context assembly (tree + target + deps + semantic), hybrid BM25/vector search, dependency graph traversal, token-budget paging; reports 333× compression on 3,219-file project (Apache-2.0) |
| [context-mode](web/context-mode.md) | mksglu | MCP plugin: subprocess sandbox keeps raw tool output out of context window; reports 98% median token reduction; session continuity via SQLite/FTS5 (ELv2) |
| [rtk](rtk.md) | rtk-ai | CLI proxy: intercepts shell command output and applies per-command noise filtering, grouping, truncation, and deduplication before it reaches the LLM; self-reports 60–90% token reduction (Apache-2.0) |
| [jgravelle-jcodemunch-mcp](jgravelle-jcodemunch-mcp.md) | jgravelle | MCP server: tree-sitter AST symbol extraction, SQLite-backed local index, byte-offset retrieval; reports 95% token reduction on code-reading tasks (dual-use license) |
| [jgravelle-jdocmunch-mcp](jgravelle-jdocmunch-mcp.md) | jgravelle | MCP server: structured section-level doc indexing with byte-offset retrieval; 13 MCP tools; reports 97–98% token reduction on doc-reading tasks (dual-use license) |
| [deusdata-codebase-memory-mcp](deusdata-codebase-memory-mcp.md) | DeusData | MCP server: persistent SQLite knowledge graph via tree-sitter AST, 66 languages, 14 tools, single static C binary; reports 99.2% token reduction vs file-by-file grep (MIT) |

---

## Tiered loading & injection

_Systems with priority-based context injection (L0/L1/L2, lazy vs eager)._

| Slug | Author | Description |
|---|---|---|

---

## Token budgeting & eviction

_Hard caps, soft priorities, eviction policies, overflow handling._

| Slug | Author | Description |
|---|---|---|

---

## Session-level context tooling

_Production CLI/daemon tools that manage context at the session level._

| Slug | Author | Description |
|---|---|---|
| [oraios-serena](oraios-serena.md) | oraios | MCP server: LSP-backed semantic code retrieval and symbol-level editing for coding agents; 40+ languages, built-in agent memory system (MIT) |
| [context-mode](web/context-mode.md) | mksglu | MCP plugin: subprocess sandbox + SQLite/FTS5 event log; extends session from ~30 min to ~3 hours via BM25 compaction recovery; 12 platforms (ELv2) |
| [rtk](rtk.md) | rtk-ai | CLI proxy: transparent hook-based output compression for 100+ dev commands; single Rust binary, <10 ms overhead, no LLM involvement (Apache-2.0) |
| [giancarloerra-socraticode](giancarloerra-socraticode.md) | giancarloerra | MCP server: hybrid semantic+BM25 codebase search, AST-aware chunking, polyglot dependency graphs, zero-config local-first (AGPL-3.0) |
| [tidyinfo-qmd](tidyinfo-qmd.md) | tidyinfo (tobil) | Single-binary Rust MCP server: BM25+vector hybrid search over local markdown, SQLite storage, no runtime deps (MIT/Apache-2.0) |

---

## Benchmarks & evaluation

_Datasets and evaluation frameworks for context management quality._

| Slug | Author | Description |
|---|---|---|

---

## Surveys

_Overview papers covering context management broadly._

| Slug | Author | Description |
|---|---|---|
