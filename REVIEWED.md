# Triage Log

Reverse-chronological log of all examined tools and papers. Items here have been assessed but not yet promoted to a standalone `ANALYSIS-*.md` or the main `ANALYSIS.md` matrix.

See `AGENTS.md` for the full triage workflow.

---

## Summary table

| Date | Name | Type | Disposition | Notes |
|---|---|---|---|---|
| 2026-04-10 | colbymchenry-codegraph | tool | analysis | Node.js/WASM MCP server; single codegraph_explore tool; created 2026-01-18; 94% fewer tool calls (own eval runner); README copies CRG's diagrams and benchmark table — treat with caution; 412 stars; MIT |
| 2026-04-10 | tirth8205-code-review-graph | tool | analysis | Python MCP server; 22 tools; blast-radius, community detection, wiki generation; launched 2026-02-26; independent of codegraph; 8.2× token reduction on reviews (own benchmarks); 7,624 stars; MIT |
| 2026-04-10 | lum1104-understand-anything | tool | analysis | Multi-agent pipeline building structural + domain knowledge graph dashboard; developer comprehension focus, no token reduction claims; 8,081 stars; MIT |
| 2026-04-10 | danjdewhurst-git-semantic-bun | tool | analysis | CLI tool for semantic vector search over git commit history; Bun/TypeScript; no MCP server; borderline scope; 3 stars; MIT |
| 2026-04-09 | bai-longbench-v2 | paper | pending | Harder long-context benchmark; 503 MCQs, 8K–2M words, human baseline 53.7%; best model 50.1%, o1-preview 57.7%; ACL 2025 |
| 2026-04-09 | bai-longbench | paper | pending | First bilingual multitask long-context benchmark; 21 datasets, 6 categories, avg 6.7K EN / 13.4K ZH tokens; ACL 2024 |
| 2026-04-09 | yen-helmet | paper | pending | Application-centric long-context benchmark; 7 categories, 128K tokens, 59 LCLMs; NIAH does not predict downstream perf |
| 2026-04-09 | zhang-recursive-lm | paper | pending | Inference paradigm: LLM recursively calls itself over long-input snippets; 100× context window; RLM-Qwen3-8B +28.3% over base |
| 2026-04-09 | jiang-llmlingua | paper | pending | Coarse-to-fine prompt compression; up to 20× reduction; budget controller + iterative token removal + instruction tuning; EMNLP 2023 |
| 2026-04-10 | tobi-qmd | tool | analysis | Node.js hybrid search (BM25/vec/HyDE) for markdown; 8-step query pipeline verified from source; full benchmark harness exists, no published results; custom 1.7B query expansion model, no training artifacts; 20.3k stars; MIT |
| 2026-04-10 | juliusbrussee-caveman | tool | analysis | Claude Code skill enforcing caveman-speak output + compress sub-tool; ~75% output-token / ~45% input-token reduction (updated from 65% triage); offline eval snapshot committed and reproducible |
| 2026-04-10 | choihyunsus-n2-arachne | tool | analysis | MCP server assembling token-budgeted context payloads; fixed % allocations (10/30/40/20); chars/3.5 heuristic tokenizer; no public benchmark harness; non-commercial-only license |
| 2026-04-09 | deusdata-codebase-memory-mcp | tool | analysis | Code intelligence MCP server; indexes codebase into SQLite knowledge graph; 66 languages; claims 99% fewer tokens vs file-by-file grep |
| 2026-04-10 | jgravelle-jdocmunch-mcp | tool | analysis | O(1) byte-offset section retrieval verified; savings accounting flaw (counts all sections, not returned); opt-out telemetry; v1.7.1; non-commercial dual license ($79–$1,999 tiers) |
| 2026-04-10 | oraios-serena | tool | analysis | LSP-backed symbol retrieval; ~30 tools across two backends; novel progressive fallback on oversized results; 55 LSP language servers; no benchmark harness |
| 2026-04-09 | context-mode | tool | analysis | MCP plugin that sandboxes tool output into subprocesses; claims 98% token reduction and session continuity via SQLite/FTS5 |
| 2026-04-10 | jgravelle-jcodemunch-mcp | tool | analysis | Tree-sitter AST + SQLite WAL; 95% token reduction on 3 small repos (range 79.7–99.8%); runnable benchmark harness; non-OSI license; optional AI summarization sends code to external APIs |
| 2026-04-10 | rtk | tool | analysis | Claude Code hook-based CLI proxy; two-track filter pipeline (69 Rust handlers + 58 TOML filters); chars/4 heuristic; runnable benchmark with 80% CI gate; v0.35.0; Apache-2.0 |
| 2026-04-10 | giancarloerra-socraticode | tool | analysis | Qdrant-backed hybrid search (RRF via Qdrant platform feature); AST-aware chunking; 61.5% is bytes not tokens, single live session, no harness; Docker required (not local SQLite as triaged); MIT |

