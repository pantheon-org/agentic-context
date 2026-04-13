---
slug: rtk
title: "Analysis — rtk"
date: 2026-04-10
type: analysis
tool:
  name: "rtk"
  repo: "https://github.com/rtk-ai/rtk"
  version: "v0.35.0"
  language: "Rust"
  license: "Apache-2.0"
source: "references/rtk-ai-rtk.md"
local_clone: null
reviewed: false
reviewed_date: null
source_reviewed: false
updated: null
---

# ANALYSIS: rtk

---

## Summary

rtk is a transparent CLI proxy that intercepts Bash tool calls via a `PreToolUse` hook and rewrites them to `rtk <cmd>` before the command executes. Output is filtered through a two-track pipeline: 69 Rust-implemented rule patterns for first-class commands (git, cargo, test runners, linters) and a TOML-DSL engine covering 58 additional tools — both counts verified from source. The 60-90% token reduction headline is plausible for the specific commands benchmarked but relies on a `ceil(chars / 4)` character-count proxy rather than actual LLM tokenizer counts — the exact formula `(text.len() as f64 / 4.0).ceil() as usize` is in `src/core/tracking.rs::estimate_tokens()`. The benchmark harness (`scripts/benchmark.sh`) is real, runnable, and ships with the repo — savings figures are measured against live command output, not curated fixtures. The architecture is genuinely different from injection-side context managers: rtk operates on output before it enters the context window, adds no LLM round-trips, and the hook intercept is transparent to both the agent and the user.

---

## Source review

**Source location**: `tools/rtk/` (vendored from `https://github.com/rtk-ai/rtk`, `Cargo.toml` version `0.35.0`)

### Filter pipeline architecture (verified)

The two-track pipeline is confirmed from source:

**Track 1 — Rust command handlers**: `src/discover/rules.rs` defines a `RULES` constant slice of `RtkRule` structs. Each rule carries a regex `pattern`, an `rtk_cmd` prefix, `category`, a per-category `savings_pct`, and optional per-subcommand overrides. Counting `pattern:` fields in `RULES`: **69 entries** (verified). Unmatched commands are passed through unchanged (exit code 1 from `rtk rewrite`).

**Track 2 — TOML filter engine**: `src/filters/` contains **58 `.toml` files** (verified by directory listing). `build.rs` reads all `*.toml` files, validates TOML syntax, checks for duplicate filter names, and concatenates them into a single `builtin_filters.toml` artifact embedded at compile time as the constant `BUILTIN_TOML` in `src/core/toml_filter.rs`. The 8-stage pipeline is implemented in `TomlFilterRegistry` and applied in order: strip_ansi → replace → match_output → strip/keep_lines_matching → truncate_lines_at → head_lines/tail_lines → max_lines → on_empty (verified from `toml_filter.rs` module doc).

**build.rs compile-time checks** (verified):

- TOML parse validity of the combined filter file
- Duplicate filter name detection across files
- Does NOT enforce that every filter has inline tests (see correction below)

### Tokenizer implementation (verified)

`src/core/tracking.rs` exports:

```rust
pub fn estimate_tokens(text: &str) -> usize {
    // ~4 chars per token on average
    (text.len() as f64 / 4.0).ceil() as usize
}
```

`TimedExecution::track()` calls `estimate_tokens(input)` and `estimate_tokens(output)` and passes the results to `Tracker::record()` which stores `(input_tokens, output_tokens, saved_tokens, savings_pct)` in SQLite. This is the same heuristic used in `scripts/benchmark.sh` (`$(( (len + 3) / 4 ))`).

### Inline test enforcement — correction from prior analysis (verified)

The prior analysis claimed: "Every built-in TOML filter is required to have at least one inline test — enforced at compile time by `test_builtin_all_filters_have_inline_tests` in `src/core/toml_filter.rs`."

**This is incorrect.** Source inspection finds no such compile-time enforcement and no function named `test_builtin_all_filters_have_inline_tests`. Inline test enforcement is implemented as a **runtime** check via `rtk verify --require-all`: `src/hooks/verify_cmd.rs` calls `run_filter_tests()` which populates `VerifyResults.filters_without_tests`, and when `--require-all` is passed, it calls `anyhow::bail!()` if any filter lacks tests. The `build.rs` compile-time validation covers only TOML syntax correctness and duplicate names. Whether every filter actually has a test is not enforced at build time.

### Handler/filter count discrepancy from references/rtk-ai-rtk.md

