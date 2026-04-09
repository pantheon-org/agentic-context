# Context Management — Cross-Tool Synthesis

Research synthesis across all analyzed tools and papers. Updated as individual `ANALYSIS-*.md` files are added and promoted.

---

## Comparison matrix

*Populated as analyses are added.*

| Tool / Paper | Approach | Compression | Token budget model | Benchmarks | Notes |
|---|---|---|---|---|---|
| [context-mode](analysis/ANALYSIS-context-mode.md) | MCP-layer output interception + FTS5 knowledge base | 95–100% (summarization, verified); 44–93% (retrieval, as reported) | Implicit: agent selects tool | Partially verified; cold start 1–4s/call undisclosed | PreCompact hook extends session ~30 min → ~3 hr (as reported); ELv2 license |

---

## Key themes

*Populated as analysis matures.*

---

## Recommended reading order

1. **context-mode** — read first; establishes the MCP-layer interception pattern and the two-speed retrieval distinction that all subsequent tool comparisons should reference.
