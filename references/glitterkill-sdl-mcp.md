---
title: "sdl-mcp"
author: "GlitterKill"
date: 2026-04-14
type: reference
tags: [tool, mcp, code-intelligence, knowledge-graph, context-compression, context-escalation]
source: "https://github.com/GlitterKill/sdl-mcp"
version: "latest (2026-04-14)"
local_clone: ~
context: "MCP server for coding agents: indexes a codebase into a compact knowledge graph, exposes 38 tool surfaces, and enforces a four-rung context-escalation ladder. Directly relevant to codebase intelligence, token compression, and agent context management."
---

## TL;DR

- MCP server (TypeScript / Node.js 24+) that indexes a codebase into LadybugDB (embedded single-file graph DB), exposing 38 unique tool surfaces over stdio or HTTP.
- Core primitive is the **Symbol Card**: a ~100-token metadata record per symbol (kind, signature, summary, invariants, side-effects, deps, metrics, ETag) versus ~2,000 tokens to read the full file.
- **Iris Gate Ladder** enforces a four-rung context escalation — agents start at the cheapest card view and must justify requests for more complete code, preventing unbounded context expansion.
- **Tool Gateway** consolidates 32 flat action tools into 4 namespace-scoped gateway tools (`sdl.query`, `sdl.code`, `sdl.repo`, `sdl.agent`), reportedly cutting `tools/list` overhead by 81% (as reported, README).
- Rust-native primary indexer (via napi-rs) with tree-sitter fallback; 12 languages supported.
- **SCIP integration**: optional compiler-grade cross-references upgrade heuristic call edges to exact, compiler-verified edges (confidence 0.95).
- Source-available (community free use; commercial distribution requires a commercial license).
- 125 GitHub stars as of 2026-04-14.

## What's novel / different

Most codebase-intelligence MCPs (e.g. codebase-memory-mcp, SocratiCode) surface the full symbol graph with no gating model — agents consume as much context as they request. SDL-MCP's differentiator is the **Iris Gate Ladder**: a four-rung escalation policy that starts every retrieval at the cheapest representation (Symbol Card, ~100 tokens) and requires agent justification to ascend toward raw source. Paired with ETag-based conditional requests (unchanged symbols return a 304-equivalent; no token re-spend), this creates a retrievable, incremental, and policy-enforced context expansion loop. The **Tool Gateway** adds a second compression layer at registration time: 32 flat tool schemas become 4 gateway schemas in `tools/list`, reducing agent startup overhead and tool-dispatch ambiguity. Neither mechanism has been demonstrated independently of the author's own benchmarks.

## Architecture overview

### Core design

```text
Codebase
  └─ Indexer (Rust/napi-rs primary, tree-sitter fallback)
       └─ LadybugDB (embedded single-file graph DB)
            ├─ 38 MCP tool surfaces (flat, gateway, code-mode)
            ├─ 13 CLI commands (sdl-mcp tool, serve, index, init, …)
            └─ HTTP API + graph UI
```

**Symbol Cards** are the atomic retrieval unit. Each card holds: kind, file location, signature, LLM-generated summary, invariants, side-effects, dependency list, fan-in/fan-out/churn metrics, community membership, call-chain role, and an ETag. A pass-2 resolver traces imports, aliases, barrel re-exports, and tagged templates to produce confidence-scored dependency edges.

**Iris Gate Ladder** — four rungs:
1. Symbol Card (~100 tokens) — default; no justification needed.
2. Slice — a task-shaped subgraph (bounded by `max-cards`).
3. Annotated source — full source with inline card annotations.
4. Raw source — full source, requires explicit justification.

**Delta Packs & Blast Radius** — `sdl.delta` computes the semantic change surface for a git diff: which symbol cards changed, which dependents are reachable, and how many tokens the minimal affected context costs.

**SCIP integration** — optional ingestion of a `.scip` index (from scip-typescript, scip-go, rust-analyzer, etc.) upgrades heuristic edges to exact compiler-verified edges and adds `implements` edges and external-dependency nodes.

**Development Memories** (opt-in) — cross-session knowledge persistence backed by the graph; stores task outcomes, architectural decisions, and failure patterns between agent sessions.

**Governance & Policy** — allowlist/denylist per tool surface, policy-gated escalation; intended for team or multi-agent deployments.

### Interface / API

38 tool surfaces across three modes:

| Mode | Tools | Notes |
|------|-------|-------|
| **Flat** | 32 action tools (`symbol.search`, `slice.build`, `delta.compute`, etc.) | Legacy; optionally emitted alongside gateway |
| **Gateway** | 4 namespace tools (`sdl.query`, `sdl.code`, `sdl.repo`, `sdl.agent`) + 4 universal (`sdl.context`, `sdl.workflow`, `sdl.manual`, `sdl.scip.ingest`) | Default; action discriminator field routes internally |
| **Universal** | `sdl.info`, `sdl.usage.stats`, `sdl.action.search`, `sdl.file.read` | Always present |

CLI: `sdl-mcp tool <action> [args]` dispatches through the same gateway router and Zod validation as the MCP server.

### Dependencies

- **Runtime**: Node.js 24+ / TypeScript 5.9+, strict ESM.
- **Graph DB**: LadybugDB (embedded, single-file; not SQLite).
- **Indexer**: Rust binary via napi-rs (primary); tree-sitter + tree-sitter-typescript (fallback).
- **MCP SDK**: `@modelcontextprotocol/sdk`.
- **Validation**: Zod schemas for all payloads.
- **Optional**: SCIP index file (`scip-typescript`, `scip-go`, rust-analyzer, etc.) for compiler-grade edges.
- **Optional**: Embedding model for semantic search tier.

### Scope / limitations

- Language support is 12 languages (via Rust indexer) — fewer than tree-sitter-only alternatives that support 60+.
- LadybugDB is proprietary/embedded; no SQL or Cypher query surface exposed — graph queries are tool-mediated only.
- The 81% token reduction figure applies specifically to `tools/list` registration overhead (gateway vs. flat schema surface), not to overall session token consumption.
- Symbol Card summaries require an LLM pass during indexing; cost and latency at scale are uncharacterised.
- SCIP integration requires an external compiler/indexer toolchain not bundled with the package.
- No containerised deployment documented; HTTP mode is listed as "dev/network" transport.
- Source-available license prohibits embedding in commercial products without a paid commercial license; this affects integration into paid dev-tool products.
- No publicly reproducible benchmark harness; all figures are from the README.

## Deployment model

- **Runtime**: Node.js 24+; install via `npm install -g sdl-mcp` or `npx`.
- **Platforms**: macOS, Linux, Windows (Node.js-portable).
- **Storage**: LadybugDB single-file graph (path configurable); no external DB service required.
- **Transport**: stdio (agents) or HTTP (dev/network).
- **Live indexing**: optional `--watch` mode on `sdl-mcp index` for real-time re-indexing.
- **Multi-agent**: not explicitly documented; single-file DB may limit concurrent write safety.

## Benchmarks / self-reported metrics

All figures from the README unless otherwise noted. None independently verified.

| Claim | Value | Notes |
|-------|-------|-------|
| Tool Gateway token reduction | 81% | `tools/list` overhead; gateway (4 tools) vs. flat (32 tools) (as reported, README) |
| Symbol Card size | ~100 tokens | Per symbol, vs. ~2,000 tokens to read full file (as reported, README) |
| SCIP edge confidence | 0.95 | Compiler-verified edges after SCIP ingest (as reported, README) |
| GitHub stars | 125 | As of 2026-04-14 |

No end-to-end session-level token savings figure is provided in the README. The 81% figure is scope-limited to `tools/list` payload size, not total agent token consumption.

## Open questions / risks / missing details

- No end-to-end benchmark: what is the total session-level token reduction when using SDL-MCP vs. no code-intelligence MCP? The 81% figure covers only tool registration overhead.
- Symbol Card summaries are LLM-generated during indexing — what model is used, at what cost, and how are stale summaries detected and refreshed?
- LadybugDB is an opaque embedded store: no documented schema, no migration tooling mentioned, no recovery path for a corrupted graph file.
- "12 languages" for the Rust indexer is listed without naming them; falling back to tree-sitter is mentioned but the fallback scope is unspecified.
- Development Memories (opt-in, cross-session) stores architectural decisions in the graph — no encryption, access-control, or export/import documented.
- Commercial license required for embedding in paid products; pricing and terms are not public in the repo (contact required).
- No third-party evaluation or citation; all benchmark figures are author-run on unspecified repos.
- The Iris Gate Ladder's effectiveness depends on agent compliance with the gating protocol — no enforcement mechanism is documented beyond tool-level prompting.