`references/rtk-ai-rtk.md` records the tool version as `v0.28.2`. The vendored source (`Cargo.toml`) is `v0.35.0`. The handler and filter counts (69/58) align with the `ANALYSIS-rtk.md` which used `v0.35.0`. The reference file version is stale — the source at `tools/rtk/` is a newer build.

---

## What it does (verified from source)

### Core mechanism

The full path from agent command to filtered output has four stages.

**Stage 1 — Hook intercept.** `rtk init -g` writes a `PreToolUse` hook into `~/.claude/settings.json` (or equivalent for Cursor, OpenCode, Codex). The hook script (`hooks/claude/rtk-rewrite.sh`) reads the JSON tool input from stdin via `jq`, extracts the `tool_input.command` field, and calls `rtk rewrite "<cmd>"`. The hook is a thin shell delegate — all classification logic lives in Rust.

**Stage 2 — Command classification** (`src/discover/registry.rs`). `rtk rewrite` runs the raw command string through a `RegexSet` of 69 patterns defined in `src/discover/rules.rs`. The last (most-specific) match wins. Each `RtkRule` carries: the regex pattern, the `rtk_cmd` prefix, the command category, a per-subcommand savings estimate, and an optional `RtkStatus` (Existing, Passthrough, or New). Unmatched commands exit with code 1 and are passed through unchanged. Matched commands return exit code 0 with the rewritten command on stdout; the hook then injects `permissionDecision: "allow"` so Claude Code auto-approves the rewrite without prompting.

**Stage 3 — Filtering pipeline.** When the agent runs the rewritten command, rtk executes the underlying binary, captures combined stdout+stderr, and applies one of two filter tracks:

- **Rust handlers** (69 rules): Per-command logic in `src/cmds/`. For example, `rtk git diff` runs `git diff --stat` first, then the full diff, and calls `compact_diff()` to strip unchanged context lines. `git add/commit/push` suppress progress spinners and verbose success noise. Test runners (cargo test, pytest, vitest, playwright) extract pass/fail summaries and preserve only failing test output. The `RunOptions` struct controls whether stderr is merged, whether filtering is skipped on non-zero exit, and whether a trailing newline is emitted.

- **TOML filter engine** (`src/core/toml_filter.rs`): 58 additional filters defined as `.toml` files in `src/filters/`, concatenated at compile time via `build.rs` and embedded in the binary as the constant `BUILTIN_TOML`. Lookup priority: project-local `.rtk/filters.toml` (trust-gated) > user-global `~/.config/rtk/filters.toml` > built-in. Each TOML filter defines an 8-stage pipeline applied in order:

  1. `strip_ansi` — strip ANSI escape codes (boolean).

  2. `replace` — regex substitutions, line-by-line, chainable.

  3. `match_output` — short-circuit: if the full output blob matches a pattern, return a canned message immediately (with optional `unless` guard).

  4. `strip_lines_matching` / `keep_lines_matching` — regex line filters.

  5. `truncate_lines_at` — truncate each line to N chars.

  6. `head_lines` / `tail_lines` — keep first or last N lines.

  7. `max_lines` — absolute line cap.

  8. `on_empty` — message if output is empty after filtering.

**Stage 4 — Raw output recovery (tee).** By default, on command failure, the unfiltered raw output is written to `~/.local/share/rtk/tee/` (up to 20 files, 1 MB each). A hint line `[full output: /path/to/file.log]` is appended to the filtered output so the agent can retrieve it if needed. This is the primary fidelity backstop for the lossy filter path.

**Token estimation.** Savings are tracked in a SQLite database (`~/.local/share/rtk/tracking.db`) using the formula `ceil(chars / 4)` — a character-count heuristic, not an actual tokenizer call. `rtk gain` reports these proxy estimates, not measured LLM token usage.

### Interface / API

- `rtk <cmd> [args]` — primary passthrough; applies filter if a rule matches.
- `rtk rewrite "<cmd>"` — classification only; prints rewritten command or exits with status code.
- `rtk init -g` with optional flags `--cursor`, `--codex`, `--opencode`, or `--agent <name>` — installs hook and writes `RTK.md` awareness instructions.
- `rtk gain` with optional flags `--history`, `--project`, `--daily`, `--weekly`, `--monthly`, `--format json`, `--format csv` — token savings analytics from local SQLite.
- `rtk discover` — scans Claude Code session history for commands that could have used rtk.
- `rtk proxy <cmd>` — bypass filter; run raw command for debugging.
- `RTK_NO_TOML=1` — bypass TOML engine entirely.
- `RTK_TOML_DEBUG=1` — print matched filter name and line counts to stderr.
- `RTK_TEE=0` — disable raw output recovery.

