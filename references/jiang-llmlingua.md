---
title: "LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models"
author: "Jiang et al."
date: 2023-10-09
type: reference
tags: [paper, empirical, system]
source: "https://arxiv.org/abs/2310.05736"
source_alt: "https://arxiv.org/pdf/2310.05736"
version: "arXiv v2 (EMNLP 2023)"
context: "Foundational prompt-compression paper; predecessor to LLMLingua-2 (arxiv:2403.12968). Directly relevant to token-reduction research."
---

## TL;DR

- Introduces LLMLingua, a **coarse-to-fine prompt compression** pipeline that reduces prompt length by up to 20× with minimal performance loss.
- Uses a small **budget controller LM** (e.g. LLaMA-7B) to allocate per-component token budgets across system, demonstration, and question segments.
- Applies a **token-level iterative compression** algorithm that removes tokens conditioned on the already-compressed context, capturing inter-token dependencies.
- Bridges distribution mismatch between the small compressor LM and the target LLM via **instruction tuning** on compressed-prompt pairs.
- Evaluated on GSM8K (math reasoning), BBH (multi-task), ShareGPT (conversation), and Arxiv-March23 (open-domain QA).
- Open-sourced at https://aka.ms/LLMLingua; accepted at EMNLP 2023.

## What's novel / different

Prior compression approaches (e.g. selective sentence removal, summarization) operated at sentence or chunk granularity and did not account for interdependence among the remaining tokens. LLMLingua is the first to combine a coarse budget-allocation pass (whole components) with a fine token-level iterative pass that conditions each removal decision on the already-compressed prefix. The distribution-alignment step via instruction tuning is also novel: it finetunes the small compressor to produce outputs closer to what the target LLM expects, reducing the accuracy gap that would otherwise arise from mismatched vocabularies and training distributions.

## Mechanism overview

### Problem / motivation

LLM prompts (especially CoT and ICL prompts) are growing to tens of thousands of tokens. Long prompts increase inference latency, cost, and can exceed context windows. Existing compression methods sacrifice too much accuracy at high compression ratios, or are too slow/expensive to run at inference time.

### Core approach

Three-stage pipeline:

1. **Budget controller**: A small LM (LLaMA-7B) scores each coarse segment (system message, each demonstration, query). Segments receive token budgets proportional to their perplexity contribution. High-perplexity (more surprising) content is kept; low-perplexity content is aggressively compressed.
2. **Token-level iterative compression**: Within each budget-allocated segment, tokens are removed one at a time in order of ascending perplexity (least informative first). Each removal decision is conditioned on the already-compressed prefix, capturing sequential dependencies that one-shot removal misses.
3. **Instruction tuning for distribution alignment**: The small LM is finetuned on (original, compressed) pairs to align its compression style with the target LLM's expected input distribution, reducing the accuracy gap.

### Key design decisions

- **Asymmetry**: compression uses a small cheap LM; inference uses the (large, expensive) target LLM. Compression cost is amortized if the compressed prompt is reused or if inference latency dominates.
- **Iterative vs one-shot**: iterative removal at token level is more expensive than a single pass but significantly improves quality at high ratios (20×).
- **No target LLM involvement**: compression is done entirely by the small LM and the instruction-tuned adapter; the target LLM is not queried during compression.

## Evaluation (as reported)

| Benchmark | Compression ratio | Metric | Result vs uncompressed |
|---|---|---|---|
| GSM8K (math reasoning) | 4×–20× | Accuracy | ~1–3% drop at 4×; ~5–8% drop at 20× (as reported, Table 2) |
| BBH (multi-task) | 4×–20× | Accuracy | State-of-the-art among compression baselines at all ratios (as reported, Table 3) |
| ShareGPT (conversation) | 4×–20× | GPT-4 quality score | Competitive with uncompressed; outperforms sentence-removal baselines (as reported, Table 4) |
| Arxiv-March23 (open-domain QA) | 4×–20× | F1 | Maintains majority of uncompressed F1 at 4×; degrades more sharply beyond 10× (as reported, Table 5) |

Baselines: Selective-Context, sentence-level summarization, random token removal. LLMLingua beats all baselines at all compression ratios tested.

## Implementation details worth stealing

- **Perplexity as importance proxy**: low perplexity = redundant; high perplexity = informative. Simple and cheap to compute with any small LM.
- **Coarse-before-fine**: segment-level budget allocation before token-level removal prevents waste and provides a natural knob for compression ratio control.
- **Iterative removal preserves order**: final compressed prompt is the original tokens in original order (no reordering), which preserves positional cues for the target LLM.
- **Compression ratio as a tunable parameter**: the budget controller makes it easy to trade accuracy for latency/cost at a single dial.
- **Small LM is sufficient**: LLaMA-7B compressor works well; the target LLM does not need to be involved in compression.

## Open questions / risks / missing details

- **Latency of compression itself**: iterative token-level removal is O(n²) in tokens. Wall-clock overhead of compression is not clearly reported; may not be cheap at 32K+ tokens.
- **Instruction-tuning data**: how much data, what distribution? Not fully detailed in abstract; may be hard to reproduce without released dataset.
- **LLMLingua-2** (arxiv:2403.12968) supersedes this on several benchmarks — evaluate together, not in isolation.
- **Sensitivity to compressor LM choice**: results use LLaMA-7B; performance with other small LMs (Phi, Mistral) is unknown.
- **No evaluation on structured prompts**: code, tool-use, or function-call prompts are not covered; token removal may corrupt syntax.
- **Claims are self-reported** at submission time; subsequent community replication is not reviewed here.
