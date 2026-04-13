---
slug: oraios-serena
title: "Analysis — Serena"
date: 2026-04-10
updated: 2026-04-13
type: analysis
tool:
  name: "Serena"
  repo: "https://github.com/oraios/serena"
  version: "v1.1.1"
  language: "Python"
  license: "MIT"
source: "references/oraios-serena.md"
local_clone: "tools/oraios-serena"
reviewed: false
reviewed_date: null
source_reviewed: false
---

# ANALYSIS: Serena

---

## Summary

Serena is a Python MCP server that brokers all code-intelligence queries through language servers (LSP), exposing IDE-grade capabilities — symbol lookup, cross-reference navigation, semantic editing, rename refactoring, and persistent session memory — as MCP tools. The LSP-backed symbol abstraction is verified correct from source: agents operate on named symbol paths (e.g. `MyClass/my_method`) rather than line numbers, which makes edits robust to line-shift and reduces the token cost of structural queries. The memory system is a simple markdown-on-disk store with project and global scopes, not a vector database. No token-reduction benchmark harness exists; the "faster, more efficiently" claims in the README are qualitative. Source review confirms 44 concrete tool classes across 8 modules (34 default-enabled, 10 optional; 10 of the optional ones are JetBrains-only), 55 language-server modules in SolidLSP, a full web dashboard, a hooks subsystem for Claude Code / Cursor session lifecycle, and an Agno AI framework integration. The vendored submodule is at v1.1.1 (triage was done against v1.0.0; the version boundary matters because 1.1.0 added session hooks and usage telemetry). At v1.1.1 with 22 k+ stars and a rich test suite, this is the most mature open-source MCP toolkit in the survey for language-aware code operations.

---

## What it does (verified from source)

### Core mechanism

Serena's primary value proposition is routing all code-structure queries through the Language Server Protocol rather than raw file reads. The architecture has three layers:

1. **SolidLSP** (`src/solidlsp/`) — a standalone Python wrapper around LSP subprocess management. It handles process launch, JSON-RPC communication, two-tier document-symbol caching (raw LSP symbols cached to disk as pickle; high-level `DocumentSymbols` cached in memory), file buffer management, and all LSP request methods (`request_document_symbols`, `request_references`, `request_rename_symbol_edit`, `request_definition`, etc.). The cache tier is keyed on file content hashes, so symbols are reloaded only when the file changes (verified from `src/solidlsp/ls.py` lines 494–506).

2. **SerenaAgent** (`src/serena/agent.py`) — orchestrates one or more `SolidLanguageServer` instances through a `LanguageServerManager`, exposes a `ToolSet` (the active subset of all registered tools), manages `ActiveModes`, and holds the `SerenaConfig` (project registry, defaults). The agent instantiates all tool classes at start-up via `ToolRegistry().get_all_tool_classes()` and selects the active subset based on context YAML and mode selections.

3. **MCP layer** (`src/serena/mcp.py`) — wraps each active `Tool` as a `FastMCP` tool using `docstring_parser` to extract parameter descriptions. All tools are exposed over stdio or HTTP; there is no separate REST surface.

The LSP call path for a symbol lookup is: MCP tool call → `Tool.apply_ex()` → `Tool.apply()` → `LanguageServerSymbolRetriever.find()` → `SolidLanguageServer.request_full_symbol_tree()` → LSP `textDocument/documentSymbol` (JSON-RPC over subprocess stdio) → parse + cache → return structured `LanguageServerSymbol` objects → serialise to compact JSON (verified from `src/serena/tools/symbol_tools.py` and `src/solidlsp/ls.py`). `apply_ex` wraps `apply` with: active-tool check, active-project guard, LSP auto-restart on terminated-server errors, tool-usage recording via `agent.record_tool_usage()`, and cache save on completion. All tool invocations are dispatched through a `TaskExecutor` with a configurable timeout (default 240 s, verified from `src/serena/config/serena_config.py` line 683). Symbol identity uses a slash-delimited name-path (e.g. `MyClass/my_method`), not line numbers, which means the agent can re-use a previously retrieved name-path for an edit even after earlier edits in the same session have shifted line numbers.

