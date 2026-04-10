# juliusbrussee-caveman — Benchmark Reproduction

**Source**: `https://github.com/JuliusBrussee/caveman`
**Date**: 2026-04-10
**Environment**: macOS Darwin 25.4.0
**Outcome**: not run — API key required for benchmarks/run.py; eval snapshot verified offline

---

## Harness locations

Two distinct harnesses exist in the repo (verified from source):

```text
benchmarks/run.py          # Anthropic API benchmark: normal vs caveman, token counts
benchmarks/prompts.json    # 10 fixed prompts used by run.py
benchmarks/requirements.txt

evals/llm_run.py           # Three-arm eval: baseline / terse / skill via claude CLI
evals/measure.py           # Offline measurement via tiktoken (no API key needed)
evals/snapshots/results.json  # Committed snapshot, generated 2026-04-08
```

---

## Harness 1: benchmarks/run.py

### Methodology

Calls the Anthropic API directly with `temperature=0`, 3 trials per prompt per mode
(normal vs caveman), reports median output tokens. Model default: `claude-sonnet-4-20250514`.
Prompts are 10 fixed developer tasks (debugging, bugfix, setup, explanation, refactor,
architecture, code-review, devops). The script also supports `--update-readme` to inject
results into the README benchmark table.

### How to reproduce

```sh
git clone https://github.com/JuliusBrussee/caveman
cd caveman
pip install -r benchmarks/requirements.txt
export ANTHROPIC_API_KEY=<your-key>
python benchmarks/run.py
```

Optional flags:

```sh
python benchmarks/run.py --dry-run                  # Preview config, no API calls
python benchmarks/run.py --trials 1                 # Single trial (faster/cheaper)
python benchmarks/run.py --model claude-haiku-4-5   # Cheaper model
python benchmarks/run.py --update-readme            # Write results into README.md
```

### Status

Not run. Results directory (`benchmarks/results/`) contains only `.gitkeep` — no committed
artefacts. The 65% headline figure from the README cannot be verified without an API key.

---

## Harness 2: evals/ (three-arm, offline-measurable)

### Evals methodology

Three-arm design (verified from source):

- `baseline` — no system prompt
- `terse` — "Answer concisely."
- `caveman` — "Answer concisely.\n\n{caveman/SKILL.md}"

The honest skill delta is `caveman vs terse`, not `caveman vs baseline`. This isolates the
skill's contribution from generic terseness. Snapshot committed to
`evals/snapshots/results.json`. Generated 2026-04-08, `claude-opus-4-6`,
Claude Code CLI v2.1.97, 10 prompts, single run per arm.

### How to reproduce (offline — no API key)

```sh
git clone https://github.com/JuliusBrussee/caveman
cd caveman
uv run --with tiktoken python evals/measure.py
```

This reads the committed snapshot and prints per-skill savings (median/mean/min/max/stdev)
using tiktoken `o200k_base` as the tokenizer.

### How to regenerate the snapshot (requires claude CLI)

```sh
uv run python evals/llm_run.py
# Cheaper model variant:
CAVEMAN_EVAL_MODEL=claude-haiku-4-5 uv run python evals/llm_run.py
```

### Known approximation

tiktoken `o200k_base` is OpenAI's BPE tokenizer. Claude uses a different tokenizer. Ratios
between arms are directionally correct; absolute token counts are approximate.

### Evals status

Snapshot exists and is committed (verified from source). Offline measurement via
`evals/measure.py` is runnable without an API key. Single run per arm — not a powered
experiment. No fidelity / accuracy evaluation exists.

---

## Compress sub-tool — reported savings

The compress table in the README (not reproduced here) reports 35%–60% savings on prose
memory files. The compress Python module (`compress/scripts/`) is not exposed in the public
repo tree via the GitHub contents API; full compress-side implementation requires a direct
clone. Reproduction requires running `/caveman:compress` against a real memory file with a
live Claude session.
