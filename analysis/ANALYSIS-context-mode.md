---
slug: context-mode
title: "Analysis — context-mode"
date: 2026-04-09
type: analysis
tool:
  name: "context-mode"
  repo: "https://github.com/mksglu/context-mode"
  version: "v1.0.75 (601aaf1)"
  language: "TypeScript"
  license: "MIT"
source: ["references/web/context-mode.md", "tools/context-mode/"]
local_clone: null
reviewed: true
reviewed_date: 2026-04-13
source_reviewed: true
updated: null
---

# ANALYSIS: context-mode

---

## Summary

context-mode is a two-mechanism MCP server for Claude Code (and 11 other platforms) that prevents raw tool output from entering the context window. The headline "98% token reduction" is real but applies specifically to the `ctx_execute_file` path (summarization mode). The `ctx_index`/`ctx_search` path achieves 44–93% savings — intentionally lower, because it returns exact content verbatim. Both mechanisms are architecturally sound and verified from source. The benchmark harness exists and is runnable (`npx tsx tests/benchmark.ts`), though reproduction requires dev dependencies.

---

## What it does (verified from source)

### Mechanism 1: Sandbox executor

The critical path for `ctx_execute` / `ctx_execute_file` / `ctx_batch_execute`:

1. Agent calls MCP tool with `{ language, code }`.
2. `Executor` class (`src/executor.ts`) writes code to a temp file in an isolated temp directory (`OS_TMPDIR`, bypassing the `TMPDIR` env var which may point to the project root).
3. Subprocess is spawned via Node.js `child_process.spawn` with a hardened env: a 40+ entry denylist strips vars that could corrupt stdout or inject code (`BASH_ENV`, `NODE_OPTIONS`, `PYTHONSTARTUP`, `RUBYOPT`, `ERL_AFLAGS`, `GIT_SSH_COMMAND`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, and others — see source for full list).
4. **Only `stdout` is captured and returned to the MCP caller.** `stderr` and exit code are available in the result struct but are not forwarded to the LLM unless the agent explicitly requests them.
5. Temp dir is cleaned up after execution.

Supported runtimes: JavaScript (Bun preferred, Node.js fallback), TypeScript, Python, Shell, Ruby, Go, Rust, PHP, Perl, R, Elixir (11 total).

`ctx_execute_file` wraps a file's content into the script before execution — the agent writes analysis code, not a data read.

`ctx_batch_execute` combines multiple commands and BM25 search queries in a single MCP round-trip, eliminating per-tool latency for research workflows.

**Smart truncation** (v0.3+): when output exceeds the configured limit, the executor preserves the first 60% and last 40% of lines at line boundaries, with a labeled gap: `"[47 lines / 3.2KB truncated — showing first 12 + last 8 lines]"`. This preserves error messages that appear at the end of output (e.g. stack traces, test failures).

### Mechanism 2: Session tracker + FTS5 knowledge base

A SQLite database (`better-sqlite3`) backs three independent subsystems:

- **Event log**: `session_events`, `session_meta`, `session_resume` tables record every tool call, file edit, git op, error, and user decision via hook callbacks.
- **Knowledge base**: `chunks` and `chunks_trigram` FTS5 virtual tables power `ctx_index` / `ctx_search`. The agent indexes fetched content and retrieves exact matching chunks on demand.
- **Compaction recovery**: the `PreCompact` hook fires before Claude Code's built-in summarization, indexes the current session into FTS5, and injects only BM25-relevant events back into context — recovering session continuity without a full context dump.

### Hook registration (Claude Code)

Hooks are registered in `~/.claude/settings.json`. The **required** hooks are `PreToolUse` (intercepts: Bash, WebFetch, Read, Grep, Agent, Task, and the ctx_* tools themselves) and `SessionStart`. Optional: `PostToolUse`, `PreCompact`, `UserPromptSubmit`. Hook commands use absolute Node.js paths to avoid PATH issues across nvm/Homebrew/Volta environments.

