---
slug: "lum1104-understand-anything"
title: "Benchmark repro guide — lum1104-understand-anything"
source: "https://github.com/Lum1104/Understand-Anything"
local_clone: "../../tools/lum1104-understand-anything"
harness_present: false
harness_path: null
outcome: "stub — no harness found"
updated: 2026-04-13
---

# Benchmark Repro Guide: lum1104-understand-anything

This document records the state of the benchmark harness for Understand-Anything as found in the vendored source at `tools/lum1104-understand-anything/`.

---

## Harness status

**No benchmark harness exists in the vendored source.**

The `understand-anything-plugin/src/tests/` directory contains four unit test files (`context-builder.test.ts`, `diff-analyzer.test.ts`, `explain-builder.test.ts`, `onboard-builder.test.ts`) that exercise skill-builder utility functions with synthetic fixtures. These are not benchmarks — they validate output structure and do not measure token consumption, latency, or pipeline throughput.

The `scripts/generate-large-graph.mjs` script generates a synthetic 3,000-node graph for dashboard rendering load tests. The project's own `CLAUDE.md` explicitly marks this as "not part of the production pipeline."

No script in the repository measures or compares token consumption, indexing time, or comprehension outcomes.

---

## Claimed benchmark figures (as reported)

No quantitative benchmark figures are claimed anywhere in the project. The README, CONTRIBUTING.md, and all skill definition files are explicit that the tool's value proposition is **developer comprehension and onboarding, not token reduction**. The following qualitative properties are claimed:

| Claim | Source |
|---|---|
| Incremental updates (only changed files re-analyzed) | README.md |
| Parallel file analysis (up to 5 concurrent agents, 20–30 files/batch) | Skill SKILL.md |
| Multi-platform: Claude Code, Cursor, Codex, Gemini CLI, VS Code + Copilot, OpenCode, Antigravity, Pi Agent, OpenClaw (10 platforms) | README.md compatibility table |
| 8,081 GitHub stars | README.md / GitHub |

The incremental update mechanism is **verified from source**: `staleness.ts` implements `getChangedFiles()` via `git diff <lastCommitHash>..HEAD --name-only` and per-file content fingerprinting (`fingerprints.json`). No latency or throughput figures accompany this claim.

---

## Why there is no benchmark

The tool is a developer comprehension dashboard. Its outputs — interactive knowledge graph, guided tours, domain ontology, persona-adaptive UI — are qualitative. There is no scalar metric (token reduction, time saved, error rate) that the project attempts to quantify, and no gold-standard corpus against which comprehension quality could be measured.

The only numeric constraint in the pipeline is the `>100 files` gate in the SKILL.md, which prompts user confirmation before proceeding — an implicit acknowledgment that large codebases incur significant LLM API cost.

---

## What a benchmark would require

To assess the tool's stated goal of reducing developer onboarding time, a benchmark would need:

1. A study cohort of developers working on an unfamiliar codebase, split into control (unassisted) and treatment (Understand-Anything dashboard) groups.
2. Task completion time and error rate for a set of navigation/comprehension tasks.
3. LLM API cost per full analysis run, measured at batch granularity.
4. Incremental rebuild cost after a representative set of commits.

None of these exist. The tool has no equivalent to a token-savings harness.

---

## Running the unit tests

```shell
cd tools/lum1104-understand-anything/understand-anything-plugin
pnpm install
pnpm --filter "@understand-anything/skill" run test
```

Expected output: vitest run of 4 test files (context-builder, diff-analyzer, explain-builder, onboard-builder). All tests operate on synthetic in-memory fixtures. No LSP, no LLM API calls, no graph build.

## Running the dashboard rendering test

```shell
cd tools/lum1104-understand-anything
node scripts/generate-large-graph.mjs
# Generates a 3,000-node synthetic knowledge-graph.json
# Open understand-anything-plugin/packages/dashboard with a local dev server to inspect rendering
```

This does not exercise the analysis pipeline.
