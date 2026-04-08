---
title: "<Full paper title>"
author: "<First author> et al."
date: YYYY-MM-DD
type: reference
tags:
  - paper
  - context-management
  - <compression|tiered-loading|token-budgeting|injection|benchmark|survey>
source: "<primary landing page (arXiv abs / publisher DOI)>"
source_alt: "<PDF link>"
version: "<arXiv vN / camera-ready / etc>"
context: "<why we care; what synthesis bucket this supports>"
related:
  - "../ANALYSIS-<paper-analysis-file>.md"
files:
  - "papers/<paper-id>.pdf"
  - "papers/<paper-id>.md  # optional extracted text snapshot"
---

# <Paper title>

## TL;DR (3–8 bullets)

- 
- 
- 

## What's novel / different

_What does this do that adjacent work does not?_

## Mechanism overview

### Context representation
_How is the context window modeled? (token stream, structured slots, tiered segments, etc.)_

### Compression / injection path
_How is content reduced or selected before injection?_

### Eviction / truncation policy
_What happens when the budget is exceeded?_

### Token budget model
_Hard caps, soft priorities, dynamic adjustment?_

## Evaluation (as reported)

- Benchmark(s):
- Baseline(s):
- Key metric(s):
- Result(s): _(as reported)_

## Implementation details worth stealing

- 

## Open questions / risks / missing details

- 

## Notes

_Corrections, updates, follow-up pointers._
