---
slug: "juliusbrussee-caveman"
title: "juliusbrussee-caveman — Benchmark Reproduction"
source: "https://github.com/JuliusBrussee/caveman"
local_clone: "../../tools/juliusbrussee-caveman"
harness_present: true
harness_path: "benchmarks/run.py"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# juliusbrussee-caveman — Benchmark Reproduction

**Source**: `https://github.com/JuliusBrussee/caveman`
**Date**: 2026-04-10
**Updated**: 2026-04-13 (source-verified review; compress scripts now fully documented)
**Environment**: macOS Darwin 25.4.0
**Outcome**: not run (API key required for benchmarks/run.py); eval snapshot offline analysis
completed via character-proxy; full tiktoken run not executed

---

## Harness locations

Two distinct harnesses exist in the repo (verified from source):

```text
benchmarks/run.py               # Anthropic API benchmark: normal vs caveman, token counts
benchmarks/prompts.json         # 10 fixed prompts (developer tasks)
benchmarks/requirements.txt     # anthropic SDK
benchmarks/results/             # .gitkeep only — results not committed

evals/llm_run.py                # Three-arm eval generator: calls claude CLI
evals/measure.py                # Offline measurement via tiktoken (no API key needed)
evals/prompts/en.txt            # 10 prompts (different set from benchmarks/prompts.json)
evals/snapshots/results.json    # Committed snapshot, generated 2026-04-08
```

The benchmark harness (`benchmarks/`) and eval harness (`evals/`) use different prompt sets.
`benchmarks/prompts.json` has 10 developer tasks structured as JSON with IDs, categories,
and prompt text. `evals/prompts/en.txt` has 10 developer questions as plain text, one per
line (both sets verified from source).

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
- `terse` — `"Answer concisely."`
- skill arms — `"Answer concisely.\n\n{SKILL.md}"` (one arm per `skills/<name>/SKILL.md`)

The honest skill delta is `skill vs terse`, not `skill vs baseline`. This isolates the
skill's contribution from generic terseness. `llm_run.py` auto-discovers all skill
directories under `skills/`.

Snapshot committed to `evals/snapshots/results.json`:

- Generated: 2026-04-08T22:01:24Z
- Model: `claude-opus-4-6`
- CLI version: `2.1.97 (Claude Code)`
- Prompts: 10 (from `evals/prompts/en.txt`)
- Runs per arm: 1 (single run)
- Arms: `baseline`, `terse`, `caveman`, `caveman-cn`, `caveman-es`, `compress`

### Snapshot contents (verified from source)

The 10 prompts in the committed snapshot:

1. Why does my React component re-render every time the parent updates?
2. Explain database connection pooling.
3. What's the difference between TCP and UDP?
4. How do I fix a memory leak in a long-running Node.js process?
5. What does the SQL EXPLAIN command tell me?
6. How does a hash table handle collisions?
7. Why am I getting CORS errors in my browser console?
8. What's the point of using a debouncer on a search input?
9. How does git rebase differ from git merge?
10. When should I use a queue vs a topic in messaging systems?

### Offline analysis — character-proxy results

Character-count proxy analysis of the committed snapshot (run 2026-04-13, without tiktoken).
Character length correlates with token count; ratios are directionally consistent but will
differ from tiktoken output:

| Metric | caveman vs terse | caveman vs baseline |
|--------|----------------:|-------------------:|
| Median | ~53% | ~49% |
| Mean | ~50% | ~49% |
| Min | ~-2% | ~+10% |
| Max | ~89% | ~87% |
| Stdev | ~24% | — |

Notable per-prompt results: database connection pooling shows ~89% reduction (terse arm
response was longest at 1405 chars; caveman 156 chars). Node.js memory leak shows ~-2%
(caveman response slightly longer than terse — high-variance prompt). TCP/UDP shows ~37%
reduction.

The `caveman-cn` arm (Chinese variant) shows ~78% char-proxy reduction vs terse (min 54%,
max 97%).

### How to reproduce (offline — no API key)

```sh
# Using the vendored clone:
cd tools/juliusbrussee-caveman
uv run --with tiktoken python evals/measure.py
```

