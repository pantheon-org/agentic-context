---
title: "rtk"
author: "rtk-ai"
date: 2026-04-08
type: reference
tags: [tool, cli]
source: "https://github.com/rtk-ai/rtk"
local_clone: ../tools/rtk
version: "v0.28.2"
context: "CLI proxy that compresses command output before it enters LLM context — directly relevant to token budgeting and context noise reduction research."
---

## TL;DR

- Single Rust binary that acts as a transparent proxy between AI coding tools (Claude Code, Cursor, Copilot, etc.) and shell commands.
- Intercepts Bash tool calls via a hook and rewrites `git status` → `rtk git status` transparently; the LLM never sees the rewrite.
- Applies four strategies per command type: smart filtering, grouping, truncation, and deduplication.
- Supports 100+ commands across git, file ops, test runners (pytest, cargo test, go test, npm test), linters, package managers, and Docker.
- Self-reports 60–90% token reduction on dev commands; claims ~80% aggregate reduction in a 30-minute Claude Code session (as reported).
- Zero runtime dependencies; <10 ms overhead per invocation.
- Apache-2.0 license; 20,700 GitHub stars as of 2026-04-08.

## What's novel / different

Most context management tools operate on the injection side — choosing what to load into the context window. `rtk` operates on the output side: it intercepts command output before it reaches the LLM and applies command-specific heuristics to strip noise, group similar lines, and collapse repetition. Because the hook rewrite is transparent, no prompt engineering or agent awareness is required. This distinguishes it from summarization layers (which are LLM-based and add latency) and from token budget enforcement (which discards existing context). `rtk` acts as a lossy compression layer for shell I/O with zero LLM involvement.

## Architecture overview

### Core design

`rtk` is a Rust CLI binary that wraps arbitrary shell commands. It is invoked as `rtk <cmd> [args]`, executes the underlying command, captures stdout/stderr, and applies a per-command filter pipeline before emitting the result. Filters are compiled in; there is no plugin system described in the README.

The hook integration works by prepending `rtk` to Bash commands via a settings hook (e.g., Claude Code's `bashHook` or similar). This is configured once with `rtk init -g`. The hook runs on every Bash tool call; built-in tools (Read, Grep, Glob) bypass it.

Four filtering strategies (as described by the author):

1. **Smart Filtering** — removes comments, blank lines, and boilerplate.
2. **Grouping** — aggregates similar items (files by directory, errors by type).
3. **Truncation** — retains relevant context, drops redundancy.
4. **Deduplication** — collapses repeated log lines with a count suffix.

### Interface / API

- Primary interface: `rtk <cmd> [args]` (CLI passthrough).
- Meta commands: `rtk gain` (token savings analytics), `rtk gain --history`, `rtk discover` (analyses Claude Code history for missed opportunities), `rtk proxy <cmd>` (bypass filter for debugging).
- Init: `rtk init -g` configures the hook for the target AI tool; accepts `--gemini`, `--codex`, or `--agent <name>`.

### Dependencies

- Runtime: none (single static binary).
- Build: Rust toolchain.
- Install: Homebrew (`brew install rtk`), curl installer, `cargo install --git`, or pre-built binaries for macOS (x86_64 / aarch64), Linux (musl/gnu), and Windows.

### Scope / limitations

- Hook applies only to Bash tool calls. Claude Code's built-in tools (Read, Grep, Glob) are not intercepted; raw `cat`/`rg`/`find` shell equivalents must be used to benefit.
- Filter logic is baked in per-command type; no user-configurable filter rules are documented.
- No streaming or incremental output filtering described; likely buffers full output before filtering.
- Behavior on very large outputs (multi-MB logs) not documented.

## Deployment model

- **Language**: Rust
- **Runtime**: native binary, no interpreter required
- **Storage**: none (stateless per invocation; `rtk gain` likely writes a local log for analytics)
- **OS support**: macOS, Linux, Windows
- **Integration**: hook-based (modifies AI tool settings once via `rtk init`)

## Benchmarks / self-reported metrics

All figures are as reported by the author in the README; none are independently verified.

| Command | Frequency (30 min) | Without rtk | With rtk | Savings |
|---|---|---|---|---|
| `ls` / `tree` | 10× | 2,000 tokens | 400 | −80% |
| `cat` / `read` | 20× | 40,000 | 12,000 | −70% |
| `grep` / `rg` | 8× | 16,000 | 3,200 | −80% |
| `git status` | 10× | 3,000 | 600 | −80% |
| `git diff` | 5× | 10,000 | 2,500 | −75% |
| `git add/commit/push` | 8× | 1,600 | 120 | −92% |
| `cargo test` / `npm test` | 5× | 25,000 | 2,500 | −90% |
| `pytest` | 4× | 8,000 | 800 | −90% |
| **Total (session)** | | **~118,000** | **~23,900** | **−80%** |

> "Estimates based on medium-sized TypeScript/Rust projects. Actual savings vary by project size." (README, as reported)

Headline claim: "60–90% token reduction on common dev commands."

## Open questions / risks / missing details

- **Fidelity risk**: filtering is lossy by design; no documentation on what is dropped for each command type. An agent relying on suppressed lines could miss errors or status changes.
- **Filter corpus**: the 100+ supported commands are listed in the README but the filter heuristics per command are not published separately; correctness depends on trusting the author's implementation.
- **Benchmark methodology**: session estimates assume a specific project size and command frequency. No independent evaluation or ablation study provided.
- **Hook-only scope**: filtering only applies to Bash-routed commands. Workflows using Claude Code built-in file tools receive no benefit unless explicitly replaced with shell equivalents.
- **Analytics trust**: `rtk gain` reports savings based on estimated token counts, not actual LLM token usage; savings numbers are proxies.
- **Maintenance signal**: 20,700 stars suggests active community interest; last push 2026-04-08 indicates active development. No long-term maintenance commitments documented.
- **Windows support**: pre-built binaries exist but hook integration details for Windows AI tools not documented in README.
