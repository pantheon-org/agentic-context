# Context Management — Cross-Tool Synthesis

Research synthesis across all analyzed tools and papers. Updated as individual `ANALYSIS-*.md` files are added and promoted.

---

## Comparison matrix

*Populated as analyses are added.*

| Tool / Paper | Approach | Compression | Token budget model | Benchmarks | Notes |
|---|---|---|---|---|---|
| [context-mode](analysis/ANALYSIS-context-mode.md) | MCP-layer output interception + FTS5 knowledge base | 95–100% (summarization, verified); 44–93% (retrieval, as reported) | Implicit: agent selects tool | Partially verified; cold start 1–4s/call undisclosed | PreCompact hook extends session ~30 min → ~3 hr (as reported); ELv2 license |
| [codebase-memory-mcp](analysis/ANALYSIS-deusdata-codebase-memory-mcp.md) | AST-to-SQLite knowledge graph; structural graph queries replace file reads | ~90–99% vs grep (directional; 5 live queries ~1,095 tokens verified) | None — result set size is the bound | No runnable harness; live queries verified | Dynamic language edges heuristic; no auth on MCP/UI; MIT |
| [code-review-graph](analysis/ANALYSIS-tirth8205-code-review-graph.md) | Tree-sitter AST → SQLite; blast-radius + community detection + hybrid search; 22 tools | 8.2× average (as reported, range 0.7×–16.4×); 49× "daily tasks" unverified | None — result set size | `evaluate/` runner exists; not reproduced; MRR 0.35 (stated, low) | 7,624 stars; Python 3.10+; active community; MIT |
| [codegraph](analysis/ANALYSIS-colbymchenry-codegraph.md) | Tree-sitter AST → SQLite; single `codegraph_explore` blast-radius tool | 94% fewer tool calls / 77% faster (as reported, own eval runner — unverified) | None — traversal result set varies | `evaluation/runner.ts` exists; not reproduced; 8.2× table is CRG's data | WASM bundled; zero native deps; README integrity issue; 412 stars; MIT |
| [Understand-Anything](analysis/ANALYSIS-lum1104-understand-anything.md) | Multi-agent LLM pipeline → structural + domain graph dashboard | N/A — developer comprehension focus; no token reduction claim | None | None documented | 8,081 stars; TypeScript/Node.js; MIT |
| [git-semantic-bun](analysis/ANALYSIS-danjdewhurst-git-semantic-bun.md) | Local vector index over git commit messages | N/A — retrieval, not summarization | None | `gsb benchmark` requires user-provided queries; no published figures | No MCP; pre-stable; 3 stars; MIT |

---

## Key themes

*Populated as analysis matures.*

---

## Recommended reading order

1. **context-mode** — read first; establishes the MCP-layer interception pattern and the two-speed retrieval distinction that all subsequent tool comparisons should reference.
2. **codebase-memory-mcp** — read second; graph queries are complementary to context-mode (structural navigation vs output sandboxing); together they cover the two main sources of context bloat in coding sessions.
3. **code-review-graph** — read third; canonical example of the AST-graph approach with community detection and wiki generation; use as the benchmark baseline for graph-based tools.
4. **codegraph** — read alongside code-review-graph; architecturally similar but WASM-bundled and single-tool; important README integrity caveat.
5. **Understand-Anything** — read if developer comprehension (domain mapping, not token reduction) is the target; different value proposition from all others in this list.
6. **git-semantic-bun** — borderline scope; read only if semantic retrieval from git history is specifically needed.