This reads the committed snapshot and prints per-skill savings (median/mean/min/max/stdev)
using tiktoken `o200k_base`. Requires `uv` on PATH.

Alternatively, from a fresh clone:

```sh
git clone https://github.com/JuliusBrussee/caveman
cd caveman
uv run --with tiktoken python evals/measure.py
```

### How to regenerate the snapshot (requires claude CLI logged in)

```sh
uv run python evals/llm_run.py

# Cheaper model variant:
CAVEMAN_EVAL_MODEL=claude-haiku-4-5 uv run python evals/llm_run.py
```

Regeneration calls `claude -p --system-prompt ...` once per (prompt × arm). On 4 skill arms plus 2 control arms × 10 prompts = 60 claude CLI invocations. Writes output to `evals/snapshots/results.json`.

### Known approximation

tiktoken `o200k_base` is OpenAI's BPE tokenizer. Claude uses a different tokenizer. Ratios
between arms are directionally correct; absolute token counts are approximate.

### Evals status

Snapshot exists and is committed (verified from source). Offline measurement via
`evals/measure.py` is runnable without an API key. Single run per arm — not a statistically
powered experiment. No fidelity / accuracy evaluation exists for any arm.

---

## Compress sub-tool — reported savings

The README compress table reports 35%–60% savings on five prose memory files. The test
fixture files (both original and compressed versions) are committed in
`tests/caveman-compress/` (verified from source — five `.md` / `.original.md` pairs).

### Fixture files present (verified from source)

| File | Status |
|------|--------|
| `tests/caveman-compress/claude-md-preferences.md` | present |
| `tests/caveman-compress/claude-md-preferences.original.md` | present |
| `tests/caveman-compress/project-notes.md` | present |
| `tests/caveman-compress/project-notes.original.md` | present |
| `tests/caveman-compress/claude-md-project.md` | present |
| `tests/caveman-compress/claude-md-project.original.md` | present |
| `tests/caveman-compress/todo-list.md` | present |
| `tests/caveman-compress/todo-list.original.md` | present |
| `tests/caveman-compress/mixed-with-code.md` | present |
| `tests/caveman-compress/mixed-with-code.original.md` | present |

### How to reproduce compress savings

To verify the README figures, run tiktoken `o200k_base` against each `.original.md` vs
the compressed `.md` file:

```python
import tiktoken
from pathlib import Path

enc = tiktoken.get_encoding("o200k_base")
fixtures = Path("tests/caveman-compress")
for orig in fixtures.glob("*.original.md"):
    stem = orig.stem.replace(".original", "")
    comp = fixtures / f"{stem}.md"
    if comp.exists():
        orig_toks = len(enc.encode(orig.read_text()))
        comp_toks = len(enc.encode(comp.read_text()))
        saved = 1 - comp_toks / orig_toks
        print(f"{stem}: {orig_toks} -> {comp_toks} ({saved:.1%})")
```

Run from the repo root: `uv run --with tiktoken python <above_script>`. No API key required.

### Compress script implementation (verified from source)

The compress pipeline is fully inspectable. All five Python modules are present in
`caveman-compress/scripts/`:

- `compress.py` — orchestrator; calls detect → compress → validate → retry → restore
- `detect.py` — file-type classifier (extension table + JSON/YAML/code-line heuristics)
- `validate.py` — structural validator (headings, code blocks exact, URLs exact, paths,
  bullets within 15%)
- `cli.py` — argument parsing
- `main.py` — entry point

The backup-overwrite guard is implemented: if `<file>.original.md` already exists, the
script aborts rather than overwriting (verified from source, `compress.py` line ~135).

Model used: `claude-sonnet-4-5` (overridable via `CAVEMAN_MODEL` env var). API key path:
`ANTHROPIC_API_KEY` env var → Anthropic SDK; fallback to `claude --print` CLI.

### Reproduce compress on a live file

```sh
cd tools/juliusbrussee-caveman
export ANTHROPIC_API_KEY=<your-key>
# Compress a file (backs up original to FILE.original.md):
cd caveman-compress && python3 -m scripts /path/to/your/CLAUDE.md
```

Note: the script aborts if `CLAUDE.original.md` already exists. Remove or rename it to
re-run.
