# Context Management — Cross-Tool Synthesis

Research synthesis across all analyzed tools and papers. Updated as individual `ANALYSIS-*.md` files are added and promoted.

---

## Comparison matrix

*Populated as analyses are added.*

| Tool / Paper | Approach | Compression | Token budget model | Benchmarks | Notes |
|---|---|---|---|---|---|
| [context-mode](analysis/ANALYSIS-context-mode.md) | MCP-layer output interception + FTS5 knowledge base | 95–100% (summarization, verified); 44–93% (retrieval, as reported) | Implicit: agent selects tool | Partially verified; cold start 1–4s/call undisclosed | PreCompact hook extends session ~30 min → ~3 hr (as reported); ELv2 license |
| [codebase-memory-mcp](analysis/ANALYSIS-deusdata-codebase-memory-mcp.md) | AST-to-SQLite knowledge graph; structural graph queries replace file reads | ~90–99% vs grep (directional; 5 live queries ~1,095 tokens verified) | None — result set size is the bound | No runnable harness; live queries verified | Dynamic language edges heuristic; no auth on MCP/UI; MIT |

---

## Key themes

*Populated as analysis matures.*

---

## Recommended reading order

1. **context-mode** — read first; establishes the MCP-layer interception pattern and the two-speed retrieval distinction that all subsequent tool comparisons should reference.
2. **codebase-memory-mcp** — read second; graph queries are complementary to context-mode (structural navigation vs output sandboxing); together they cover the two main sources of context bloat in coding sessions.
