---
title: "CodeGraph"
author: "colbymchenry"
date: 2026-04-10
type: reference
tags: [tool, mcp-server, codebase-intelligence]
source: "https://github.com/colbymchenry/codegraph"
local_clone: ../tools/colbymchenry-codegraph
version: "19532a81 (2026-04-08)"
context: "Directly relevant — pre-indexes a codebase into a knowledge graph to reduce Claude Code Explore agent tool calls and tokens."
---

> **README INTEGRITY ISSUE.** The architecture diagrams and the 8.2× token-reduction benchmark table in the upstream README are copied verbatim from `tirth8205/code-review-graph`. The `diagrams/` directory does not exist in this repo (diagram image refs are broken); the eval command cited (`code-review-graph eval --all`) is CRG's CLI, not this tool's. The 94% fewer-tool-calls claim may be genuine — a separate eval runner exists in the test suite (`evaluation/runner.ts`) — but the remainder of the upstream benchmark section is CRG's data presented as this tool's own. **Do not rely on the README benchmark figures without independent reproduction.**

## TL;DR

- Node.js MCP server that pre-indexes a codebase into a Tree-sitter AST-backed SQLite knowledge graph so Claude Code agents query structure instead of scanning files.
- Reports 94% fewer tool calls and 77% faster exploration (as reported, README — provenance uncertain; see integrity notice above).
- 100% local — WASM-bundled tree-sitter and SQLite; no cloud dependency.
- Supports 19 languages + Jupyter notebooks; single MCP tool `codegraph_explore`.
- npm package `@colbymchenry/codegraph` v0.7.2; 412 stars.

## What's novel / different

CodeGraph inserts a pre-built structural index between the agent and the file system. Instead of spawning grep/glob/read calls, the Explore agent calls `codegraph_explore` once and receives blast-radius context: which symbols were touched, what calls them, and what tests cover them. The approach is independent from but architecturally similar to `tirth8205/code-review-graph` — created first (2026-01-18 vs CRG's 2026-02-26), but eclipsed by CRG in adoption. Uniquely, uses WASM-bundled tree-sitter (no native deps) making install completely dependency-free. Lean surface: single MCP tool vs CRG's 22.

## Architecture overview

### Core design

Repository is parsed by Tree-sitter into nodes (functions, classes, imports) and edges (calls, inheritance, test coverage) stored in SQLite. At query time, `codegraph_explore` computes the minimal file set needed for the agent's question via blast-radius traversal.

### Interface / API

Exposed as an MCP server. Configured once via `claude_mcp_config.json`. Key tool: `codegraph_explore`.

### Dependencies

- Runtime: Node.js 18+
- Language: TypeScript
- Parser: Tree-sitter
- Storage: SQLite (local)
- No cloud or external model dependency

### Scope / limitations

- 19 languages documented; coverage beyond those is unspecified.
- Benchmarks run on 6 open-source repos with a single Explore-agent query type — may not generalise to other agent patterns.
- Architecture diagrams and the 8.2× benchmark table in the README are copied from `tirth8205/code-review-graph`; treat upstream README benchmark section as unreliable for this tool.

## Deployment model

- Runtime: Node.js 18+, local machine
- Install: `npm install -g @colbymchenry/codegraph` or `npx`
- Storage: SQLite file in project root
- MCP config: `claude_mcp_config.json`

## Self-reported metrics

- 94% fewer tool calls vs no graph (as reported, README)
- 77% faster exploration on average across 6 codebases (as reported, README)
- Per-repo range: 84–96% fewer tool calls (as reported, README)

## Open questions

- **README provenance (resolved)**: codegraph and CRG are independent tools (neither is a GitHub fork). codegraph was created first (2026-01-18); CRG launched 2026-02-26. The shared README content — architecture diagrams, the 8.2× token-reduction table, and the `code-review-graph eval --all` command — was copied from CRG into codegraph's README. The `diagrams/` directory does not exist in codegraph's repo; the diagram image refs in the README are broken.
- The 94% fewer tool calls / 77% faster figures may be genuine: codegraph has its own TypeScript eval runner (`evaluation/runner.ts`) that tests against `.codegraph/codegraph.db`. But these figures have not been independently reproduced.
- The 8.2× token-reduction table in codegraph's README is CRG's benchmark data, not codegraph's — treat as unreliable for codegraph specifically.
- No stated MRR or recall metric for `codegraph_explore` queries.
- Incremental update latency on large monorepos not documented.
