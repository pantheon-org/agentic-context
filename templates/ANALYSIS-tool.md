---
title: "Analysis — <Tool Name>"
date: YYYY-MM-DD
type: analysis
tool:
  name: "<Tool name>"
  repo: "<GitHub URL>"
  version: "<vX.Y.Z / commit SHA>"
  language: "<Python / TypeScript / Rust / etc>"
  license: "<license>"
source:
  - "references/<tool-reference-summary>.md"
  - "tools/<repo-name>/"
related:
  - "ANALYSIS.md"
---

# Analysis — <Tool Name>

## TL;DR (5–10 bullets)

- 
- 
- 

## Quick facts (for synthesis)

| | |
|---|---|
| Approach | |
| Compression | |
| Token budget model | |
| Session lifecycle | |
| Deployment | |
| Self-reported benchmark | _(as reported)_ |
| Code quality | |

---

## Stage 1 — Descriptive (what the tool does)

### 1.1 Problem it solves (in your words)

### 1.2 Architecture overview

### 1.3 Context representation

_How does the tool model the context window? What are the storage primitives?_

### 1.4 Injection mechanism

- What gets injected and when:
- Priority / ordering logic:
- System prompt structure:

### 1.5 Compression / summarization

- Trigger conditions:
- Method:
- Fidelity / reversibility:

### 1.6 Eviction / overflow handling

- Overflow detection:
- Eviction policy:
- Archival / recovery:

### 1.7 Session lifecycle

- Init / wake:
- Per-turn:
- Checkpoint / sleep:
- Cross-session continuity:

### 1.8 What the tool explicitly does *not* cover

---

## Stage 2 — Evaluative (what it measures, what's missing, what breaks)

### 2.1 Self-reported metrics (as reported)

### 2.2 Independent verification

- Code audit: 
- Benchmark cross-check: 

### 2.3 Strengths

### 2.4 Limitations / risks / missing details

- [ ] 
- [ ] 

### 2.5 Operational complexity

_Deployment dependencies, failure modes, observability._

---

## Stage 3 — Synthesis hooks

### 3.1 Comparison to adjacent tools

### 3.2 Mapping to this repo's themes

| Theme | Relevance | Notes |
|---|---|---|
| Compression | | |
| Tiered loading | | |
| Token budgeting | | |
| Injection | | |

### 3.3 Concrete takeaways (actionable)

- 

---

## Notes / Corrections & Updates

_Date-stamped corrections or follow-up findings go here._