---

## Benchmark claims — verified vs as-reported

### What the harness tests

The benchmark suite (`tests/benchmark.ts`, `tests/context-comparison.ts`, `tests/ecosystem-benchmark.ts`) tests two tool categories against a fixture corpus.

### ctx_execute_file (summarization path)

| Scenario | Raw | Context | Savings | Status |
|---|---|---|---|---|
| Playwright snapshot | 56.2 KB | 299 B | 99% | as reported |
| GitHub Issues (20) | 58.9 KB | 1.1 KB | 98% | as reported |
| Access log (500 reqs) | 45.1 KB | 155 B | 100% | as reported |
| CSV analytics (500 rows) | 85.5 KB | 222 B | 100% | as reported |
| Git log (153 commits) | 11.6 KB | 107 B | 99% | as reported |
| Test output (30 suites) | 6.0 KB | 337 B | 95% | as reported |

**Subtotal (13 scenarios): 316 KB → 5.5 KB (98% savings)** *(as reported)*

These numbers are plausible given the mechanism: an LLM-written Python/JS script summarizes the data into 1–3 lines. The compression ratio is bounded by how much information fits in a `console.log()` call, not by the input size.

### ctx_index + ctx_search (retrieval path)

| Scenario | Raw | Context (3 queries) | Savings | Status |
|---|---|---|---|---|
| Supabase Edge Functions | 3.9 KB | 2,246 B | 44% | as reported |
| React useEffect docs | 5.9 KB | 1,494 B | 75% | as reported |
| Next.js App Router | 6.5 KB | 3,311 B | 50% | as reported |
| Tailwind CSS docs | 4.0 KB | 620 B | 85% | as reported |
| Skill prompt (main) | 4.4 KB | 932 B | 79% | as reported |
| Skill refs (4 files) | 33.2 KB | 2,412 B | 93% | as reported |

**Subtotal (6 scenarios): 60.3 KB → 11.0 KB (82% savings)** *(as reported)*

The lower savings vs `ctx_execute_file` is **by design and architecturally correct**: BM25 search returns exact chunks, not summaries. A `useEffect` cleanup example comes back as the full code block, not `"cleanup pattern in useEffect"`.

### Session-level aggregate (as reported)

Full debugging session scenario across 6 tool calls: 177 KB raw → 10.2 KB in context (**94% reduction**, ~45,300 → ~2,600 tokens).

### Reproduction attempt

**Status: partially verified** — context savings confirmed; session-level aggregate unverified (fixture-based).

Run at pinned commit `601aaf1`, macOS Darwin 25.4.0, Node.js v24.14.1, Bun 1.3.11, Python 3.14.3.
Dev dependencies installed via `npm install` in the submodule before running.

**Context savings (verified)**:

| Scenario | Raw | Output | Savings |
|---|---|---|---|
| API Response (200 users) | ~49 KB | 22 B | 100% |
| Build Output (500 lines) | ~24 KB | 37 B | 100% |
| Log File (1000 entries) | ~78 KB | 67 B | 100% |
| npm ls output | ~39 KB | 25 B | 100% |

These match the reported range. The simulated workloads use pre-written summarization scripts — real-world savings depend on the agent writing effective scripts.

**Cold start latency (verified — not disclosed in README)**:

| Runtime | Avg | Min | P95 |
|---|---|---|---|
| JavaScript (Bun) | 2851 ms | 2315 ms | 3650 ms |
| TypeScript (Bun) | 3418 ms | 3062 ms | 3854 ms |
| Python | 1958 ms | 1558 ms | 2679 ms |
| Shell | 2553 ms | 2402 ms | 3122 ms |
| Perl | 1182 ms | 289 ms | 3671 ms |

Each `ctx_execute_file` call adds **1–4 seconds of wall-clock latency** (subprocess spawn + runtime startup). Not mentioned in the README or BENCHMARK.md. For sessions with many tool calls this compounds — 20 JS calls ≈ 57 seconds of pure overhead.

