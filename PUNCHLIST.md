# Punchlist — Pending Deep Dives

Tracking checklist for tools and papers queued for analysis.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[-]` skipped (see REVIEWED.md)

---

## Tools

- [x] serena (oraios/serena) — MCP toolkit for coding; semantic retrieval + editing via language server
- [x] rtk (rtk-ai/rtk) — CLI proxy; filters tool output noise, 60-90% token reduction on dev commands
- [x] qmd (tobi/qmd) — local BM25+vector search engine for docs/notes; MCP plugin
- [x] caveman (JuliusBrussee/caveman) — Claude Code skill; caveman-speak output compression, claims 65% token reduction
- [x] context-mode (mksglu/context-mode) — MCP plugin; sandboxes tool output to protect context window; claims 98% token reduction
- [x] jcodemunch-mcp (jgravelle/jcodemunch-mcp) — token-efficient MCP for code exploration via tree-sitter AST parsing
- [x] codebase-memory-mcp (DeusData/codebase-memory-mcp) — code intelligence MCP; indexes codebase into knowledge graph; 66 languages, claims 99% fewer tokens
- [x] SocratiCode (giancarloerra/SocratiCode) — codebase intelligence MCP; hybrid semantic search + dependency graphs; claims 61% fewer tokens
- [x] jdocmunch-mcp (jgravelle/jdocmunch-mcp) — token-efficient MCP for doc retrieval via structured section indexing
- [x] n2-arachne (choihyunsus/n2-arachne) — assembles code context (tree/deps/semantic) to fit context windows without noise
- [x] colbymchenry/codegraph — Node.js MCP server; Tree-sitter/SQLite knowledge graph; reports 94% fewer tool calls for Explore agent
- [x] tirth8205/code-review-graph — Python MCP server; 22 tools; blast-radius + community detection; reports 8.2× token reduction; 7.6k stars
- [x] Lum1104/Understand-Anything — multi-agent pipeline → structural + domain graph dashboard; developer comprehension focus; 8k stars
- [x] danjdewhurst/git-semantic-bun — CLI; semantic vector search over git history; no MCP; borderline scope
- [x] safishamsi/graphify — Python CLI + MCP skill; multi-modal knowledge graph (code/PDFs/images/video); Tree-sitter AST + Leiden clustering; reports 71.5× token reduction; 3.7k stars
- [x] sdl-mcp (GlitterKill/sdl-mcp) — TypeScript MCP server; Symbol Cards + Iris Gate Ladder escalation + SCIP integration; 38 tool surfaces; 81% `tools/list` reduction (gateway mode, as reported); source-available; 125 stars

## Papers

- [x] LLMLingua (arxiv:2310.05736) — coarse-to-fine prompt compression via token-level importance scoring; up to 20x compression (EMNLP 2023); see also LLMLingua-2 (arxiv:2403.12968)
- [x] Recursive Language Models (arxiv:2512.24601) — inference-time recursion over long prompts; processes inputs 100× beyond context window; Zhang, Kraska, Khattab

## Benchmarks

- [x] HELMET (princeton-nlp/HELMET · arxiv:2410.02694) — comprehensive application-centric benchmark for long-context LLM evaluation; 7 task categories, up to 128K tokens
- [x] LongBench v1 (THUDM/LongBench · arxiv:2308.14508) — bilingual multitask benchmark; 21 datasets, 6 task categories, avg 6.7K tokens (ACL 2024)
- [x] LongBench v2 (THUDM/LongBench · arxiv:2412.15204) — harder reasoning on realistic long-context multitasks (ACL 2025)

## Scripts

- [x] `scripts/extract_pdf.py` — extract PDFs to Markdown snapshots via marker-pdf
- [x] `scripts/sync_ref.py` — download PDFs listed in PUNCHLIST.md to `references/papers/`
- [x] `scripts/build_reference_index.py` — generate/sync BibTeX and reference index
