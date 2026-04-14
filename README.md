# agentic-context

Research collection on **context management** for LLM-based agentic systems — tooling, techniques, and papers covering what goes into the active context window, how it gets there, and how it gets managed under pressure.

**Published site**: https://pantheon-org.github.io/agentic-context

## Scope

This repo focuses on the **active context window layer**: what is injected, compressed, truncated, summarized, or routed at inference time. It is adjacent to but distinct from:

- [agentic-memory](https://github.com/lhl/agentic-memory) — long-term memory: storage/retrieval across sessions
- [agentic-security](https://github.com/lhl/agentic-security) — threat models and defenses for agentic systems

Context management intersects both: retrieval feeds the context window; a poisoned context is a security problem. But the core question here is: **given a fixed or sliding context budget, how do agents decide what to put in it?**

## Areas covered

- **Compression & summarization** — rolling summarization, lossy/lossless compaction
- **Tiered loading** — L0/L1/L2 priority schemes, lazy vs eager injection
- **Token budgeting** — hard caps, soft priorities, eviction policies
- **Context-mode tooling** — production CLI/daemon tools that manage context at the session level
- **Retrieval-augmented injection** — how RAG feeds context (overlap with agentic-memory)
- **Benchmarks** — how context management quality is measured

## How to navigate

| File / Dir | Purpose |
|---|---|
| `ANALYSIS.md` | Cross-tool synthesis and comparison matrix |
| `analysis/ANALYSIS-*.md` | Per-tool source-verified deep dives |
| `REVIEWED.md` | Triage log — all examined tools and papers with disposition |
| `PUNCHLIST.md` | Tracking checklist for pending deep dives |
| `references/` | Summarized source docs (markdown + frontmatter) |
| `references/REFERENCE_INDEX.md` | Topic-organized index of all sources |
| `references/papers/` | Archived PDFs + extracted text snapshots |
| `references/bib/` | BibTeX per arxiv ID |
| `references/web/` | Saved web sources |
| `tools/` | Vendored tool repos (git submodules) |
| `benchmarks/` | Benchmark reproduction guides and audit notes |
| `datasets/` | Paper matrices (CSV/XLSX) |
| `scripts/` | Automation: PDF extraction, sync, BibTeX gen |
| `site/` | Astro 6 + Starlight static site (publishes to GitHub Pages) |

## Tools under investigation

16 tools analyzed; all source-verified against vendored repos.

| Tool | Approach | Analysis |
|---|---|---|
| [context-mode](https://github.com/mksglu/context-mode) | MCP output interception + FTS5 knowledge base | [analysis](analysis/ANALYSIS-context-mode.md) |
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | AST → SQLite knowledge graph; structural queries | [analysis](analysis/ANALYSIS-deusdata-codebase-memory-mcp.md) |
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | Tree-sitter AST → SQLite; blast-radius + community detection | [analysis](analysis/ANALYSIS-tirth8205-code-review-graph.md) |
| [codegraph](https://github.com/colbymchenry/codegraph) | Tree-sitter AST → SQLite; single blast-radius tool; WASM-bundled | [analysis](analysis/ANALYSIS-colbymchenry-codegraph.md) |
| [graphify](https://github.com/safishamsi/graphify) | Prompt-orchestrated multi-modal knowledge graph; Leiden clustering | [analysis](analysis/ANALYSIS-graphify.md) |
| [Serena](https://github.com/oraios/serena) | LSP-backed symbol retrieval; progressive fallback on oversized results | [analysis](analysis/ANALYSIS-oraios-serena.md) |
| [jcodemunch-mcp](https://github.com/jgravelle/jcodemunch-mcp) | Tree-sitter AST → SQLite WAL; exact byte-span retrieval | [analysis](analysis/ANALYSIS-jgravelle-jcodemunch-mcp.md) |
| [rtk](https://github.com/rtk-ai/rtk) | Claude Code hook-based CLI proxy; 69 Rust handlers + 58 TOML filters | [analysis](analysis/ANALYSIS-rtk.md) |
| [n2-arachne](https://github.com/choihyunsus/n2-arachne) | MCP server; fixed % budget allocations (10/30/40/20) | [analysis](analysis/ANALYSIS-choihyunsus-n2-arachne.md) |
| [jdocmunch-mcp](https://github.com/jgravelle/jdocmunch-mcp) | Section-level markdown indexing; O(1) byte-offset retrieval | [analysis](analysis/ANALYSIS-jgravelle-jdocmunch-mcp.md) |
| [SocratiCode](https://github.com/giancarloerra/SocratiCode) | Qdrant-backed hybrid search (dense + BM25 via RRF); AST-aware chunking | [analysis](analysis/ANALYSIS-giancarloerra-socraticode.md) |
| [qmd](https://github.com/tobi/qmd) | 8-step hybrid query pipeline: BM25 → LLM expansion → vec → RRF → rerank | [analysis](analysis/ANALYSIS-tobi-qmd.md) |
| [caveman](https://github.com/JuliusBrussee/caveman) | Claude Code skill enforcing compressed output style | [analysis](analysis/ANALYSIS-juliusbrussee-caveman.md) |
| [Understand-Anything](https://github.com/Lum1104/Understand-Anything) | Multi-agent pipeline → structural + domain knowledge graph dashboard | [analysis](analysis/ANALYSIS-lum1104-understand-anything.md) |
| [git-semantic-bun](https://github.com/danjdewhurst/git-semantic-bun) | Local vector index over git commit history; hybrid BM25 + semantic ranking | [analysis](analysis/ANALYSIS-danjdewhurst-git-semantic-bun.md) |
| [osgrep](https://github.com/Ryandonofrio3/osgrep) | npm CLI; LanceDB vector store, tree-sitter AST chunking, Granite 30M dense + mxbai ColBERT 17M reranking, two-stage hybrid search | [analysis](analysis/ANALYSIS-ryandonofrio3-osgrep.md) |

## Papers under investigation

5 papers triaged; full analyses pending.

| Paper | Venue | Notes |
|---|---|---|
| [LLMLingua](https://arxiv.org/abs/2310.05736) — Compressing Prompts for Accelerated Inference | EMNLP 2023 | Coarse-to-fine prompt compression; up to 20× reduction |
| [LongBench](https://arxiv.org/abs/2308.14508) — A Bilingual, Multitask Benchmark for Long Context Understanding | ACL 2024 | 21 datasets, avg 6.7K EN / 13.4K ZH tokens |
| [LongBench v2](https://arxiv.org/abs/2412.15204) — Deeper Understanding on Realistic Long-context Multitasks | ACL 2025 | 503 MCQs, 8K–2M words; harder than v1 |
| [HELMET](https://arxiv.org/abs/2410.02694) — How to Evaluate Long-Context Language Models Effectively | ICLR 2025 | 7 categories, 128K tokens; NIAH does not predict downstream perf |
| [Recursive Language Models](https://arxiv.org/abs/2512.24601) | 2025 | LLM recursively calls itself over long inputs; 100× context window |

## Key themes

*Populated as analysis matures.*