### Interface / API

All capabilities are exposed as MCP tools. The complete tool inventory, verified from source (44 concrete tool classes in 8 modules under `src/serena/tools/`):

#### Symbol retrieval (LSP backend, default-enabled)

- `get_symbols_overview` — file-level outline grouped by symbol kind; supports depth parameter to include children. Two shortening stages when depth > 0: depth-0 overview, then kind-count summary (verified from `symbol_tools.py`).
- `find_symbol` — global or scoped symbol search by name-path pattern; substring matching, kind include/exclude filters, hover-info, body inclusion, `max_answer_chars` truncation. One shortening stage: name-paths grouped by file.
- `find_referencing_symbols` — find all symbols referencing a given symbol, with surrounding code context per reference. Three shortening stages: references without context lines, per-file reference counts, total count string.
- `restart_language_server` (optional) — restarts the LSP process for the current project.

#### Symbol editing (LSP backend, default-enabled)

- `replace_symbol_body` — replace the full definition of a named symbol.
- `insert_after_symbol` / `insert_before_symbol` — insert content relative to a named symbol boundary.
- `rename_symbol` — rename a symbol throughout the codebase via LSP `workspace/rename`.
- `safe_delete_symbol` — delete a symbol only if it has no references; returns reference list otherwise.

#### File system (default-enabled)

- `read_file` — read a file with optional line-range slicing and `max_answer_chars` cap.
- `list_dir` — list directory contents with recursive option.
- `find_file` — glob-based file search respecting `.gitignore`.
- `search_for_pattern` — regex pattern search across the project with context lines and glob include/exclude filters. Three shortening stages: match-line numbers per file, match counts per file, total summary.
- `create_text_file` — create or overwrite a file.
- `replace_content` — regex or literal replacement within a file.
- `delete_lines` (optional), `replace_lines` (optional), `insert_at_line` (optional) — line-level editing fallbacks.

#### Memory (default-enabled)

- `write_memory`, `read_memory`, `list_memories`, `delete_memory`, `rename_memory`, `edit_memory` — flat markdown files under `.serena/memories/` (project-scoped) or a global path. Hierarchy is expressed via `/`-separated name paths (e.g. `auth/login/logic`). UTF-8 encoded. No vector embeddings, no TTL, no eviction. `edit_memory` supports literal and regex replacement modes (verified from `memory_tools.py`).

#### Configuration and workflow (default-enabled)

- `activate_project`, `remove_project` (optional), `get_current_config` — runtime project management.
- `check_onboarding_performed`, `onboarding`, `initial_instructions` — bootstrap workflow. `initial_instructions` serves the Serena system prompt to clients that do not receive it at connection time (verified from `workflow_tools.py`).
- `execute_shell_command` — shell escape hatch; `cwd` defaults to project root; `capture_stderr` toggle; `max_answer_chars` cap; gated behind `ToolMarkerCanEdit`.
- `open_dashboard` (optional) — opens the Flask web dashboard in the default browser.

#### Cross-project queries (optional)

- `list_queryable_projects`, `query_project` — execute a read-only Serena tool against a different registered project. For LSP-backend symbolic tools this routes through a `ProjectServerClient` subprocess; for non-symbolic read-only tools it instantiates the project directly (verified from `query_project_tools.py`).

#### JetBrains backend (optional, parallel set)

10 optional tools that replace or augment the LSP-backed symbolic tools using JetBrains IDE API calls via `JetBrainsPluginClient`: `jetbrains_find_symbol`, `jetbrains_get_symbols_overview`, `jetbrains_find_referencing_symbols`, `jetbrains_rename`, `jetbrains_move` (beta), `jetbrains_inline_symbol` (beta), `jetbrains_safe_delete` (beta), `jetbrains_type_hierarchy`, `jetbrains_find_declaration`, `jetbrains_find_implementations`. Requires a running JetBrains IDE with the Serena plugin. The JetBrains variants all implement the same `max_answer_chars` / progressive-fallback pattern as the LSP variants (verified from `jetbrains_tools.py`). `jetbrains_find_symbol` additionally supports `search_deps=True` to search dependencies — a capability the LSP backend does not expose.

