---
title: "git-semantic-bun"
author: "danjdewhurst"
date: 2026-04-10
type: reference
tags: [tool, cli, semantic-search]
source: "https://github.com/danjdewhurst/git-semantic-bun"
version: "1743d3e9 (2026-02-26)"
context: "Peripheral — semantic search over git history (commit messages); useful as a retrieval primitive but not a context management or token-reduction tool."
---

## TL;DR

- CLI tool that builds a semantic vector index over a git repository's commit history; enables natural-language search over past commits.
- Core use case: `gsb search "fix race condition in auth token refresh"` — returns semantically matching commits without requiring exact keyword matches.
- Built with Bun (TypeScript); requires Bun >= 1.3.9; prebuilt binaries for macOS, Linux, and Windows.
- Incremental: `gsb update` indexes only new commits; `gsb serve` runs a warm search daemon (stdin/stdout) for low-latency repeated queries.
- Local-only; no cloud dependency; stores index alongside the repo.
- 3 GitHub stars; MIT license; last commit 2026-02-26.

## What's novel / different

Git history search is usually keyword-only (`git log --grep`). git-semantic-bun builds an embedding index over commit messages, enabling intent-based retrieval ("when did we fix the login race condition?") rather than exact-term matching. The daemon mode (`gsb serve`) amortises embedding model load time across queries, which matters if used programmatically by an agent. Compared to tools like `git log --grep` or GitHub search, it trades zero-setup simplicity for semantic recall. Among tools in this repo, it occupies a unique niche — retrieval from version control history — rather than from live source files.

## Architecture overview

### Core design

- `gsb init` — initialises index directories and records model metadata.
- `gsb index` — iterates git commits, computes embeddings for commit messages, stores in local vector index.
- `gsb search <query>` — embeds the query and returns ranked matching commits.
- `gsb update` — incremental index extension for new commits.
- `gsb serve` — keeps model warm in memory; accepts queries via stdin, returns results on stdout.
- `gsb benchmark` — measures ranking performance on a query set.

### Interface / API

CLI only. No MCP server, no library API documented. Integration with an agent would require subprocess invocation or the serve daemon via stdin/stdout.

### Dependencies

- Runtime: Bun >= 1.3.9
- Language: TypeScript
- Embeddings: local (model not specified in README)
- Storage: local index files (format not documented)

### Scope / limitations

- Indexes only commit messages — not commit diffs, file contents, or PR descriptions.
- Embedding model not specified; quality of semantic search depends on model choice.
- No MCP integration — requires subprocess or custom wrapper to use from an agent.
- Very early-stage: 3 stars, no stable release noted, last commit February 2026.
- No benchmarks beyond the `gsb benchmark` utility (which requires a user-provided query set).

## Deployment model

- Runtime: Bun >= 1.3.9, local machine
- Install: `bun add -g github:danjdewhurst/git-semantic-bun` or prebuilt binary from Releases
- Storage: local index directory (path not specified)

## Self-reported metrics

- No quantitative claims in README.

## Open questions

- Which embedding model is used by default? Is it local (bundled) or requires external?
- Index format and portability across machines not documented.
- No MCP server — would require wrapping to integrate with Claude Code workflows.
- Very low adoption (3 stars); long-term maintenance uncertain.
- Scope note: borderline for this research repo — covers retrieval from git history rather than context window management or codebase intelligence. Included as a peripheral retrieval primitive.
