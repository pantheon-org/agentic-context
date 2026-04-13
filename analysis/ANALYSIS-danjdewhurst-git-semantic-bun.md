---
slug: danjdewhurst-git-semantic-bun
title: "Analysis — git-semantic-bun"
date: 2026-04-10
updated: 2026-04-13
type: analysis
tool:
  name: "git-semantic-bun"
  repo: "https://github.com/danjdewhurst/git-semantic-bun"
  version: "0.5.0 (vendored at 1743d3e9, 2026-02-26)"
  language: "TypeScript"
  license: "MIT"
source: "references/danjdewhurst-git-semantic-bun.md"
local_clone: null
reviewed: false
reviewed_date: null
source_reviewed: true
---

# ANALYSIS: git-semantic-bun

---

## Summary

git-semantic-bun is a Bun/TypeScript CLI (v0.5.0) that builds a local vector index over a git repository's commit messages and enables natural-language semantic search over that history. It fills a real gap — `git log --grep` is exact-match only; this tool enables intent-based queries ("when did we fix the login race condition?") without requiring exact keyword matches. However, it is peripheral to this research repo's core mandate (context management and token reduction), has no MCP server, requires subprocess integration to use from an agent, and is very early-stage (3 GitHub stars, no stable release). The daemon mode (`gsb serve`) is the strongest architectural feature: it amortises embedding model load time across repeated queries, which is necessary for programmatic agent use.

Source review confirms the triage was largely accurate. Several gaps identified in the triage have been resolved in the source: the embedding model is now identified (`Xenova/all-MiniLM-L6-v2`), the index format is fully documented and verified, ranking is a hybrid system (not pure semantic), and an extensible plugin API is present. The "no MCP server" claim remains correct.

---

## What it does

### Core workflow (verified)

1. `gsb init` — initialises the local index directory (`.git/semantic-index/`) and writes model metadata. (verified: `src/commands/init.ts`, `src/core/paths.ts`)
2. `gsb index` — iterates git commits, computes embeddings for each commit message (plus file paths and optionally patch text), and stores results in a compact sidecar index. (verified: `src/commands/index.ts`, `src/core/indexing.ts`)
3. `gsb search <query>` — embeds the query string and returns ranked commits by hybrid score (semantic + BM25 + recency). (verified: `src/commands/search.ts`)
4. `gsb update` — incremental re-index covering only commits added since the last run; includes rebase/force-push detection. (verified: `src/commands/update.ts`)
5. `gsb serve` — runs a warm search daemon (stdin/stdout protocol, JSONL mode available); keeps the embedding model and index in memory across queries; supports `:reload` and `:quit` interactive commands. (verified: `src/commands/serve.ts`, `docs/serve-daemon.md`)
6. `gsb stats` — reports index size, commit count, vector dtype, timestamps, and load time. (verified: `src/commands/stats.ts`)
7. `gsb doctor` — environment and dependency checks; `--fix` performs safe, non-destructive repairs. (verified: `src/commands/doctor.ts`)
8. `gsb benchmark` — benchmarks ranking path (baseline full-sort vs heap top-k); supports `--ann` to compare exact vs ANN recall + speedup; `--save` / `--history` for run history; `--compare-model` for multi-model comparison. (verified: `src/commands/benchmark.ts`)

### Interface / API (verified)

CLI only. No MCP server and no library API are publicly documented for end-users. However, the package exports all command runners from `src/index.ts` and exports a full plugin type API from `src/plugin-export.ts` (`git-semantic-bun/plugin`). Agent integration requires either subprocess invocation of `gsb search` per query, or a persistent session against the `gsb serve` daemon via stdin/stdout.

### Plugin system (not mentioned in triage — found in source)

A complete plugin system is implemented and documented (`docs/plugins.md`, `src/core/plugin-types.ts`). Plugins can override or extend:

- Embedding model (`createEmbedder`)
- Search strategy (`createSearchStrategy`)
- Scoring signals (additive extra dimensions)
- Output formatters (custom `--format` values)
- Commit filters
- Lifecycle hooks (`preSearch`, `postSearch`, `preIndex`, `postIndex`)
- Additional CLI commands (`registerCommands`)