#### Deleted tools (ToolRegistry blocklist)

Five tool names are permanently removed from the registry and return an error if invoked: `think_about_collected_information`, `prepare_for_new_conversation`, `summarize_changes`, `think_about_whether_you_are_done`, `switch_modes` (verified from `tools_base.py` `ToolRegistry._deleted_tools`). This implies these were present in earlier versions and removed during the v1.0 → v1.1 cycle.

#### Token budget mechanism

Every tool that produces potentially large output accepts a `max_answer_chars` parameter (default `150_000`, configurable in `SerenaConfig`; verified from `src/serena/config/serena_config.py` line 693). The `Tool._limit_length()` method (verified from `src/serena/tools/tools_base.py`) enforces this limit and, for tools that define them, tries a sequence of progressively shorter fallback closures before returning an error. For example, `find_symbol` falls back from full symbol JSON to a path-to-name-paths mapping; `find_referencing_symbols` falls back in three stages; `search_for_pattern` falls back in three stages. This is a best-effort character cap; it does not guarantee token budget compliance because character-to-token ratio varies by content.

Tool usage statistics are recorded per call via `agent.record_tool_usage()` using a pluggable `TokenCountEstimator` (verified from `src/serena/analytics.py`). Three estimator implementations exist: `CharBasedTokenCountEstimator` (default), `TiktokenTokenCountEstimator` (uses `tiktoken`), and `AnthropicAPITokenCountEstimator` (uses the Anthropic Messages API count-tokens endpoint). Note: unlike claimed in the prior triage, `tiktoken` and `anthropic` are both in the main `dependencies` in `pyproject.toml` (not optional extras) — they are always installed. Statistics are viewable in the Flask web dashboard.

### Dependencies

- Python 3.11–3.14; `uvx serena` (ephemeral) or `pip install serena-agent`. (verified from `pyproject.toml`: `requires-python = ">=3.11, <3.15"`)
- Main dependencies (all pinned in `pyproject.toml`): `mcp==1.26.0` (FastMCP), `pydantic==2.12.5`, `sensai-utils==1.5.0`, `tiktoken==0.12.0`, `anthropic==0.59.0`, `flask==3.1.3` (dashboard), `pyright==1.1.403` (bundled, default Python LSP), `jinja2==3.1.6` (prompt templates), `docstring_parser==0.17.0` (MCP parameter extraction), `pathspec==0.12.1` (gitignore handling), `oraios-pywebview==6.2` (GUI log window), `pygls==2.1.1` (used for the custom mSL language server implementation). `tiktoken` and `anthropic` are NOT optional extras — they are in main dependencies and always installed (verified from `pyproject.toml`).
- First-party packages shipped in the wheel: `src/serena` (MCP server + tools + agent), `src/solidlsp` (LSP subprocess manager), `src/interprompt` (Jinja-based multilingual prompt templating). `interprompt` is a Serena-internal package, not a separate PyPI dependency.
- Optional extras: `agno` extra adds `agno==2.5.10` and `sqlalchemy==2.0.41` for Agno AI framework integration; `google` extra adds `google-genai==1.27.0`.
- LSP backend: 55 language-server modules in `src/solidlsp/language_servers/` covering Python (pyright, jedi, ty), Rust (rust-analyzer), Go (gopls), Java (eclipse-jdtls), C/C++ (clangd, ccls), TypeScript/JavaScript, Ruby (ruby-lsp, solargraph), PHP (intelephense, phpactor), Kotlin, Scala, Haskell, Elixir, OCaml, Lua (lua-ls, luau-lsp), Nix, Swift (sourcekit-lsp), Zig (zls), Terraform, YAML, TOML, Markdown, Solidity, PowerShell, R, Julia, Groovy, Dart, Crystal, Erlang, Elm, F#, Fortran, Haxe, HLSL, Lean 4, MSL (custom pygls-based server), Pascal, Perl, Regal (Rego), SystemVerilog, VTS, Vue, AL, Ansible, Bash, Clojure, MATLAB (55 distinct language module entries counting `elixir_tools/` and `omnisharp/` subpackages; verified by directory enumeration). Each external language server is a separately installed binary.
- JetBrains backend: requires a running JetBrains IDE with the Serena plugin (commercially licensed, free trial available); not suitable for CI or headless environments.