Concurrent execution scales linearly (10 tasks × 1605ms/task = 16053ms total), suggesting no I/O bottleneck beyond subprocess startup.

---

## Architectural assessment

### What's genuinely novel

1. **MCP-layer interception vs output filtering**: RTK and similar tools filter output after it reaches the LLM context. context-mode prevents it from arriving at all — the raw output stays inside the subprocess. This is a fundamentally different threat model: the LLM never sees data it doesn't need, so there is no risk of the model fixating on irrelevant output.

2. **Two-speed retrieval in one tool**: The `ctx_execute_file` / `ctx_index`+`ctx_search` distinction maps cleanly onto "compute-and-discard" (logs, CSVs, snapshots) vs "retrieve-exact" (docs, code examples). Forcing the agent to choose the right tool makes the retrieval strategy explicit and auditable.

3. **PreCompact hook for session continuity**: Rather than relying on Claude Code's built-in summarizer (which loses structured context), the PreCompact hook snapshots the event log to FTS5 and reinjects only relevant events. This is the mechanism behind the "30 min → 3 hours" session duration claim — it avoids the context cliff that terminates most long sessions.

4. **Security-conscious sandbox**: The env var denylist (`BASH_ENV`, `NODE_OPTIONS`, `ERL_AFLAGS`, `LD_PRELOAD`, `GIT_SSH_COMMAND`, etc.) is unusually thorough. Most comparable tools use `exec` with the inherited environment. This matters for shared or CI environments where env vars could be attacker-controlled.

### Gaps and risks

- **Benchmark methodology is agent-authored**: the `ctx_execute_file` savings depend entirely on the agent writing a useful summarization script. If the agent writes a verbose script, savings drop. The harness fixtures are curated — real-world savings will vary.
- **`ctx_index`+`ctx_search` savings vary 44–93%** depending on query quality and corpus structure. The tool decision matrix (BENCHMARK.md) is the right guide; the headline "98%" figure does not apply here.
- **`--continue` flag is footgun**: without it, previous session state is silently deleted on restart. There is no warning in the default startup path.
- **ELv2 license**: source-available but not OSI open source. Cannot be used as the basis of a competing hosted service. Free for individual/internal use — check with legal before vendoring in a product.
- **Platform hook compliance varies**: Zed and Antigravity enforce routing via instruction files only (~60% compliance as reported). The context-saving guarantee is not reliable on those platforms.
- **`better-sqlite3` native module**: requires platform-specific rebuild after Node.js upgrades. Alpine Linux needs build tools for older versions. Silent breakage is possible.

---

## Recommendation

**Adopt for Claude Code use.** Already deployed in this session. The mechanism is sound, the architecture is auditable, and the `ctx_execute_file` path delivers the claimed savings on the scenarios tested. The `ctx_index`+`ctx_search` path is the better choice when exact content is needed (code examples, API refs, skill prompts).

**Do not** use the "98%" figure as a blanket claim — it applies to `ctx_execute_file` summarization scenarios. Quote per-mechanism numbers when comparing against other tools.

Priority for follow-up: run the full benchmark harness against a real debugging session to get verified session-level numbers (the 94% session aggregate is self-reported against a curated fixture set).

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | context-mode |
|---|---|
| Approach | MCP-layer output interception + FTS5 knowledge base |
| Compression (summarization) | 95–100% (as reported) |
| Compression (retrieval) | 44–93% (as reported) |
| Token budget model | Implicit: agent chooses tool; no hard budget |
| Injection strategy | On-demand (agent calls ctx_search) + compaction recovery |
| Eviction | PreCompact hook → BM25 reinject of relevant events only |
| Benchmark harness | Yes — `tests/benchmark.ts`; fixture-based |
| License | ELv2 |
| Maturity | v1.0.75; 12 platforms; actively maintained |