Discovery is from `.gsb/plugins/*.ts` (repo-local), `~/.gsb/plugins/*.ts` (global), and `gsb-plugin-*` npm packages. Configuration via `.gsbrc.json`. This is a non-trivial extensibility layer that enables wrapping alternative embedding backends (the docs show an `ollama` example).

### Dependencies (verified)

- Runtime: Bun >= 1.3.9 (verified: `package.json` `engines` field)
- Language: TypeScript
- Embeddings: `@xenova/transformers` ^2.17.2 — Transformers.js; default model `Xenova/all-MiniLM-L6-v2` (verified: `src/core/constants.ts`, `src/core/embeddings.ts`)
- Storage: `.git/semantic-index/` sidecar directory — compact binary format with separate `index.meta.json` and `index.vec.f32` / `index.vec.f16` files (verified: `src/core/index-store.ts`)
- Optional: `usearch` ^2.16.0 for HNSW approximate nearest-neighbour index (verified: `package.json` `optionalDependencies`)

---

## Source review

### Architecture

The tool follows a clean layered architecture:

```text
src/
  cli.ts              — Commander.js entry point; registers all subcommands
  index.ts            — public library exports (all command runners)
  plugin-export.ts    — public type exports for plugin authors
  commands/           — one file per CLI command
  core/
    embeddings.ts     — Transformers.js wrapper; GSB_FAKE_EMBEDDINGS=1 for tests
    index-store.ts    — load/save; v1 (legacy JSON) and v2 (compact binary sidecar)
    vector-search.ts  — ExactSearch (cosine brute-force) and AnnSearch (usearch HNSW)
    ranking.ts        — BM25 scores, recency decay, weight combination
    bm25.ts           — BM25 tokeniser (k1=1.5, b=0.75) and term-frequency helpers
    lexical-cache.ts  — per-checksum BM25 stats cache (FIFO, capacity 4)
    similarity.ts     — cosine similarity on pre-normalised vectors (dot product)
    topk.ts           — min-heap O(n log k) top-K selection
    types.ts          — core type definitions
    constants.ts      — DEFAULT_MODEL, DEFAULT_LIMIT, ANN_COMMIT_THRESHOLD (10k)
    plugin-*.ts       — plugin registry, loader, config, types
    perf-guardrails.ts — regression threshold logic
```

### Critical path: semantic search

1. `gsb search <query>` calls `runSearch()` in `src/commands/search.ts`.
2. Index is loaded from `.git/semantic-index/<model-key>/index.meta.json` + `index.vec.{f32,f16}` (compact v2 format). Embeddings are lazily decoded on first access (getter pattern in `loadCompactIndex`).
3. `createEmbedder()` initialises the Transformers.js pipeline for `Xenova/all-MiniLM-L6-v2` (or plugin-provided model). Model is downloaded to `.git/semantic-index/cache/` on first use.
4. Pre-search plugin hooks run (can rewrite query or filters).
5. Commits are filtered by author/date/file if requested.
6. Query is embedded via `embedder.embedBatch([query])`, then L2-normalised.
7. Vector search: `ExactSearch` computes cosine similarity (dot product of unit vectors) for all filtered commits; `AnnSearch` uses the usearch HNSW index with 10x overfetch, then falls back to exact if filtered ratio < 10% or ANN returned < k results.
8. BM25 lexical scores are computed (or retrieved from the per-checksum cache) for the filtered commit set.
9. Hybrid re-ranking: `finalScore = semantic * 0.75 + lexical * 0.20 + recency * 0.05` (default weights; all configurable). Plugin scoring signals are added additively.
10. Top-K results selected with min-heap (O(n log k)); filtered by `--min-score`.
11. Post-search plugin hooks run (can transform results).
12. Output rendered in text, markdown, or JSON format (or plugin formatter).

### Data structures

- `IndexedCommit`: `{ hash, author, date, message, files[], embedding: number[] }` — the core unit stored per commit.
- `SemanticIndex` (v1 in-memory): array of `IndexedCommit` plus metadata.
- Compact index (v2 on-disk): `index.meta.json` (commit metadata with `vectorOffset` pointers) + `index.vec.f32` or `index.vec.f16` (flat binary array of all embeddings). Float16 is implemented in pure TypeScript via manual bit manipulation — no native half-float support in Bun/JS.
- ANN index: `index.ann.usearch` — HNSW graph built by the `usearch` native module (IP/inner-product metric, connectivity=16).