---

## Detailed entries

*Entries added below in reverse-chronological order as triage proceeds.*

## bai-longbench-v2 — LongBench v2: Towards Deeper Understanding and Reasoning on Realistic Long-context Multitasks

- **arxiv**: 2412.15204
- **Authors**: Yushi Bai, Shangqing Tu, Jiajie Zhang, et al.
- **Date**: 2024-12-19
- **Tags**: paper, benchmark, empirical
- **Summary**: LongBench v2 is a harder long-context benchmark of 503 MCQs with contexts from 8K to 2M words across 6 task categories. Human experts score 53.7% (timed); best direct model 50.1%; o1-preview 57.7%. Focuses on full-context reasoning rather than retrieval. ACL 2025.
- **Disposition**: pending — awaiting user decision on promotion

## bai-longbench — LongBench: A Bilingual, Multitask Benchmark for Long Context Understanding

- **arxiv**: 2308.14508
- **Authors**: Yushi Bai, Xin Lv, Jiajie Zhang, et al.
- **Date**: 2023-08-28
- **Tags**: paper, benchmark, empirical
- **Summary**: The first bilingual (EN+ZH) multitask benchmark for long-context understanding; 21 datasets across 6 categories; avg 6.7K EN / 13.4K ZH tokens. Evaluates 8 LLMs; finds retrieval compression helps, scaled positional embeddings help, all models degrade on longer contexts. ACL 2024.
- **Disposition**: pending — awaiting user decision on promotion

## yen-helmet — HELMET: How to Evaluate Long-Context Language Models Effectively and Thoroughly

- **arxiv**: 2410.02694
- **Authors**: Howard Yen, Tianyu Gao, et al. (Princeton NLP)
- **Date**: 2024-10-03
- **Tags**: paper, benchmark, empirical
- **Summary**: Comprehensive long-context benchmark covering 7 application-centric categories at lengths up to 128K tokens. Evaluates 59 LCLMs. Key findings: NIAH does not predict downstream performance; open-source models lag closed models on full-context reasoning; RAG tasks are the best fast proxy for overall long-context quality.
- **Disposition**: pending — awaiting user decision on promotion

## zhang-recursive-lm — Recursive Language Models

- **arxiv**: 2512.24601
- **Authors**: Alex L. Zhang, Tim Kraska, Omar Khattab
- **Date**: 2025-12-31
- **Tags**: paper, empirical, system
- **Summary**: RLMs treat long inputs as an external environment, recursively calling the LLM over sub-prompts to process inputs 100× beyond the context window. Outperforms vanilla frontier LLMs and common scaffolds at comparable cost. RLM-Qwen3-8B (post-trained) beats Qwen3-8B by 28.3% on average and approaches GPT-5 quality on three tasks.
- **Disposition**: pending — awaiting user decision on promotion

## jiang-llmlingua — LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models

- **arxiv**: 2310.05736
- **Authors**: Huiqiang Jiang, Qianhui Wu, Chin-Yew Lin, Yuqing Yang, Lili Qiu
- **Date**: 2023-10-09
- **Tags**: paper, empirical, system
- **Summary**: LLMLingua is a three-stage prompt compression pipeline: a small LM assigns token budgets to coarse segments (system/demo/query), then iteratively removes the least-informative tokens within each budget, and an instruction-tuning step aligns the compressor's output distribution with the target LLM. Claims up to 20× compression with small accuracy loss on GSM8K, BBH, ShareGPT, and Arxiv-March23; accepted at EMNLP 2023. Superseded on some benchmarks by LLMLingua-2 (arxiv:2403.12968).
- **Disposition**: pending — awaiting user decision on promotion
