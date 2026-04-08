---
title: "caveman"
author: "JuliusBrussee"
date: 2026-04-08
type: reference
tags: [tool, cli, skill]
source: "https://github.com/JuliusBrussee/caveman"
version: "commit 9ee0e35 (2026-04-08)"
context: "Output-token compression via prompt-level style forcing; borderline for context-management research but directly relevant to token-budget strategy."
---

## TL;DR

- Claude Code skill (and multi-agent plugin) that instructs the model to respond in minimal caveman-style prose, stripping articles, filler, and verbose phrasing.
- Claims ~65% reduction in output tokens (as reported, README benchmark table).
- Companion `/caveman:compress` command rewrites `CLAUDE.md` and similar memory files into caveman-speak, claiming ~45% reduction in per-session input tokens (as reported, README).
- Three selectable intensity levels: Lite (drop filler, keep grammar), Full (default caveman fragments), Ultra (telegraphic, abbreviate everything).
- Installed as a skill file via `npx skills add JuliusBrussee/caveman`; supports Claude Code, Cursor, Windsurf, Copilot, Cline, Codex, and 40+ agents.
- 7 k+ GitHub stars four days after creation (2026-04-04); viral traction via meme framing.
- Benchmark methodology is reproducible: `benchmarks/run.py` calls the Anthropic API with and without the skill system prompt at `temperature=0` on a fixed prompt set.

## What's novel / different

Most context-compression work targets memory retrieval, chunking, or eviction policies — structural decisions made before the model sees tokens. Caveman operates purely at the style layer: it injects a system-prompt constraint that forces the model to suppress verbose output without altering what it knows or retrieves. This makes it complementary to (not competing with) tiered-loading or RAG approaches. The compress sub-tool applies the same style forcing to persistent memory files, converting them once and keeping a human-readable `.original.md` backup — a simple write-once pattern that amortises input-token cost across every session that loads that file.

## Architecture overview

### Core design

Two distinct modes packaged in one skill file:

1. **caveman mode** — a system-prompt skill (`SKILL.md`) that, when activated with `/caveman`, tells the model to respond in stripped-down prose. Intensity variants (lite / full / ultra) are triggered by suffixing the slash command. The constraint persists for the session until explicitly reset.
2. **caveman:compress** — a sub-skill that reads a target file (e.g. `CLAUDE.md`), rewrites it in caveman-speak via Claude, writes the compressed version in place, and saves the original to `<file>.original.md`.

The skill file is distributed as a zip archive (`caveman.skill`), which the installer unpacks into the agent's skill directory. Symlinks are used internally; Windows requires `core.symlinks true`.

### Interface / API

- Activation: `/caveman` (full), `/caveman lite`, `/caveman ultra`, `$caveman` (Codex variant).
- Compression: `/caveman:compress <filepath>`.
- Install: `npx skills add JuliusBrussee/caveman` or `claude plugin marketplace add JuliusBrussee/caveman`.
- No runtime API beyond the agent's native skill/plugin protocol.

### Dependencies

- Node.js (`npx`) for installation tooling.
- Python 3 + `anthropic` SDK for running benchmarks (`benchmarks/run.py`).
- No server-side component; runs entirely within the agent session.

### Scope / limitations

- Compression quality is entirely model-dependent; there is no parser or linter enforcing the output style — the model may drift from caveman-speak on complex outputs.
- Intensity level resets at session end.
- Benchmark results directory is empty in the repo (`.gitkeep` only); numbers in README are self-reported from runs not committed as artefacts.
- No evaluation of task accuracy degradation under Ultra compression.
- Chinese-language variant (`caveman-cn`) merged but no benchmark parity data available.

## Deployment model

- **Runtime**: in-agent (no separate process).
- **Language**: skill prompt is plain text / Markdown; installer tooling is Node.js; benchmarks are Python 3.
- **Dependencies**: none at runtime; `anthropic` Python SDK for benchmark reproduction.
- **Storage**: writes `CLAUDE.md` (compressed) and `CLAUDE.original.md` (backup) on disk when compress is used; no other persistent state.

## Benchmarks / self-reported metrics

From the README benchmark table (as reported):

| Mode | What it compresses | Claimed saving |
|---|---|---|
| caveman (output) | Claude's responses | ~65% output tokens |
| caveman:compress (input) | Memory files loaded per session | ~45% input tokens |

- Benchmark script (`benchmarks/run.py`) uses `temperature=0`, fixed prompt set (`benchmarks/prompts.json`), calls Anthropic API with and without caveman system prompt.
- No committed result artefacts in the repository; numeric claims cannot be independently verified from the repo alone (as reported).
- Before/After example (README): normal answer 69 tokens → caveman full 19 tokens → caveman ultra single-phrase. Illustrative only; not a controlled sample (as reported).

## Open questions / risks / missing details

- **Benchmark artefacts absent**: `benchmarks/results/` contains only `.gitkeep`; the 65% / 45% figures cannot be reproduced without running the script against a live API key.
- **Accuracy degradation unmeasured**: no evaluation of whether Ultra compression causes the model to omit correct steps or introduce errors.
- **Style drift**: no mechanism to enforce the style constraint beyond the initial prompt; long sessions may see the model revert.
- **Multi-turn coherence**: unclear how the skill interacts with tool-use turns and structured outputs (JSON mode, function calls).
- **Input compression permanence risk**: the compress sub-tool overwrites the original file in place (backup is `.original.md`); a git-untracked `CLAUDE.md` could be permanently altered if the backup step fails.
- **Viral framing vs. rigour**: the repo's meme positioning may attract inflated star counts that do not reflect production adoption.