### Dependencies

Runtime: none — single statically linked binary. The `rusqlite` crate bundles SQLite; no system SQLite required. Build requires the Rust toolchain; `build.rs` concatenates TOML filter files at compile time. Optional: `jq` is required by the Claude Code hook script (gracefully degrades with a warning if absent).

Key crates (from `Cargo.toml`): `clap 4`, `regex`, `lazy_static`, `rusqlite` (bundled), `serde`/`serde_json`, `colored`, `chrono`, `tempfile`, `sha2`, `ureq` (telemetry), `which`, `walkdir`, `ignore`.

### Scope / limitations

- Hook intercepts `PreToolUse` for Bash only. Claude Code built-in Read, Grep, and Glob tools bypass it entirely; those must be replaced with shell `cat`/`rg`/`find` calls to benefit.
- Filtering is lossy by design. The tee mechanism partially mitigates this but the agent must explicitly retrieve the full output file to see suppressed lines.
- Token estimates use `ceil(chars / 4)`, not a tokenizer. Savings percentages in `rtk gain` are proxies.
- `&&` compound commands are rewritten correctly (`cmd1 && cmd2` becomes `rtk cmd1 && rtk cmd2`). Pipeline operators are not rewritten — only the left-side command of a pipe chain would be intercepted.
- Telemetry: a daily background ping sends version, OS, hashed device ID, and aggregate token savings to a configured endpoint. Opt-out via `RTK_TELEMETRY_DISABLED=1` or `telemetry.enabled = false` in config.
- Project-local `.rtk/filters.toml` is trust-gated — rtk checks a trust signature before loading it, preventing malicious filter injection via tampered project files.
- Output is fully buffered before filtering; no streaming filter path exists.

---

## Benchmark claims — verified vs as-reported

The benchmark harness (`scripts/benchmark.sh`) runs live commands on temporary fixtures and compares `ceil(chars / 4)` token estimates between raw and rtk-filtered output. It is not fixture-driven: git, cargo, and test-runner sections create actual repositories. The summary reports `TOTAL_UNIX → TOTAL_RTK (−N%)` and exits non-zero if fewer than 80% of tests show improvement (verified from source — see lines 587-591: `if [ "$GOOD_PCT" -lt 80 ]; then ... exit 1`).

Savings estimates hardcoded in `src/discover/rules.rs` per command category (used for `rtk gain` projections when no prior tracking data exists):

| Command category | Savings estimate | Source status |
|---|---|---|
| git status/log/branch/fetch | 70% | verified |
| git diff/show | 80% | verified |
| git add/commit | 59% | verified |
| gh pr | 87% | verified |
| gh run | 82% | verified |
| cargo test | 90% | verified |
| cargo build/check | 80% | verified |
| vitest/jest | 99% | verified |
| playwright | 94% | verified |
| next build | 87% | verified |
| docker ps/logs | 85% | verified |
| kubectl get/logs | 85% | verified |
| tsc | 83% | verified |
| eslint/biome | 84% | verified |
| ls | 65% | verified |
| cat/head/tail | 60% | verified |
| grep/rg | 75% | verified |
| find | 70% | verified |

README session-level estimates (30-minute session on a medium TypeScript/Rust project):

| Command | Freq | Without rtk | With rtk | Savings |
|---|---|---|---|---|
| `ls` / `tree` | 10x | 2,000 tokens | 400 | -80% |
| `cat` / `read` | 20x | 40,000 | 12,000 | -70% |
| `grep` / `rg` | 8x | 16,000 | 3,200 | -80% |
| `git status` | 10x | 3,000 | 600 | -80% |
| `git diff` | 5x | 10,000 | 2,500 | -75% |
| `git add/commit/push` | 8x | 1,600 | 120 | -92% |
| `cargo test` / `npm test` | 5x | 25,000 | 2,500 | -90% |
| `pytest` | 4x | 8,000 | 800 | -90% |
| **Total** | | **~118,000** | **~23,900** | **-80%** |

All session-level figures are (as reported). README footnote: "Estimates based on medium-sized TypeScript/Rust projects. Actual savings vary by project size."

The `rtk gain` analytics module stores per-invocation `(input_chars, output_chars, saved_tokens)` in SQLite with 90-day retention, exportable as JSON or CSV (verified from source). This provides an audit trail of observed savings for a given user's workflow — though still character-count-based, not tokenizer-based.