### Scope / limitations

- **LSP server quality is the ceiling.** Symbol resolution accuracy is bounded by the underlying language server. Pyright (Python) and rust-analyzer (Rust) provide high-fidelity results; many of the 55 servers have varying quality.
- **Memory is flat markdown, not searchable.** There is no BM25 or semantic search over memories. Agents must `list_memories` and then `read_memory` by name; there is no query-by-content path.
- **No cross-session memory synchronisation.** Memory files live on the local filesystem; no replication, versioning, or conflict resolution is provided.
- **Character cap is not a token budget.** The `max_answer_chars` mechanism prevents runaway responses but does not enforce a hard token limit. A 150 k-character JSON response still consumes significant tokens.
- **JetBrains capabilities exceed LSP capabilities.** Type hierarchy, find-declaration, find-implementations, move, and inline symbol are JetBrains-only. The LSP backend cannot replicate these without corresponding LSP request support from the underlying server.
- **`execute_shell_command` has no sandbox.** The tool executes arbitrary shell commands in the project root. No allowlist or sandbox is enforced beyond the agent-level `ToolMarkerCanEdit` gating.
- **Cold start on large projects.** The first `request_full_symbol_tree` call after server launch sends `textDocument/documentSymbol` for every source file. For large projects this can take seconds; the two-tier cache eliminates the cost on subsequent calls for unchanged files.

---

## Benchmark claims — verified vs as-reported

| Metric | Value | Status |
|---|---|---|
| "Operates faster, more efficiently and more reliably, especially in larger and more complex codebases" | Qualitative, README | as reported — no quantitative benchmark provided |
| "Support for over 40 programming languages" | 55 language-server modules found in source | verified from source (exceeds claimed figure) |
| 22 736 GitHub stars | Fetched from GitHub API 2026-04-10 | verified from source |
| 1 523 forks | Fetched from GitHub API 2026-04-10 | verified from source |
| v1.0.0 released 2026-04-03 | Confirmed via GitHub releases API | verified from source |
| Token efficiency vs line-based approaches | No benchmark harness found | unverified — no test, no script, no numeric comparison in repo |

No token-reduction benchmark harness exists in the repository. The `analytics.py` module provides per-call token usage recording (char-based or tiktoken), but there is no script that compares Serena's token consumption against a line-based or grep-based baseline.

---

## Architectural assessment

### What's genuinely novel

1. **Symbol-path abstraction over line numbers.** The name-path scheme (`MyClass/my_method`) is stable across edits within a session. An agent can retrieve a symbol's location, make other edits elsewhere in the file, and then use the original name-path for a subsequent edit without re-fetching the symbol. This is a property that raw line-number-based tools cannot offer, and it is implemented correctly via LSP's own symbol identity (verified from `LanguageServerSymbolRetriever` and `CodeEditor.replace_body`).

2. **Progressive fallback on oversized results.** The `_limit_length` + `shortened_result_factories` pattern is a practical mechanism for keeping tool responses within budget without failing hard. Tools define ordered fallback closures (full JSON → depth-0 JSON → kind counts → summary string), and the framework tries them in sequence. This is not present in any other tool in this survey.

