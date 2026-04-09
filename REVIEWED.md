# Triage Log

Reverse-chronological log of all examined tools and papers. Items here have been assessed but not yet promoted to a standalone `ANALYSIS-*.md` or the main `ANALYSIS.md` matrix.

See `AGENTS.md` for the full triage workflow.

---

## Summary table

| Date | Name | Type | Disposition | Notes |
|---|---|---|---|---|
| 2026-04-09 | bai-longbench-v2 | paper | pending | Harder long-context benchmark; 503 MCQs, 8K–2M words, human baseline 53.7%; best model 50.1%, o1-preview 57.7%; ACL 2025 |
| 2026-04-09 | bai-longbench | paper | pending | First bilingual multitask long-context benchmark; 21 datasets, 6 categories, avg 6.7K EN / 13.4K ZH tokens; ACL 2024 |
| 2026-04-09 | yen-helmet | paper | pending | Application-centric long-context benchmark; 7 categories, 128K tokens, 59 LCLMs; NIAH does not predict downstream perf |
| 2026-04-09 | zhang-recursive-lm | paper | pending | Inference paradigm: LLM recursively calls itself over long-input snippets; 100× context window; RLM-Qwen3-8B +28.3% over base |
| 2026-04-09 | jiang-llmlingua | paper | pending | Coarse-to-fine prompt compression; up to 20× reduction; budget controller + iterative token removal + instruction tuning; EMNLP 2023 |
| 2026-04-09 | tobi-qmd | tool | pending | Node.js on-device hybrid search (BM25/vec/HyDE) for markdown; MCP server with lex/vec/hyde query types + RRF reranking; Claude Code plugin; 20.3k stars; MIT |
| 2026-04-08 | juliusbrussee-caveman | tool | pending | Claude Code skill that forces caveman-speak output; claims 65% output-token and 45% input-token reduction via companion compress sub-tool |
| 2026-04-08 | choihyunsus-n2-arachne | tool | pending | MCP server that assembles code context (tree/deps/semantic) into a token-budgeted payload; hybrid BM25 + vector search with dependency graph traversal |
| 2026-04-08 | deusdata-codebase-memory-mcp | tool | pending | Code intelligence MCP server; indexes codebase into SQLite knowledge graph; 66 languages; claims 99% fewer tokens vs file-by-file grep |
| 2026-04-08 | jgravelle-jdocmunch-mcp | tool | pending | Token-efficient MCP server for structured doc retrieval via section-level indexing |
| 2026-04-08 | oraios-serena | tool | pending | MCP server providing LSP-backed semantic code retrieval and editing for coding agents |
| 2026-04-08 | context-mode | tool | pending | MCP plugin that sandboxes tool output into subprocesses; claims 98% token reduction and session continuity via SQLite/FTS5 |
| 2026-04-08 | jgravelle-jcodemunch-mcp | tool | pending | MCP server for token-efficient code exploration via tree-sitter AST parsing; claims 95% token reduction on code-reading tasks |
| 2026-04-08 | rtk | tool | pending | CLI proxy; filters tool output noise, 60-90% token reduction on dev commands |
| 2026-04-08 | giancarloerra-socraticode | tool | pending | MCP server for codebase intelligence: hybrid semantic+BM25 search, polyglot dependency graphs, zero-config local-first; claims 61.5% token reduction |

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
