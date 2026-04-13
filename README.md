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
| `ANALYSIS-*.md` | Per-tool or per-paper deep dives |
| `REVIEWED.md` | Triage log — examined but not yet promoted |
| `PUNCHLIST.md` | Tracking checklist for pending deep dives |
| `references/` | Summarized source docs (markdown + frontmatter) |
| `references/REFERENCE_INDEX.md` | Topic-organized index of all sources |
| `references/papers/` | Archived PDFs + extracted text snapshots |
| `references/bib/` | BibTeX per arxiv ID |
| `references/web/` | Saved web sources |
| `tools/` | Vendored/cloned context tool repos |
| `analysis/` | Cross-cutting synthesis notes |
| `benchmarks/` | Benchmark sources and audit notes |
| `datasets/` | Paper matrices (CSV/XLSX) |
| `scripts/` | Automation: PDF extraction, sync, BibTeX gen |
| `site/` | Astro 6 + Starlight static site (publishes to GitHub Pages) |

## Tools under investigation

*Populated as analyses are added.*

## Papers under investigation

*Populated as analyses are added.*

## Key themes

*Populated as analysis matures.*