3. **Composable mode/context configuration.** The YAML-driven mode system lets operators enable/disable tool groups, override tool descriptions, and inject custom system-prompt fragments — all without code changes. A `single_project` context flag replicates IDE-assistant behaviour. This is richer than the tool-toggle patterns used by other MCP servers in this survey.

4. **Two-tier LSP symbol cache.** Raw LSP document symbols are cached to disk (pickle, keyed on file content hash); the higher-level parsed `DocumentSymbols` are cached in memory. This eliminates the per-call LSP round-trip for unchanged files, amortising the cold-start cost over a session.

5. **Dual backend (LSP + JetBrains) under a single interface.** The `LanguageBackend` enum and `CodeEditor` / `LanguageServerCodeEditor` / `JetBrainsCodeEditor` hierarchy present a uniform interface to tools regardless of which backend is active. Switching backends is a config change, not a code change.

### Gaps and risks

- **No numeric evidence for efficiency claims.** The README's "faster, more efficiently" language is not backed by any benchmark in the repository. For evaluation purposes, the token savings must be inferred from the architectural argument (symbol lookup returns a few hundred bytes vs. reading a full file), not from measured data.
- **Memory system is rudimentary.** Flat markdown files with name-based lookup are sufficient for simple note-taking but scale poorly. There is no search, no TTL, no size limit beyond `default_max_tool_answer_chars`, and no concept of staleness. For long-lived agents operating across many sessions, memory management becomes a manual maintenance burden.
- **LSP cold-start latency is unmitigated at project open.** The two-tier cache helps for subsequent calls, but the first full symbol tree traversal after activating a large project can be slow. No warm-up mechanism or lazy loading is documented.
- **JetBrains plugin is commercially gated.** The plugin requires a paid license (free trial available). This makes the richer JetBrains-only capabilities (type hierarchy, move, inline) unavailable for CI, Docker, or open-source-only environments.
- **Tool surface area is large and partially optional.** With 9 tool modules, dual backends, 5 config levels, and composable modes, the configuration space is complex. The default context may expose or hide different tools depending on the client, making reproducibility across environments non-trivial.
- **`execute_shell_command` security posture.** No sandboxing. The tool is `ToolMarkerCanEdit`-gated (can be excluded from a mode) but when enabled it is an unrestricted shell. This is a known risk for untrusted codebases.

---

## Recommendation

**Adopt for language-aware code navigation and editing in agent sessions.** The LSP-backed symbol-path abstraction is the strongest verified differentiator in this survey: it reduces the context surface for structural edits and makes edits resilient to line-shift within a session. The progressive fallback mechanism for oversized results is a practical production safeguard.

**Do not rely on the memory system for complex session state.** The flat markdown store is adequate for short agent notes and onboarding summaries, but it is not a substitute for a structured memory or RAG system. For agents that need to recall large volumes of project knowledge across sessions, supplement with a dedicated retrieval tool.

**Prefer LSP backend for CI/CD and JetBrains backend for interactive development.** The LSP backend works headlessly and is fully open-source. The JetBrains backend provides richer refactoring capabilities but requires a commercial plugin and a running IDE.

**Do not treat the efficiency claims as benchmarked.** Token savings are architecturally plausible but not experimentally validated in the repository. Measure against your actual workload before relying on the claims for cost projections.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | Serena |
|---|---|
| Approach | LSP-backed symbol-path abstraction; all code queries routed through language servers |
| Compression | Unquantified; architecturally plausible (symbol lookup << full file read); no benchmark harness |
| Token budget model | Per-tool `max_answer_chars` cap (default 150 k chars) with progressive fallback closures |
| Injection strategy | On-demand MCP tool calls; no session-level context injection |
| Eviction | N/A — no context injection pipeline; memory system has no TTL or size limit |
| Benchmark harness | None; `analytics.py` records per-call usage stats but no comparative benchmark script |
| License | MIT |
| Maturity | v1.0.0 (2026-04-03); 22 736 stars; 1 523 forks; active development on main |