### Embedding model (was unknown in triage — now verified)

Default model: `Xenova/all-MiniLM-L6-v2` (verified: `src/core/constants.ts`). This is a 22M-parameter sentence-transformer producing 384-dimension embeddings. It is downloaded by Transformers.js on first `gsb init` / `gsb index` and cached locally. The model can be overridden with `--model <name>` at init/index time; multiple model indexes can coexist under separate `models/<model-key>/` subdirectories.

### Index format and portability (was undocumented in triage — now verified)

Index lives entirely under `.git/semantic-index/`. The compact v2 format separates commit metadata (JSON) from embedding vectors (raw binary). Checksums (SHA-256 over commit metadata) guard against silent corruption. The `repositoryRoot` is stored in the index; portability across machines depends on whether the path is reconstructed correctly. The checksum validation will catch cross-machine corruption but not explicit path differences.

### Performance CI harness (verified)

`scripts/perf-ci.ts` is a performance regression harness that runs against a 5,000-commit synthetic dataset (32-dimension fake vectors via `GSB_FAKE_EMBEDDINGS=1`). It measures three suites: cold search (load + embed + search), warm search (model pre-loaded), and index load. Baselines and regression thresholds are stored in `.github/perf-baseline.json`. From the committed baseline: cold p50 = 8.7 ms, warm p50 = 1.5 ms, index load p50 = 4.0 ms (5k commits, 32-dim fake vectors — not real-world embedding latency). The `bun run perf:ci` command runs this suite against the baseline and fails CI on regression.

---

## Architectural assessment

### What is genuinely useful

- **Semantic over exact (verified)**: The only in-repo tool targeting retrieval from version control history. Hybrid ranking (semantic + BM25 + recency) is better-designed than pure vector search alone — the BM25 fallback matters for exact function names and error codes.
- **Incremental indexing (verified)**: `gsb update` stays current without full re-build; includes rebase/force-push detection.
- **Daemon mode for amortised latency (verified)**: `gsb serve` keeps model and index in memory; JSONL output makes it scriptable. The daemon documents a shell coproc integration pattern directly.
- **Local-only with known model (verified)**: `Xenova/all-MiniLM-L6-v2` via Transformers.js. No API key, no cloud dependency.
- **Plugin extensibility (not in triage)**: The `GsbPlugin` interface is comprehensive. A plugin can provide a full alternative embedding backend (e.g. Ollama), making the Bun + Transformers.js dependency optional in practice. This significantly reduces the integration barrier for projects that already have a local model server.
- **ANN backend (not in triage)**: HNSW via usearch scales to 10k+ commits without configuration change.
- **f16 storage (partially mentioned in triage)**: Float16 implemented in pure TypeScript; halves index disk usage.
- **Performance CI (not in triage)**: Regression guardrails on cold/warm search and index load times.

### Gaps and risks

- **Commit messages by default (partially corrected)**: The index covers commit message text and file paths by default. Opt-in `--full` mode adds patch text. The triage claim that "diffs are not indexed" overstates the limitation; file paths are always included and patches are available.
- **No MCP server (verified)**: No MCP integration. Using from Claude Code requires a subprocess wrapper or stdin/stdout adapter. The plugin system provides hooks but not an MCP transport.
- **Very early-stage (verified)**: v0.5.0, 3 GitHub stars, single maintainer. Long-term maintenance uncertain.
- **Real-world embedding latency not benchmarked**: The perf CI uses fake 32-dim embeddings. Actual `Xenova/all-MiniLM-L6-v2` produces 384-dim vectors and runs in-process via Transformers.js; warm query latency in production will be higher than the 1.5 ms CI figure.
- **Bun dependency (verified)**: Hard requirement (`engines: { bun: ">=1.3.9" }`). The plugin system can replace the embedding backend but the runtime itself is not pluggable.
- **No published semantic recall benchmarks**: `gsb benchmark` measures ranking latency (full-sort vs heap top-k) and ANN recall vs exact, but no semantic recall figures against a labelled commit search dataset are published.

