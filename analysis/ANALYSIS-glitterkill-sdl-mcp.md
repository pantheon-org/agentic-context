---
slug: glitterkill-sdl-mcp
title: "Analysis — sdl-mcp"
date: 2026-04-14
type: analysis
tool:
  name: "sdl-mcp"
  repo: "https://github.com/GlitterKill/sdl-mcp"
  version: "latest (492b5e8)"
  language: "TypeScript"
  license: "source-available (community free use; commercial distribution requires paid license)"
source: ["references/glitterkill-sdl-mcp.md", "tools/glitterkill-sdl-mcp/"]
local_clone: "tools/glitterkill-sdl-mcp/"
reviewed: true
reviewed_date: 2026-04-14
source_reviewed: true
updated: null
---

# ANALYSIS: sdl-mcp

---

## Summary

SDL-MCP is a TypeScript/Node.js MCP server that indexes a codebase into **LadybugDB** (built on [Kuzu](https://kuzudb.com/), an open-source embedded property graph database) and exposes 38 tool surfaces to coding agents. Its two structurally interesting ideas are the **Symbol Card** (a compact ~100-token metadata record per symbol, replacing direct file reads) and the **Iris Gate Ladder** (a five-rung escalation policy with partial protocol enforcement — the top rung is actively gated in source, workflow mode validates all rung transitions). A **Tool Gateway** consolidates 27 legacy flat action tools into 4 namespace-scoped gateway schemas for `tools/list`.

---

## What it does (verified from source)

### Symbol Cards

Every indexed symbol (function, class, interface, type, variable) is stored as a Kuzu `Symbol` node containing (from `src/db/ladybug-schema.ts`): `kind`, `exported`, file location (`rangeStartLine`/`rangeEndLine`), `signatureJson`, `summary`, `summaryQuality` (double), `summarySource` (tracks whether the summary was LLM-generated or auto-derived), `invariantsJson`, `sideEffectsJson`, `roleTagsJson`, fan-in/fan-out/churn metrics, and inline embedding columns for hybrid retrieval.

The `summarySource` field confirms that summary provenance is tracked at the node level. `summaryQuality` (a double 0.0–1.0) is also stored, giving the system a handle for filtering low-quality summaries. The model used to generate summaries and the per-symbol cost are not exposed through any tool or configuration option.

ETag-based conditional re-fetch is implemented as a `CardHash` node in the schema — a stored hash of the card content used to detect staleness and skip unchanged symbols in repeated slice builds (`knownCardEtags` in `slice.build` args).

### Iris Gate Ladder

The ladder is defined in two source files:

**`src/code/gate.ts` — enforces the top rung (`code.needWindow`):**
Implements `evaluateRequest()` which actively evaluates raw-source requests. Checks include:
- Policy limit enforcement: `request.expectedLines > policy.maxWindowLines`, `request.maxTokens > policy.maxWindowTokens`, `policy.requireIdentifiers`
- Identifier matching: if `identifiersToFind` is provided, the window must contain them
- Utility scoring: symbols above `UTILITY_SCORE_THRESHOLD` (0.3) are auto-approved; below threshold, requests are denied with `nextBestAction` guidance pointing to `getSkeleton` or `getHotPath`

Denied requests receive a structured `DenialGuidance` response that includes a concrete alternative tool call (e.g. `sdl.code.getSkeleton`) rather than a generic refusal — this steers the agent toward the correct rung automatically.

**`src/code-mode/ladder-validator.ts` — validates workflow sequences:**
Defines the rung order and validates `sdl.workflow` step sequences:

| Rung | Actions | Notes |
|------|---------|-------|
| 0 | `symbol.search` | Entry — find symbols by name/query |
| 1 | `symbol.getCard`, `slice.build` | Card or task-scoped subgraph |
| 2 | `code.getSkeleton` | Control flow, no full bodies |
| 3 | `code.getHotPath` | Exact lines for named identifiers |
| 4 | `code.needWindow` | Full source window — gated by `gate.ts` |

Warns (or blocks in `enforce` mode) when a workflow step skips more than one rung for the same symbol. Enforcement applies only inside `sdl.workflow` — standalone tool calls are not ladder-validated.

**Enforcement summary**: the top rung (rung 4, `code.needWindow`) is actively gated server-side regardless of mode. Full ladder validation applies inside `sdl.workflow` steps. Outside of workflow mode, agents calling lower rungs (0–3) in arbitrary order are not blocked.

### Tool Gateway

`src/gateway/index.ts` confirms 4 namespace-scoped gateway tools (`sdl.query`, `sdl.code`, `sdl.repo`, `sdl.agent`) with dual-schema registration: a full Zod schema for server-side validation and a `thin-schemas.ts`-built wire schema for `tools/list`. Legacy flat tool names are registered from `src/gateway/legacy.ts` (27 `registerTool` calls from source — the README figure of "32" is inaccurate).

The thin wire schema is explicitly designed to reduce `tools/list` payload size while keeping full validation server-side. The 81% reduction figure (as reported) refers to this registration payload, not session-level token consumption.

### LadybugDB (Kuzu)

`src/db/ladybug-schema.ts` defines the full graph schema as TypeScript Cypher DDL using the [Kuzu](https://kuzudb.com/) embedded graph database. Kuzu is open-source (MIT), embeds in-process with no server, and supports Cypher queries natively — comparable to SQLite's role in relational tooling. The schema is fully readable and versioned (`LADYBUG_SCHEMA_VERSION`), with a migration runner in `src/db/migration-runner.ts`.

Node tables include: `Repo`, `File`, `Symbol`, `Version`, `SymbolVersion`, `Metrics`, `Cluster`, `Process`, `FileSummary`, `SliceHandle`, `CardHash`, `Memory`, `ScipIngestion`, and others. Relationship tables include: `DEPENDS_ON`, `BELONGS_TO_CLUSTER`, `HAS_MEMORY`, `MEMORY_OF`, `PARTICIPATES_IN`, and others.

**Correction from pre-source analysis**: LadybugDB is NOT opaque or proprietary — it is a well-defined Kuzu graph with a versioned TypeScript schema and migration tooling. The prior characterisation was based on README documentation alone.

### Delta Packs & Blast Radius

`src/delta/index.ts` exports `computeDelta`, `computeBlastRadius`, `runGovernorLoop`, and `snapshotSymbols` — all confirmed present in source. `runGovernorLoop` suggests the blast-radius computation has a budget-management loop (a "governor") to prevent unbounded traversal.

### Development Memories (opt-in)

A `Memory` node table and `HAS_MEMORY`/`MEMORY_OF`/`MEMORY_OF_FILE` relationship tables are defined in the schema. `src/memory/` contains `file-sync.ts` and `surface.ts`, suggesting memories can be attached to files as well as the session. The `SyncArtifact` node and the existing CLI `export`/`import` commands suggest memory can be exported across sessions, though the mechanism is not fully documented in the README.

---

## Benchmark claims — verified vs as-reported

Local clone available at `tools/glitterkill-sdl-mcp/` (commit `492b5e8`). Source review performed; harness not executed.

| Claim | Value | Scope | Assessment |
|-------|-------|-------|------------|
| Symbol Card size | ~100 tokens | Per symbol | Schema confirms ~15–20 fields per symbol; 100 tokens is plausible as median. No size distribution in source. |
| Full-file read cost | ~2,000 tokens | Per file | Rough estimate; no methodology in source. |
| Token reduction from cards | ~20× vs file read | Symbol lookup only | Directionally plausible given schema field count vs full-file size. Not measured by any source-accessible harness. |
| Tool Gateway reduction | 81% | `tools/list` payload | Source confirms thin wire schemas are intentionally minimal — mechanism is real. Figure unverified; no schema size measurement in source. |
| Legacy tool count | "32" (README) | Flat tools | **27 registerTool calls in `src/gateway/legacy.ts` from source** — README figure is inaccurate. |
| SCIP edge confidence | 0.95 | Post-SCIP ingest | `ScipIngestion` node confirmed in schema. Confidence value not found in source; likely a data model constant, not a measured recall figure. |
| Real-world benchmark gates | p50 ≥ 50% capped reduction | `benchmarks/real-world/` matrix | Formal gates defined in `CLAIMS.md`; harness confirmed present but not executed. |
| GitHub stars | 125 | As of 2026-04-14 | Verified. |

**Verdict**: the thin-schema gateway mechanism is source-confirmed and real. The Symbol Card schema is richer than the README describes (summaryQuality, summarySource, inline embeddings). A formal real-world benchmark harness exists with claim gates — this is more rigorous than most tools in this survey, though no reproduction has been run.

---

## Architectural assessment

### Strengths

1. **Iris Gate Ladder has meaningful server-side enforcement.** `gate.ts` actively evaluates and denies `code.needWindow` requests that fail policy, identifier-match, or utility-score checks. Denied requests return structured `DenialGuidance` with a concrete alternative tool call — the agent is guided to a cheaper rung rather than simply refused. This is stronger than a prompting convention.

2. **LadybugDB is Kuzu — open, versioned, and queryable.** The prior characterisation of LadybugDB as opaque is incorrect. It is a well-defined Kuzu graph database with a versioned TypeScript DDL schema and a migration runner. Kuzu is MIT-licensed, open-source, and supports Cypher. This removes the main vendor-lock-in risk identified in the triage.

3. **ETag conditional re-fetch is source-confirmed.** `CardHash` nodes store content hashes; `slice.build` accepts `knownCardEtags` to skip unchanged symbols. This is a concrete, implemented token-saving mechanism.

4. **A formal real-world benchmark harness exists with claim gates.** `benchmarks/real-world/CLAIMS.md` defines `p50 ≥ 50%` capped reduction as the formal gate, enforced by `scripts/check-benchmark-claims.ts`. This is more rigorous than any other tool in this survey except rtk.

5. **Delta Packs have a governor loop.** `runGovernorLoop` in `src/delta/blastRadius.ts` prevents unbounded blast-radius traversal — a practical engineering detail absent from the README.

### Weaknesses

1. **LLM-generated summaries: model, cost, and staleness policy are undocumented.** `summaryQuality` and `summarySource` fields exist, but the model used, the per-symbol generation cost, and the threshold for re-generation are not exposed in config or documentation. For large codebases, the initial index cost could be substantial.

2. **Source-available license limits commercial integration.** Commercial embedding requires a paid license with unpublished terms. This is a higher friction point than MIT or Apache-2.0 tools.

3. **12 languages (Rust indexer) is narrow.** codebase-memory-mcp supports 66; tree-sitter tools support 40+. For polyglot repos with languages outside the Rust indexer's scope, the tree-sitter fallback applies but its coverage is uncharacterised.

4. **Ladder validation applies only in `sdl.workflow` mode.** Outside of workflow mode, agents calling lower rungs in arbitrary order are not validated. Only the top rung (`code.needWindow`) is universally gated.

5. **Real-world benchmark has Windows-absolute paths.** `benchmarks/real-world/benchmark.config.json` contains `F:/Claude/projects/...` paths — manual fixup is required to reproduce on macOS/Linux.

6. **Legacy tool count discrepancy.** README claims 32 flat tools; source contains 27. Minor but indicates documentation is not kept in sync with source.

### Comparison to adjacent tools

| | SDL-MCP | codebase-memory-mcp | oraios-serena |
|---|---|---|---|
| Retrieval primitive | Symbol Card (Kuzu node, LLM summary, ETag) | AST node (SQLite, no LLM) | LSP symbol (live, no LLM) |
| Context escalation | Iris Gate Ladder (5 rungs, top rung gated) | None | Progressive fallback on oversize |
| DB | Kuzu (open-source, Cypher, versioned schema) | SQLite (open, accessible) | none (live LSP) |
| Languages | 12 (Rust) + tree-sitter fallback | 66 | 40+ (via LSP servers) |
| License | source-available | MIT | MIT |
| Benchmark harness | Real-world matrix + claim gates (not run) | None (single anecdote) | None |
| Session token claim | p50 ≥ 50% capped (formal gate, unrun) | 99.2% vs grep (as reported) | — |

SDL-MCP's Iris Gate Ladder with server-enforced top rung and Kuzu-backed graph is architecturally more mature than the README suggested. codebase-memory-mcp retains the language coverage and MIT license advantage. oraios-serena wins on live accuracy.

---

## Recommendation

**Watch — strongest escalation model in this survey; benchmark harness exists but unrun.**

Source review upgrades the assessment on two fronts: LadybugDB is Kuzu (open, not opaque) and the Iris Gate is partially enforced server-side (not just a prompting convention). The real-world benchmark harness with formal claim gates is more rigorous than most peers.

Remaining blockers for Adopt: the benchmark harness has not been run here; LLM summary cost is undisclosed; the source-available license restricts commercial use; and ladder enforcement outside of `sdl.workflow` mode relies on agent compliance for rungs 0–3.

**Condition for upgrading to Adopt**: run the real-world benchmark matrix and confirm p50 ≥ 50% capped reduction on a neutral codebase; document LLM summary cost and staleness policy.

---

## Comparison hooks (for ANALYSIS.md matrix)

- **Context escalation model**: Iris Gate Ladder (5 rungs: search → card/slice → skeleton → hot-path → window); top rung gated server-side by `gate.ts`; all rungs validated in `sdl.workflow` mode.
- **Retrieval primitive**: Symbol Card (~100 tokens, LLM-generated summary with `summaryQuality` score, ETag `CardHash` conditional re-fetch).
- **Token saving scope**: `tools/list` 81% (gateway mode, thin wire schema confirmed in source, as reported); no end-to-end session figure; formal real-world benchmark harness unrun.
- **Storage**: LadybugDB on Kuzu (open-source MIT embedded graph DB, Cypher queries, versioned TypeScript DDL schema, migration runner).
- **License risk**: source-available; commercial embedding requires paid license with unpublished terms.
- **Unique value**: Delta Packs with governor loop for bounded blast-radius; ETag `CardHash` skip for unchanged symbols; `DenialGuidance` steers agent to correct rung on gate denial.
- **Source-corrected**: README claims 32 legacy flat tools — source has 27. LadybugDB described as proprietary in README — it is Kuzu (MIT open-source).
