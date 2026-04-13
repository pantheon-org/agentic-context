---
slug: "oraios-serena"
title: "Benchmark repro guide — oraios-serena"
source: "https://github.com/oraios/serena"
local_clone: "../../tools/oraios-serena"
harness_present: false
harness_path: null
outcome: "stub — no harness found"
updated: 2026-04-13
---

# Benchmark Repro Guide: oraios-serena

This document records the state of the benchmark harness for Serena as found in the vendored source at `tools/oraios-serena/`.

---

## Harness status

**No token-reduction benchmark harness exists in the vendored source.**

The test suite at `tools/oraios-serena/test/serena/` is a functional integration test suite (pytest, 15 test modules), not a benchmark harness. It tests correct tool invocation, symbol retrieval, editing, LSP lifecycle, and MCP protocol conformance — not token consumption or efficiency.

The `tools/oraios-serena/scripts/profile_tool_call.py` script is a cProfile / pyinstrument latency profiler for a single `FindSymbolTool` call. It measures wall-clock time, not token counts, and requires a running language server pointed at the Serena repo itself.

No script in the repository computes or compares token consumption between Serena's LSP-backed retrieval and any baseline (file reads, grep, etc.).

---

## Claimed benchmark figures (as reported)

All figures below are from `README.md`. None have been independently reproduced.

| Metric | Claimed value | Source |
|---|---|---|
| "Operates faster, more efficiently and more reliably, especially in larger and more complex codebases" | Qualitative | README.md |
| Supported programming languages | "over 40" (55 language-server modules verified) | README.md / source |
| GitHub stars at time of analysis | 22,736 | GitHub API, 2026-04-10 |

No quantitative token-reduction figures are claimed anywhere in the README, CHANGELOG, or documentation. The efficiency claim is qualitative and architectural: LSP symbol-path retrieval returns structured compact JSON versus reading whole source files.

---

## Architectural basis for efficiency (not measured)

The analysis (`analysis/ANALYSIS-oraios-serena.md`) documents why savings are plausible without being measured:

- A `get_symbols_overview` call returns a file outline in a few hundred bytes; reading the same file returns the full source.
- Symbol-path identity (`MyClass/my_method`) is stable across edits, so an agent need not re-fetch location after making other changes.
- Progressive fallback closures (`_limit_length` + `shortened_result_factories`) bound tool output to `max_answer_chars` (default 150 k) before returning to context.
- Per-call token usage is recorded via `analytics.py` (char-based, tiktoken, or Anthropic API estimator) and visible in the Flask web dashboard.

These architectural properties are verified from source but no benchmark script compares them against a baseline.

---

## How to run the functional test suite

The integration tests are not a benchmark but can confirm correct tool behaviour:

```shell
cd tools/oraios-serena
uv sync --dev
uv run pytest test/serena/ -x -q
```

Requirements: Python 3.11–3.14, `uv`, a running LSP server appropriate to the test project, and (for some tests) a running Serena MCP server.

## How to run the latency profiler

The `scripts/profile_tool_call.py` script profiles a single `FindSymbolTool` call against the Serena repo itself:

```shell
cd tools/oraios-serena
uv run python scripts/profile_tool_call.py
# Produces a cProfile .prof file or pyinstrument console output
```

Switch the `profiler` variable in the script between `"cprofile"` and `"pyinstrument"` for different output formats.

---

## What a benchmark would require

To produce reproducible token-reduction figures, a harness would need to:

1. Define a set of code navigation questions (e.g. "find all callers of the `SerenaAgent` constructor").
2. Measure tokens consumed answering each question via Serena (LSP tool calls).
3. Measure tokens consumed answering the same questions via a baseline (e.g. `grep -r` + file reads, or a language-agnostic `read_file` approach).
4. Report the ratio on the same questions and corpus.

No such harness exists. If the Serena `analytics.py` recording were enabled and a structured QA session were run, the output log could be post-processed to approximate step 2. Step 3 would need to be constructed from scratch.