---

## Triage claim review

| Triage claim | Status | Notes |
|---|---|---|
| "CLI only. No MCP server." | verified | Confirmed in source. Plugin system adds hooks but no MCP transport. |
| "Embeddings: local (model not specified)" | corrected | Model is `Xenova/all-MiniLM-L6-v2` via `@xenova/transformers`. Verified in `src/core/constants.ts` and `package.json`. |
| "Storage: local index files (format not documented)" | corrected | Format fully documented in source: compact binary sidecar (v2), checksum-backed. See `src/core/index-store.ts`. |
| "Indexes only commit messages" | partially corrected | Default indexes message + file paths. Opt-in `--full` mode adds patch text. |
| "gsb benchmark requires user-provided query set" | corrected | `gsb benchmark` takes a query string directly; no external dataset required. It benchmarks ranking latency and ANN recall, not semantic quality. |
| "No benchmarks beyond gsb benchmark" | corrected | `scripts/perf-ci.ts` is a full CI performance harness with baselines. Synthetic data only. |
| "Bun >= 1.3.9 required" | verified | Confirmed in `package.json`. |
| "Incremental: gsb update indexes only new commits" | verified | Confirmed in `src/commands/update.ts`. |
| "gsb serve warm daemon (stdin/stdout)" | verified | Confirmed; also supports JSONL mode and `:reload` command. |
| "MIT license" | verified | Confirmed in `package.json` and `LICENSE`. |
| "Plugin system" | not in triage — found in source | A comprehensive plugin API exists: `GsbPlugin` interface in `src/core/plugin-types.ts`, exported via `git-semantic-bun/plugin`. Fully documented in `docs/plugins.md`. |
| "ANN backend (usearch HNSW)" | not in triage — found in source | Optional `usearch` dependency for repositories > 10,000 commits. Auto-activates. |

---

## Scope assessment

git-semantic-bun is **peripheral** to this research repo's core mandate. The repo focuses on context management, token reduction, and codebase intelligence within the Claude Code session. git-semantic-bun is a retrieval primitive for version control history — useful as an input to a research or debugging workflow, but it does not manage context, reduce token usage, or integrate with the MCP layer.

The plugin system is more mature than the triage suggested, and it meaningfully lowers the embedding backend barrier. However, the absence of an MCP server remains the primary integration obstacle.

It would be relevant as a component of a larger tool (e.g., an MCP server that surfaces semantic commit search alongside file-content search), but is not ready for that role: the missing MCP layer, low maturity, and lack of published semantic recall figures make it a candidate to monitor rather than adopt.

---

## Recommendation

**Do not adopt at this time.** The tool solves a real problem (semantic retrieval from git history) but is too early-stage and too far outside the core scope to justify integration effort. The minimum bar for adoption would be:

1. MCP server interface, OR a documented subprocess protocol usable from Claude Code without a custom wrapper.
2. Published semantic recall figures on a real commit corpus (not just latency benchmarks on synthetic data).
3. Higher adoption or evidence of active maintenance (the 3-star / single-maintainer risk is real).

**Monitor**: if the project gains adoption and adds MCP support, revisit. The daemon mode design and plugin extensibility (especially custom embedder support) are sound. The hybrid ranking implementation is well-engineered. The problem is genuinely useful for agent-assisted code archaeology.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | git-semantic-bun |
|---|---|
| Approach | Local hybrid vector+BM25+recency index over git commit messages (+ file paths, opt-in patches) |
| Compression | Not applicable (retrieval, not summarization) |
| Token budget model | None |
| Injection strategy | Agent calls `gsb search` or pipes to `gsb serve --jsonl` and injects results manually |
| Eviction | Not applicable |
| Benchmark harness | `scripts/perf-ci.ts` — CI latency harness on 5k synthetic commits; `gsb benchmark` — ranking latency + ANN recall on real index; no semantic recall figures |
| License | MIT |
| Maturity | v0.5.0; 3 stars; last commit 2026-02-26; single maintainer |
| MCP integration | None — subprocess or stdin/stdout wrapper required |
| Plugin API | Yes — `GsbPlugin` interface; custom embedders, search strategies, scoring signals, formatters, hooks |
