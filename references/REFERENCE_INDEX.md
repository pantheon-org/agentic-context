# Reference Index

Topic-organized index of all local references. Each entry links to the summary file in `references/` and gives a one-line description.

For full content, open the linked file. For papers, see `references/papers/` for PDFs and extracted text snapshots.

---

## Compression & summarization

*Papers and tools focused on reducing token count while preserving semantics.*

| Slug | Author | Description |
|---|---|---|
| [jiang-llmlingua](jiang-llmlingua.md) | Jiang et al. | Coarse-to-fine prompt compression: budget controller + iterative token-level removal + instruction tuning; up to 20× compression with small accuracy loss; EMNLP 2023 |
| [zhang-recursive-lm](zhang-recursive-lm.md) | Zhang et al. | Inference paradigm: LLM programmatically decomposes and recursively calls itself over long-input snippets; processes 100× context window; RLM-Qwen3-8B +28.3% over base model (preprint 2025) |
| [juliusbrussee-caveman](juliusbrussee-caveman.md) | JuliusBrussee | Claude Code skill: forces caveman-speak output via system-prompt constraint; companion compress sub-tool rewrites memory files; ~50–53% honest output reduction (skill vs terse control, char proxy); 4 eval arms in committed snapshot (MIT) |
| [choihyunsus-n2-arachne](choihyunsus-n2-arachne.md) | choihyunsus | MCP server: 4-layer context assembly (tree + target + deps + semantic), hybrid BM25/vector search, dependency graph traversal, token-budget paging; reports 333× compression on 3,219-file project; benchmark harness scripts absent from repo — claim unverifiable (dual Apache-2.0/commercial) |
| [context-mode](web/context-mode.md) | mksglu | MCP plugin: subprocess sandbox keeps raw tool output out of context window; reports 98% median token reduction; session continuity via SQLite/FTS5 (ELv2) |
| [rtk-ai-rtk](rtk-ai-rtk.md) | rtk-ai | CLI proxy: intercepts shell command output and applies per-command noise filtering, grouping, truncation, and deduplication before it reaches the LLM; self-reports 60–90% token reduction (Apache-2.0) |
| [jgravelle-jcodemunch-mcp](jgravelle-jcodemunch-mcp.md) | jgravelle | MCP server: tree-sitter AST symbol extraction, SQLite-backed local index, byte-offset retrieval; WRR fusion across 4 channels; reports 99.6% aggregate reduction (15 task-runs, updated from prior 95% figure); v1.36.0 (dual-use license) |
| [jgravelle-jdocmunch-mcp](jgravelle-jdocmunch-mcp.md) | jgravelle | MCP server: structured section-level doc indexing with byte-offset retrieval; 16 MCP tools (not 13); v1.8.0; reports 97–98% token reduction on doc-reading tasks (dual-use license) |
| [deusdata-codebase-memory-mcp](deusdata-codebase-memory-mcp.md) | DeusData | MCP server: persistent SQLite knowledge graph via tree-sitter AST, 66 languages, 14 tools, single static C binary; reports 99.2% token reduction vs file-by-file grep (MIT) |
| [colbymchenry-codegraph](colbymchenry-codegraph.md) | colbymchenry | Node.js MCP server: Tree-sitter AST → SQLite knowledge graph; 9 MCP tools; FTS5 + BFS traversal (no vectors); blast-radius + call-graph traversal; reports 92% fewer tool calls on average (MIT) |
| [tirth8205-code-review-graph](tirth8205-code-review-graph.md) | tirth8205 | Python MCP server: 24 tools (not 22), 22 languages (not 19), blast-radius analysis, community detection, wiki generation, multi-repo registry; reports 8.2× average token reduction on reviews; 7,624 stars (MIT) |

---

## Tiered loading & injection

*Systems with priority-based context injection (L0/L1/L2, lazy vs eager).*

| Slug | Author | Description |
|---|---|---|

---

## Token budgeting & eviction

*Hard caps, soft priorities, eviction policies, overflow handling.*

| Slug | Author | Description |
|---|---|---|

---

## Session-level context tooling

*Production CLI/daemon tools that manage context at the session level.*

| Slug | Author | Description |
|---|---|---|
| [oraios-serena](oraios-serena.md) | oraios | MCP server: LSP-backed semantic code retrieval and symbol-level editing for coding agents; 40+ languages, built-in agent memory system (MIT) |
| [context-mode](web/context-mode.md) | mksglu | MCP plugin: subprocess sandbox + SQLite/FTS5 event log; extends session from ~30 min to ~3 hours via BM25 compaction recovery; 12 platforms (ELv2) |
| [rtk-ai-rtk](rtk-ai-rtk.md) | rtk-ai | CLI proxy: transparent hook-based output compression for 100+ dev commands; single Rust binary, <10 ms overhead, no LLM involvement; inline test enforcement is runtime-only (rtk verify), not compile-time (Apache-2.0) |
| [giancarloerra-socraticode](giancarloerra-socraticode.md) | giancarloerra | MCP server: hybrid dense+BM25 (Qdrant RRF) codebase search, AST-aware chunking, polyglot dependency graphs; Qdrant-only (no SQLite); 61.5% is bytes not tokens; AGPL-3.0 |
| [tobi-qmd](tobi-qmd.md) | tobi | Node.js MCP server: BM25/vec/HyDE hybrid search over local markdown, lex/vec/hyde query types + RRF reranking, Claude Code plugin, SQLite storage; training artifacts ARE in repo (finetune/); 20.3k stars (MIT) |
| [lum1104-understand-anything](lum1104-understand-anything.md) | Lum1104 | Claude Code skill: 5-agent pipeline builds structural + domain knowledge graph; interactive dashboard; guided tours, diff impact analysis, persona-adaptive UI; 8,081 stars (MIT) |
| [safishamsi-graphify](safishamsi-graphify.md) | safishamsi | Python CLI + MCP skill: multi-modal knowledge graph (code/PDFs/images/video); Tree-sitter AST + parallel LLM extraction; NetworkX + Leiden clustering; 71.5× token reduction on mixed corpus (as reported); 3.7k+ stars (MIT) |
| [danjdewhurst-git-semantic-bun](danjdewhurst-git-semantic-bun.md) | danjdewhurst | CLI tool: semantic vector search over git commit history; Bun/TypeScript; no MCP server; borderline scope — retrieval primitive rather than context management (MIT) |

---

## Benchmarks & evaluation

*Datasets and evaluation frameworks for context management quality.*

| Slug | Author | Description |
|---|---|---|
| [yen-helmet](yen-helmet.md) | Yen et al. (Princeton NLP) | 7-category application-centric long-context benchmark; up to 128K tokens; 59 LCLMs; NIAH unreliable; RAG tasks best proxy; ACL 2024/2025 |
| [bai-longbench](bai-longbench.md) | Bai et al. | First bilingual (EN+ZH) multitask long-context benchmark; 21 datasets, 6 categories, avg 6.7K EN tokens; ACL 2024 |
| [bai-longbench-v2](bai-longbench-v2.md) | Bai et al. | Harder reasoning benchmark; 503 MCQs, 8K–2M words; human 53.7%, best model 50.1%, o1-preview 57.7%; ACL 2025 |

---

## Surveys

*Overview papers covering context management broadly.*

| Slug | Author | Description |
|---|---|---|
