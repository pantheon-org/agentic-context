---
title: "LongBench v2: Towards Deeper Understanding and Reasoning on Realistic Long-context Multitasks"
author: "Bai et al."
date: 2024-12-19
type: reference
tags: [paper, benchmark, empirical]
source: "https://arxiv.org/abs/2412.15204"
source_alt: "https://arxiv.org/pdf/2412.15204"
version: "arXiv v2 (ACL 2025)"
context: "Harder successor to LongBench v1; pushes to 2M-word contexts and MCQ format with human expert baseline; useful for evaluating frontier models on extreme long-context reasoning."
related: [bai-longbench.md]
---

## TL;DR

- Introduces **LongBench v2**, a harder successor to LongBench v1, designed to require **deep understanding and reasoning** rather than surface retrieval.
- **503 challenging multiple-choice questions** across 6 task categories, with contexts from **8K to 2M words**.
- Human experts achieve only **53.7% accuracy** under a 15-minute time constraint — establishing a meaningful human baseline.
- Best direct-answer model achieves only **50.1%** accuracy — **below** the human baseline (as reported).
- **o1-preview** (chain-of-thought reasoning + longer inference) achieves **57.7%**, surpassing humans by 4% — highlighting the value of inference-time reasoning (as reported).
- Published at ACL 2025; project at https://longbench2.github.io.

## What's novel / different

LongBench v1 (and most long-context benchmarks) can be solved by retrieving a short span from a long document. LongBench v2 is explicitly designed to require full-context reasoning: questions cannot be answered by retrieving a single passage. The MCQ format with human expert annotation and a timed human baseline makes it the most rigorously validated long-context benchmark at time of publication. The 2M-word upper bound also far exceeds HELMET's 128K ceiling, pushing into the territory relevant to frontier models with million-token windows.

## Mechanism overview

### Problem / motivation

Existing long-context benchmarks are increasingly saturated or can be solved by retrieval alone. Models with large context windows may "pass" these tests without genuine long-context reasoning. A harder benchmark is needed that forces full-context synthesis and rewards inference-time reasoning.

### Core approach

- **6 task categories**: single-document QA, multi-document QA, long in-context learning, long-dialogue history understanding, code repository understanding, long structured data understanding.
- **503 MCQs**: multiple-choice format eliminates metric noise (no F1/ROUGE; correct or not).
- **Human-sourced and validated**: collected from ~100 highly-educated contributors with diverse professional backgrounds; both automated and manual review.
- **Contexts 8K–2M words**: spans the full range of current frontier model context windows.
- **Timed human baseline**: experts given 15 minutes per question to establish a realistic, not unlimited, human upper bound.

### Key design decisions

- **MCQ format**: removes metric ambiguity; enables clean accuracy comparison.
- **Difficulty by design**: questions validated to be unsolvable by short-span retrieval.
- **Human expert ground truth**: annotation by domain experts ensures question quality.
- **o1-style reasoning gap**: the 7.6-point gap between direct models and o1-preview quantifies the value of extended reasoning on long-context tasks.

## Evaluation (as reported)

| Model / Setting | Accuracy | Notes |
|---|---|---|
| Human experts (15 min) | 53.7% | Timed baseline (as reported) |
| Best direct-answer model | 50.1% | Below human baseline (as reported) |
| o1-preview (chain-of-thought) | 57.7% | +4% above human baseline (as reported) |

Context range: 8K–2M words. Specific per-model, per-category breakdowns in paper tables.

## Implementation details worth stealing

- **MCQ for long-context eval**: eliminates metric noise from F1/ROUGE; adopt this format for internal evaluation of long-context tools.
- **Timed human baseline**: a 15-minute cap on human annotation gives a realistic, not idealised, human upper bound — use this design for custom benchmarks.
- **Category: code repository understanding**: this category is particularly relevant for coding agent evaluation; worth extracting for targeted use.
- **o1 gap as reasoning signal**: the ~7.6% gap between direct and chain-of-thought answers is a reproducible signal for how much inference-time reasoning helps on long-context tasks.

## Open questions / risks / missing details

- **503 questions is small**: statistical power is limited; per-category breakdowns with ~80 questions each have wide confidence intervals.
- **MCQ format may not reflect all use cases**: open-ended generation (summarization, code writing) is not covered.
- **2M-word contexts**: very few models can currently handle 2M words; the upper end may not be practically testable for most teams.
- **Human baseline is timed**: 53.7% under time pressure may understate human ceiling; untimed performance likely higher.
- **Benchmark contamination risk**: as v2 becomes widely known, models may be fine-tuned on similar MCQ patterns.
- **Subset overlap with v1**: not all v1 task types are represented; cross-version comparison is not straightforward.