Benchmark harness: structure and methodology verified from source. Per-command filter logic verified from source. End-to-end savings figures not independently re-run.

---

## Architectural assessment

### What's genuinely novel

**Output-side interception vs injection-side management.** All other tools surveyed in this repo (context-mode, codebase-memory-mcp, codegraph) operate on the injection side — choosing what to load into context. rtk operates on the output side, reducing what command execution returns before it enters the context window. These are complementary strategies, not competing ones.

**Transparent hook rewrite with exit-code permission protocol.** The `rtk rewrite` exit-code protocol (`0`=allow+rewrite, `1`=passthrough, `2`=deny, `3`=ask+rewrite) is a clean design: the Rust binary is the single source of truth for both filtering and permission handling. Adding a new supported command requires only a new `RtkRule` entry in `src/discover/rules.rs`; the hook script and all platform integrations pick it up automatically with zero changes.

**TOML filter DSL with runnable inline tests.** The 8-stage declarative pipeline lets the filter corpus grow without new Rust code. Each TOML filter can carry `[[tests.<filter-name>]]` inline test cases. The `rtk verify --require-all` command (`src/hooks/verify_cmd.rs`) enforces that every filter has at least one test and fails with a non-zero exit if any filter is untested — intended for CI use. Note: this enforcement is runtime (`rtk verify`), not compile-time; `build.rs` validates only TOML syntax and duplicate names. This is still a meaningful correctness backstop for a heuristic filtering system.

**Tee-based fidelity backstop.** Saving the unfiltered output to disk on failure and injecting a recovery hint (`[full output: /path/to/file.log]`) into the filtered output is a practical solution to the information loss risk inherent in lossy filtering.

**Project-local custom filters.** The `.rtk/filters.toml` mechanism lets teams commit custom filter rules alongside their codebase. Trust-gating prevents supply-chain injection via tampered filter files.

### Gaps and risks

**Character-count token proxy.** `ceil(chars / 4)` systematically underestimates savings on ASCII-heavy outputs (code, JSON) and overestimates on Unicode. The benchmark and `rtk gain` analytics both use this proxy. Actual LLM token savings could differ by 20-30% from reported figures for some command types.

**Fidelity is trust-based.** There is no formal specification of what each filter preserves. A test failure hidden by a test runner filter would be a serious correctness bug. The inline TOML tests help but cover only author-anticipated input shapes.

**Hook-only scope is a hard ceiling.** Commands routed through Claude Code built-in tools (Read, Grep, Glob) are never filtered. In a well-configured Claude Code session that follows "prefer built-in tools" guidance, rtk may intercept far fewer commands than the session estimates assume.

**Pipeline operators unsupported.** A command like `git log` piped to `grep foo` would only have the `git log` segment rewritten; the `grep foo` segment receives rtk-filtered input, which may break patterns that relied on suppressed lines.

**Telemetry by default.** The daily background ping fires on first invocation and every 23 hours. Opt-out is documented but requires explicit action. In corporate environments this may require policy review.

**No streaming filter.** Output is fully buffered before filtering. Very large outputs (multi-MB test logs) could cause memory pressure; no streaming or incremental filter path is implemented.

---

## Recommendation

**Adopt for shell-heavy Claude Code workflows.** The hook mechanism is sound, the TOML filter DSL is auditable, and the tee backstop reduces the information loss risk enough for most development tasks. The 60-90% headline is plausible for the specific commands benchmarked (test runners in particular); treat it as an optimistic ceiling for real sessions where Claude Code built-in tools handle many file reads.

Do not report `rtk gain` percentages as verified LLM token savings — they are character-count proxies. Use them as relative comparisons between sessions, not absolute measurements.

**Combine with context-mode** for maximum effect: context-mode prevents large file reads from entering context; rtk prevents verbose command output from entering context. They operate on different tool categories and do not overlap.

Priority for follow-up: reproduce the benchmark harness against a live repository to get independently measured (rather than self-reported) per-command savings figures.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | rtk |
|---|---|
| Approach | Output-side filtering via transparent hook rewrite |
| Compression | 60-99% per command category (as reported); character-count proxy |
| Token budget model | None — pure output compression, no budget tracking |
| Injection strategy | Not applicable — operates on command output, not context injection |
| Eviction | Not applicable |
| Benchmark harness | Yes — `scripts/benchmark.sh`; live fixture-based |
| License | Apache-2.0 |
| Maturity | v0.35.0 (verified); 69 Rust rule patterns + 58 TOML filters (verified); actively maintained |
