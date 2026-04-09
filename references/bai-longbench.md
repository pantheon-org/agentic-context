---
title: "LongBench: A Bilingual, Multitask Benchmark for Long Context Understanding"
author: "Bai et al."
date: 2023-08-28
type: reference
tags: [paper, benchmark, empirical]
source: "https://arxiv.org/abs/2308.14508"
source_alt: "https://arxiv.org/pdf/2308.14508"
version: "arXiv v2 (ACL 2024)"
context: "Foundational long-context benchmark; baseline reference point before HELMET and LongBench v2. Bilingual (EN+ZH) is unusual and useful for multilingual evaluation."
related: [bai-longbench-v2.md]
---

## TL;DR

- Introduces **LongBench**, the **first bilingual (EN+ZH) multi-task benchmark** for long-context understanding.
- Covers **21 datasets across 6 task categories**: single-doc QA, multi-doc QA, summarization, few-shot learning, synthetic tasks, and code completion.
- Average length: **6,711 words** (English), **13,386 characters** (Chinese).
- Evaluates **8 LLMs** and reveals that commercial models (GPT-3.5-Turbo-16k) outperform open-source but still struggle on longer contexts.
- Finds that **scaled position embedding and longer-sequence fine-tuning** substantially improve long-context performance.
- Finds that **retrieval-based compression** improves performance on relevant tasks.
- Published at ACL 2024; dataset at https://github.com/THUDM/LongBench.

## What's novel / different

At submission time (Aug 2023), no existing benchmark covered long-context understanding in a bilingual, multi-task, standardised way. NIAH tests were synthetic; existing QA/summarization benchmarks used short contexts. LongBench was the first to unify 21 real-world datasets into a single evaluation suite with automated scoring and bilingual coverage, making it a de facto standard for the 2023–2024 era.

## Mechanism overview

### Problem / motivation

LLMs had recently extended context windows (GPT-3.5-Turbo-16k, Claude 100K) but no rigorous benchmark existed to measure whether longer contexts actually improved understanding on real downstream tasks. Researchers had no agreed-upon way to compare long-context capabilities.

### Core approach

- **6 categories**: single-doc QA, multi-doc QA, summarization, few-shot learning, synthetic tasks, code completion.
- **21 datasets**: sourced from existing NLP benchmarks and real-world documents, reformatted into a unified schema.
- **Bilingual**: parallel English and Chinese subsets; Chinese uses character count rather than word count.
- **Automatic evaluation**: standardised metrics (F1, ROUGE, accuracy) for all datasets.

### Key design decisions

- **Unified format**: all datasets normalized to the same input/output schema to enable cross-dataset comparison.
- **Real documents**: datasets use actual books, reports, codebases — not synthetic haystacks.
- **Average not max**: average length (6.7K EN) is moderate by 2024 standards; tests mid-range context, not extreme limits.

## Evaluation (as reported)

| Finding | Detail |
|---|---|
| Best model | GPT-3.5-Turbo-16k outperforms all open-source models (as reported) |
| Open-source best | Models with scaled position embedding + long-sequence fine-tuning perform best (as reported) |
| Retrieval | Context compression via retrieval improves performance on applicable tasks (as reported) |
| Overall | All tested models struggle as context length increases; no model maintains near-full performance across all tasks (as reported) |

Specific per-model, per-dataset numbers in paper tables.

## Implementation details worth stealing

- **Unified schema**: normalising heterogeneous datasets into one format dramatically reduces evaluation boilerplate — reuse this pattern for custom eval suites.
- **Bilingual split**: evaluating separately in EN and ZH exposes language-specific degradation; useful for multilingual model comparisons.
- **6-category taxonomy**: the category breakdown (single-doc, multi-doc, summarization, few-shot, synthetic, code) is a reusable mental model for long-context task design.

## Open questions / risks / missing details

- **Average length is short**: 6.7K EN average is now well within standard model context windows (as of 2025); the benchmark may not challenge frontier models.
- **Superseded by LongBench v2**: v2 (arxiv:2412.15204) introduces harder reasoning tasks with 8K–2M contexts; evaluate both together for historical comparison.
- **Metric reliability**: automatic metrics (F1, ROUGE) for summarization are notoriously noisy; no model-based evaluation.
- **Synthetic tasks**: includes synthetic position-retrieval tasks alongside real tasks — not clearly separated in some analyses.
- **8 models only**: original evaluation is narrow by 2025 standards; community has since published larger model comparisons using this benchmark.
