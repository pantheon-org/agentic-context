---
title: "<Tool name>"
author: "<Author / org>"
date: YYYY-MM-DD
type: reference
tags:
  - tool
  - context-management
  - <compression|tiered-loading|token-budgeting|injection|cli|daemon>
source: "<primary landing page (GitHub / docs / npm / PyPI)>"
source_repo: "<GitHub URL>"
local_clone: "../tools/<repo-name>"
version: "<vX.Y.Z / commit SHA>"
context: "<why we care; what synthesis bucket this supports>"
related:
  - "../ANALYSIS-<tool-analysis-file>.md"
---

# <Tool name>

## TL;DR (3–8 bullets)

- 
- 
- 

## What's novel / different

_What does this do that adjacent tools do not?_

## Architecture overview

### Context representation
_How does the tool model the context window? (flat token stream, markdown vault, structured slots, etc.)_

### Injection mechanism
_How does content get into the context? (system prompt prepend, tool result injection, retrieval, etc.)_

### Compression / summarization
_Any lossy or lossless reduction applied before injection?_

### Eviction / overflow handling
_What happens when context budget is exceeded?_

### Session lifecycle
_How is context state managed across turns / sessions?_

## Deployment model

- Runtime: _(CLI / daemon / library / MCP server / etc.)_
- Language:
- Dependencies:
- Storage:

## Benchmarks / self-reported metrics

_(Quote numbers with source; mark "as reported" for unverified claims.)_

## Open questions / risks / missing details

- 

## Notes

_Corrections, updates, follow-up pointers._
