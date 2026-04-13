---
title: "Serena"
author: "oraios"
date: 2026-04-08
type: reference
tags: [tool, mcp-server, library, cli]
source: "https://github.com/oraios/serena"
local_clone: ../tools/oraios-serena
version: "v1.0.0"
context: "MCP-native IDE-level code retrieval and editing toolkit; directly relevant to agent tooling and context-efficient code operations."
---

# Serena

> MCP toolkit for coding agents providing semantic retrieval, symbol-level editing, and refactoring — described by the authors as "the IDE for your coding agent".

## TL;DR

- Exposes an MCP server that gives any LLM client IDE-grade code capabilities: find/navigate symbols, rename, get references, hover docs, diagnostics — all via language servers (LSP).
- Operates at the **symbol level** rather than raw line numbers, producing more reliable edits in large codebases with fewer tokens wasted on structural context.
- Supports **40+ programming languages** through pluggable LSP backends (default) or an optional JetBrains plugin backend.
- Provides a **memory system** for long-lived agent sessions: agents can persist notes and decisions across turns.
- Integrates with Claude Code, Cursor, VS Code, JetBrains, Claude Desktop, OpenWebUI, Codex, and any other MCP-capable client.
- Released as v1.0.0 on 2026-04-03; 22 k+ GitHub stars and 1 500+ forks as of triage date.
- MIT licensed and Python-based; installable via `uvx` / `pip`.

## What's novel / different

Most coding-agent tool sets (e.g., raw file read/write tools, shell-exec-based approaches) work at the text or line-number level, requiring agents to carry large file chunks as context to locate the right edit point. Serena instead routes all structural queries through a language server, exposing a symbol-graph abstraction: the agent asks for "the definition of `MyClass.foo`", not "lines 42–87 of `src/foo.py`". This collapses the retrieval cost and makes edits robust to line-shift caused by earlier edits in the same session. The built-in memory system extends this advantage to multi-turn sessions — agents can store reasoning checkpoints without re-ingesting the full project on every turn. No comparable open-source MCP server provides both the LSP-backed semantic layer and the integrated agent memory under a single, config-layered runtime.

## Architecture overview

### Core design

Serena runs as an MCP server process. On start-up it launches (or connects to) a language server for each project language and brokers all code-intelligence queries through that server. Tools are grouped into three capability sets:

1. **Retrieval** — `find_symbol`, `get_symbol_overview`, `find_references`, `get_hover_information`, `get_diagnostics`, `search_for_pattern`, `list_dir`, `find_file`, `read_file`.
2. **Editing** — `create_file`, `create_text_after_symbol`, `replace_symbol_body`, `insert_after_symbol`, `delete_symbol`, `replace_content` (regex/literal).
3. **Shell & memory** — `execute_shell_command`, plus memory-write/read tools for persisting agent notes across turns.

A multi-layered configuration system lets users enable/disable tool groups and select the LSP vs JetBrains backend.

### Interface / API

Pure MCP: all tools are exposed as MCP tool calls. Clients connect either by launching the server subprocess (stdio transport) or by pointing at an HTTP-mode endpoint. No separate REST API.

### Dependencies

- Python 3.10+; distributed via `uvx` (no install) or `pip install serena`.
- LSP backend: language-specific servers installed separately per language (e.g., `pylsp` for Python, `rust-analyzer` for Rust). Serena ships an abstraction layer; the underlying servers are community-maintained OSS.
- JetBrains backend: requires a running JetBrains IDE with the paid Serena plugin (free trial available).

### Scope / limitations

- LSP backend quality is bounded by the underlying language server; coverage varies by language.
- JetBrains backend requires a paid plugin; not suitable for CI or headless environments.
- Memory system is session/project-scoped; no built-in cross-session or cross-agent synchronisation.
- `execute_shell_command` is gated on user configuration; disabled by default in some profiles.

## Deployment model

| Attribute | Value |
|---|---|
| Runtime | Python 3.10+ |
| Install | `uvx serena` (ephemeral) or `pip install serena` |
| Transport | stdio (subprocess) or HTTP (self-hosted) |
| Storage | Local filesystem; optional project-level memory files |
| OS | Cross-platform (macOS, Linux, Windows) |
| License | MIT |

## Benchmarks / self-reported metrics

- "Operates faster, more efficiently and more reliably, especially in larger and more complex codebases" compared to line-number-based approaches (as reported, README).
- "Support for over 40 programming languages" via the LSP backend (as reported, README).
- 22 625 GitHub stars; 1 512 forks as of 2026-04-08 (as reported, GitHub API).

No independent latency, token-reduction, or edit-accuracy benchmarks found at time of triage.

## Open questions / risks / missing details

- No published benchmark comparing symbol-level edit accuracy vs. line-based approaches — the efficiency claims are qualitative only.
- JetBrains plugin pricing is unspecified in the README; "paid plugin / free trial" is the only detail given.
- Memory system design (storage format, eviction, size limits) is not documented in the README; needs code inspection to assess reliability for long sessions.
- LSP server startup latency on large projects is not discussed; could add noticeable overhead per MCP call.
- No mention of sandboxing for `execute_shell_command`; security posture for untrusted codebases is unclear.
- Version v1.0.0 released 2026-04-03 (five days before triage); API stability guarantees not yet established.
