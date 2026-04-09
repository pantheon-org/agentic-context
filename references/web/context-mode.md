---
title: "context-mode"
author: "mksglu"
date: 2026-04-08
type: reference
tags: [tool, mcp-server, cli, daemon]
source: "https://github.com/mksglu/context-mode"
version: "v1.0.75 (601aaf1)"
local_clone: "../tools/context-mode"
context: "Session-level context optimisation; directly relevant to token budgeting, compression, and session continuity research"
---

## TL;DR

- MCP server (+ Claude Code plugin) that sandboxes tool output into a subprocess so raw data never enters the LLM context window.
- Three-pillar design: context saving (sandbox execution), session continuity (SQLite + FTS5 + BM25 compaction recovery), and "think in code" paradigm (agent writes scripts, not data reads).
- Self-reports 98% median token reduction; 315 KB of raw tool output becomes 5.4 KB over a full session (as reported, README).
- Supports 12 platforms (Claude Code, Cursor, VS Code Copilot, Windsurf, Kiro, OpenCode, Zed, Antigravity, Codex CLI, OpenClaw/Pi Agent, Amp, Gemini CLI).
- Six sandbox tools exposed via MCP: `ctx_execute`, `ctx_execute_file`, `ctx_batch_execute`, `ctx_index`, `ctx_search`, `ctx_fetch_and_index`.
- Local-only; no telemetry, no cloud sync, no account required; SQLite databases live in the home directory.
- Licensed under Elastic License v2 (ELv2) — source-available, not OSI open source.

## What's novel / different

Adjacent tools (RTK, output-filter proxies) truncate or filter output after it has already entered the context window. Context-mode intercepts at the MCP protocol layer: the raw output is processed inside a sandboxed subprocess and only a minimal summary (the `console.log()` result) reaches the LLM. This is distinct from compaction — it is prevention, not recovery. The session continuity pillar adds a second differentiated capability: rather than dumping a full conversation summary back into context on compaction, it maintains a SQLite + FTS5 event log and retrieves only the relevant events via BM25 search, extending effective session length from ~30 minutes to ~3 hours (as reported). No comparable MCP server combines both capabilities with 12-platform hook support and local-only privacy guarantees.

## Architecture overview

### Core design

Three independent subsystems share a SQLite backing store:

1. **Sandbox executor** — `ctx_execute` and `ctx_execute_file` spawn a subprocess running one of 11 supported runtimes (JavaScript/Bun, TypeScript, Python, Shell, Ruby, Go, Rust, PHP, Perl, R, Elixir). Only stdout is returned to the MCP caller; all other output stays in the subprocess. `ctx_batch_execute` combines multiple commands and multiple BM25 search queries in a single MCP call.
2. **Session tracker** — hooks registered via platform-specific hook APIs (PreToolUse, PostToolUse, PreCompact, SessionStart) record every tool invocation, file edit, git operation, error, and user decision as structured events in SQLite. On compaction, the PreCompact hook indexes the current session into an FTS5 database and injects only BM25-relevant events back into context.
3. **Knowledge base** — `ctx_index` and `ctx_search` expose the FTS5 store directly to the agent as a first-class tool, enabling the agent to build and query its own ephemeral knowledge base within a session.

### Interface / API

Exposed as an MCP server with six tools. On Claude Code specifically it also registers as a plugin with slash commands (`/context-mode:ctx-stats`, `/context-mode:ctx-doctor`, `/context-mode:ctx-upgrade`, `/context-mode:ctx-purge`). Platform routing is enforced via native hook APIs where available; fallback platforms (Zed, Antigravity) rely on a manually-copied routing instruction file with ~60% compliance (as reported).

### Dependencies

- **Runtime**: Node.js 18+ (Bun preferred for JS/TS execution; 3–5× faster than Node for sandbox scripts)
- **Native module**: `better-sqlite3` (requires native rebuild on some platforms; Alpine Linux needs build tools for older versions)
- **Storage**: SQLite via `better-sqlite3`; FTS5 extension must be enabled (checked by `ctx doctor`)
- **No external services**: fully local

### Scope / limitations

- ELv2 license prohibits use as a competing hosted service; free for individual and internal use.
- Hook support varies by platform: Cursor's `additional_context` in PostToolUse is accepted but not surfaced to the model; Codex CLI hook dispatch is not yet active (Stage::UnderDevelopment as of triage date); Zed and Antigravity enforce routing via instruction files only (~60% compliance).
- `--continue` flag required to persist session data across restarts; without it, previous session data is deleted on startup.
- Benchmark figures are self-reported on curated scenarios; no independent reproduction is available at triage date.

## Deployment model

| Attribute | Value |
|---|---|
| Language | TypeScript (compiled; Node.js runtime) |
| Install | `npm install -g context-mode` |
| Storage | SQLite (home directory; ephemeral by default) |
| Network | None; fully local |
| License | Elastic License v2 (ELv2) |
| Latest version at triage | v1.0.75 (2026-04-05) |

## Benchmarks / self-reported metrics

All figures are from the README `## Benchmarks` table (as reported, unverified):

| Scenario | Raw | Context | Saved |
|---|---|---|---|
| Playwright snapshot | 56.2 KB | 299 B | 99% |
| GitHub Issues (20) | 58.9 KB | 1.1 KB | 98% |
| Access log (500 requests) | 45.1 KB | 155 B | 100% |
| Context7 React docs | 5.9 KB | 261 B | 96% |
| Analytics CSV (500 rows) | 85.5 KB | 222 B | 100% |
| Git log (153 commits) | 11.6 KB | 107 B | 99% |
| Test output (30 suites) | 6.0 KB | 337 B | 95% |
| Repo research (subagent) | 986 KB | 62 KB | 94% |

Session-level aggregate: 315 KB raw → 5.4 KB in context; session duration extended from ~30 min to ~3 hours (as reported, README). Full benchmark data with 21 scenarios in `BENCHMARK.md` in the repo.

## Open questions / risks / missing details

- Benchmark figures are self-reported on cherry-picked scenarios; no independent benchmark reproduction is referenced.
- ELv2 license creates adoption friction for teams that require OSI-approved licences; check with legal before vendoring.
- Hook compliance on fallback platforms (Zed, Antigravity: ~60%) means the context-saving guarantee is not reliable on those platforms.
- Codex CLI hook dispatch is listed as `Stage::UnderDevelopment` — production reliability on that platform is unknown.
- The `--continue` session persistence model is implicit; a missed flag silently deletes previous session state (risk of unexpected data loss for users).
- No published independent evaluation of the BM25 compaction recovery quality (i.e., whether the right events are retrieved after compaction).
- `better-sqlite3` native module requires platform-specific rebuild steps; potential for silent breakage after Node.js upgrades.
