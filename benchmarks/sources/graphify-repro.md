---
slug: "graphify"
title: "Benchmark repro guide — graphify"
source: "https://github.com/safishamsi/graphify"
local_clone: "../../tools/graphify"
harness_present: true
harness_path: "graphify/benchmark.py"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# Benchmark Repro Guide: graphify

This document records the state of the benchmark harness for graphify as found in the vendored source at `tools/graphify/`.

---

## Harness location

```text
tools/graphify/graphify/benchmark.py    # benchmark module (154 lines)
tools/graphify/tests/test_benchmark.py  # pytest unit tests for benchmark module
```

The benchmark module is callable as a library function against any pre-built `graph.json`:

```python
from graphify.benchmark import run_benchmark, print_benchmark
result = run_benchmark("graphify-out/graph.json", corpus_words=123000)
print_benchmark(result)
```

The `tests/test_benchmark.py` file contains 10 pytest tests that exercise the benchmark module with synthetic 5-node graphs, covering token estimation, BFS subgraph expansion, corpus scaling, and error cases.

---

## How the benchmark works

The benchmark module computes a token-reduction estimate using the following methodology:

1. **Corpus tokens** = `corpus_words × 100 // 75` (i.e. words-to-tokens via a 0.75 words/token ratio). `corpus_words` is either passed in explicitly or estimated as `G.number_of_nodes() × 50` if omitted.

2. **Query tokens** = for each sample question (`_SAMPLE_QUESTIONS`, 5 questions), run BFS from the top-3 best-matching nodes (label substring match on question terms), collect the visited subgraph up to depth 3, and estimate tokens as `len(serialised_subgraph) // 4` (chars-to-tokens at 4 chars/token).

3. **Reduction ratio** = `corpus_tokens / avg_query_tokens`.

The 71.5× figure cited in the README and on the project website is **not produced by this module**. It appears in the skill's Step 8, which runs the benchmark inline during a `/graphify` session and prints the result to Claude's context. The Step 8 estimate uses the same `run_benchmark()` function (via `python -c "..."` one-liner), with `corpus_words` drawn from the `detect()` output of the actual corpus under analysis.

---

## How to run the unit tests

```shell
cd tools/graphify
uv venv && uv sync
uv run pytest tests/test_benchmark.py -v
```

All 10 tests use synthetic in-memory graphs — no real corpus, no tree-sitter, no LLM calls. They verify the mathematical properties of the estimation (monotonicity, scaling, error handling) rather than reproducing any published figure.

Expected output: 10 passed in < 1 s.

## How to reproduce the inline benchmark estimate

To reproduce the 71.5× figure, you would need to run the full `/graphify` pipeline on a comparable corpus (3 GPT-family repos + 5 papers + 4 diagrams, as described in the website example) and read the Step 8 console output. No fixture corpus is provided.

A minimal approximation using a pre-built `graph.json` from any real corpus:

```shell
cd tools/graphify
uv run python - <<'EOF'
from graphify.benchmark import run_benchmark, print_benchmark
# Replace with actual corpus_words from detect() output
result = run_benchmark("graphify-out/graph.json", corpus_words=<corpus_words>)
print_benchmark(result)
EOF
```

The `corpus_words` value is reported by the `detect.py` step as part of the `.graphify_detect.json` output.

---

## Environment requirements

| Requirement | Version |
|---|---|
| Python | 3.10–3.12 (Leiden/graspologic requires < 3.13) |
| uv | any recent version |
| Key dependencies | `networkx`, `graspologic` (Leiden), `tree-sitter-*` (AST extraction) |

For the full pipeline (not just unit tests), also required:

- Ollama or API key for LLM semantic extraction (parallel subagents)
- `faster-whisper` for audio/video transcription (optional)
- Git, for incremental update detection

---

## Reported figures (as reported)

The 71.5× reduction figure is from the project website example ("Karpathy mixed corpus").

| Corpus | Files | Naive tokens (est.) | Graph tokens/query (est.) | Reduction |
|---|---|---|---|---|
| Karpathy mixed (3 GPT repos + 5 papers + 4 diagrams) | ~52 | ~123 k | ~1.7 k | **71.5×** (as reported) |

---

## Critical notes on methodology

- The baseline ("read all raw files") is the worst possible retrieval strategy — no tool call optimisation, no focused reads, no RAG. Savings against focused reads or BM25 search would be substantially lower.
- Token counts use a chars/4 heuristic throughout. Actual token counts depend on content type (dense code vs. prose) and model tokeniser.
- The 71.5× figure is from a single self-curated example, not an independent benchmark.
- LLM extraction cost at build time is not included in the denominator. For a 52-file mixed corpus with parallel subagents, this is non-trivial.
- Real-world reduction depends heavily on query specificity. Broad queries ("what does this repo do?") produce large BFS subgraphs and shrink savings; targeted queries ("what calls `train_loop`?") produce small subgraphs and amplify savings.
- The benchmark module cannot verify the figure without a fixture corpus matching the original run; no such corpus is provided in the repository.
