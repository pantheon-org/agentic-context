---
title: "Recursive Language Models"
author: "Zhang et al."
date: 2025-12-31
type: reference
tags: [paper, empirical, system]
source: "https://arxiv.org/abs/2512.24601"
source_alt: "https://arxiv.org/pdf/2512.24601"
version: "arXiv v2"
context: "Inference-time approach to processing inputs 100× beyond context window via recursive self-calls; directly relevant to long-context management research."
related: []
---

## TL;DR

- Proposes **Recursive Language Models (RLMs)**, an inference paradigm in which an LLM treats its long input as an external environment and recursively calls itself over sub-prompts.
- Enables processing of inputs **up to two orders of magnitude beyond** the model's native context window at inference time.
- On shorter prompts, RLMs still **outperform vanilla frontier LLMs** and common long-context scaffolds across four diverse tasks at comparable cost.
- Post-trains **RLM-Qwen3-8B**, the first natively recursive LM, which outperforms Qwen3-8B by **28.3% on average** and approaches vanilla GPT-5 quality on three long-context tasks (as reported).
- Code available at https://github.com/alexzhang13/rlm.

## What's novel / different

Prior long-context approaches either extend the context window (positional encoding tricks, sliding window) or use retrieval/summarization scaffolds external to the model. RLMs are distinct in that the LLM itself is the agent: it programmatically decomposes the long input, decides which snippets to recurse into, and aggregates results — all through its own generation. This is an inference-time scaling approach rather than a training-time extension, meaning it applies to any LLM without modification. Post-training a natively recursive model (RLM-Qwen3-8B) closes the gap further.

## Mechanism overview

### Problem / motivation

LLMs have fixed context windows (typically 8K–128K tokens). Real-world documents, codebases, and multi-document tasks routinely exceed these limits. Retrieval augmentation truncates or drops content; full-context extensions are expensive to train and still have hard limits.

### Core approach

- The LLM receives a **meta-prompt** instructing it to treat the input as an external environment.
- It generates a **program**: a sequence of recursive self-calls over sub-prompts (snippets of the input).
- Each recursive call returns a partial result; the LLM aggregates across calls to produce a final answer.
- This creates a tree of LLM calls where depth corresponds to input complexity.

### Key design decisions

- **No external retriever**: the LLM decides which sub-prompts to examine, not a separate retrieval module.
- **Inference-time only** (base version): no fine-tuning required; applies to any instruction-tuned LLM.
- **Post-training variant**: RLM-Qwen3-8B is fine-tuned to natively produce recursive programs, improving quality and reducing scaffolding overhead.
- **Cost parity**: claims comparable cost to standard inference despite multiple recursive calls (sub-prompts are smaller and cheaper individually).

## Evaluation (as reported)

| Setting | Benchmark/Task | Metric | Result |
|---|---|---|---|
| RLMs vs vanilla GPT-4o | 4 long-context tasks (unspecified in abstract) | Quality score | RLMs outperform (as reported, abstract) |
| RLMs vs common scaffolds | 4 long-context tasks | Quality score | RLMs outperform at comparable cost (as reported, abstract) |
| RLM-Qwen3-8B vs Qwen3-8B | 4 long-context tasks | Accuracy | +28.3% average (as reported, abstract) |
| RLM-Qwen3-8B vs GPT-5 | 3 long-context tasks | Quality | Approaches GPT-5 quality (as reported, abstract) |
| Input length | — | Max tokens | 100× beyond context window (as reported) |

Note: specific benchmark names and per-task breakdowns are in the full paper (9 pages + 33-page appendix); abstract does not enumerate them.

## Implementation details worth stealing

- **Recursive self-call pattern**: treating LLM generation as a program over its own context is a generalizable scaffold — applicable to any sufficiently instruction-tuned model.
- **Post-training for recursion**: fine-tuning on recursive programs significantly improves native performance over prompting alone; the training signal is the program structure, not just the final answer.
- **Snippet decomposition**: the LLM's own decomposition strategy may outperform fixed-window chunking by focusing on semantically meaningful boundaries.

## Open questions / risks / missing details

- **Benchmark specifics**: abstract does not name the 4 tasks; reproducibility depends on the full paper and released code.
- **Latency**: multiple recursive calls multiply wall-clock time; "comparable cost" likely refers to token cost, not latency.
- **Decomposition quality**: if the LLM produces a poor decomposition, errors cascade through the recursion tree; no mention of error recovery.
- **Context window still bounded at leaf level**: individual recursive calls still operate within the base context window; very dense documents may require deep recursion.
- **RLM-Qwen3-8B training data**: not detailed in abstract; may not be publicly released.
- **Preprint only** as of triage date; not yet peer-reviewed.
