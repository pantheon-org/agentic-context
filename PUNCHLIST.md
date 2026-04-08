# Punchlist — Pending Deep Dives

Tracking checklist for tools and papers queued for analysis.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[-]` skipped (see REVIEWED.md)

---

## Tools

- [ ] serena (oraios/serena) — MCP toolkit for coding; semantic retrieval + editing via language server
- [ ] rtk (rtk-ai/rtk) — CLI proxy; filters tool output noise, 60-90% token reduction on dev commands
- [ ] qmd (tobi/qmd) — local BM25+vector search engine for docs/notes; MCP plugin
- [ ] caveman (JuliusBrussee/caveman) — Claude Code skill; caveman-speak output compression, claims 65% token reduction
- [ ] context-mode (mksglu/context-mode) — MCP plugin; sandboxes tool output to protect context window; claims 98% token reduction
- [ ] jcodemunch-mcp (jgravelle/jcodemunch-mcp) — token-efficient MCP for code exploration via tree-sitter AST parsing
- [ ] codebase-memory-mcp (DeusData/codebase-memory-mcp) — code intelligence MCP; indexes codebase into knowledge graph; 66 languages, claims 99% fewer tokens
- [ ] SocratiCode (giancarloerra/SocratiCode) — codebase intelligence MCP; hybrid semantic search + dependency graphs; claims 61% fewer tokens
- [ ] jdocmunch-mcp (jgravelle/jdocmunch-mcp) — token-efficient MCP for doc retrieval via structured section indexing
- [ ] n2-arachne (choihyunsus/n2-arachne) — assembles code context (tree/deps/semantic) to fit context windows without noise

## Papers

- [ ] LLMLingua (arxiv:2310.05736) — coarse-to-fine prompt compression via token-level importance scoring; up to 20x compression (EMNLP 2023); see also LLMLingua-2 (arxiv:2403.12968)
- [ ] Recursive Language Models (arxiv:2512.24601) — inference-time recursion over long prompts; processes inputs 100× beyond context window; Zhang, Kraska, Khattab

## Benchmarks

- [ ] HELMET (princeton-nlp/HELMET · arxiv:2410.02694) — comprehensive application-centric benchmark for long-context LLM evaluation; 7 task categories, up to 128K tokens
- [ ] LongBench v1 (THUDM/LongBench · arxiv:2308.14508) — bilingual multitask benchmark; 21 datasets, 6 task categories, avg 6.7K tokens (ACL 2024)
- [ ] LongBench v2 (THUDM/LongBench · arxiv:2412.15204) — harder reasoning on realistic long-context multitasks (ACL 2025)

## Scripts

- [ ] `scripts/extract_pdf.py` — extract PDFs to Markdown snapshots via marker-pdf
- [ ] `scripts/sync_ref.py` — download PDFs listed in PUNCHLIST.md to `references/papers/`
- [ ] `scripts/build_reference_index.py` — generate/sync BibTeX and reference index

> Note: `scripts/README.md` documents `.sh` equivalents that don't exist — reconcile naming.
