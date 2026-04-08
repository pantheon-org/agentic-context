# agentic-context — Agent Guide

This `AGENTS.md`/`CLAUDE.md` describes conventions for maintaining this research repository and keeping it clean.

**Instruction precedence**: if this file conflicts with platform/system/developer instructions, follow platform/system/developer instructions.

---

## Project overview

This repo collects, summarizes, and analyzes tooling and papers related to **context management** in agentic LLM systems. The unit of interest is the active context window: what gets in, how it is prioritized, compressed, truncated, and evicted.

---

## Workflows

Use the **`triage-paper`** and **`triage-tool`** skills — they contain the full step-by-step workflows for adding references, triaging systems, updating `REVIEWED.md` and `REFERENCE_INDEX.md`, and vendoring tools.

---

## Writing ANALYSIS documents

These are technical reviews intended for developers familiar with LLM agent systems who have **not** read the source code or paper being analyzed.

### Terminology and naming

- **Context window** — the full token budget available at inference time.
- **Working context** — the portion actively used by the current turn.
- **Injection** — placing content into the context window (system prompt, retrieved chunks, tool results).
- **Compression** — reducing token count while preserving semantics (summarization, distillation, pruning).
- **Truncation** — hard removal of content when budget is exceeded.
- **Eviction** — policy-driven removal of lower-priority content.
- **Tiered loading** — priority-based injection (L0 always-in, L1 on-demand, L2 retrieved).

Use these terms consistently across all documents in this repo.

### Formatting and readability

- Do not collapse distinct items into comma-separated run-on lists.
- Each mechanism, gap, or finding gets its own bullet or table row.
- Keep line items scannable — a reader should understand each bullet independently.
- Quote all benchmark numbers with their source; never paraphrase metrics as if they are your own.

### Audience assumptions

- Readers know what a context window is and have used RAG at least once.
- Readers do **not** know the internal architecture of the tool/paper being analyzed.
- Explain non-obvious design choices; skip basic LLM background.

---

## Research / claim hygiene

- Distinguish clearly between **"as reported"** (paper/tool claims) and **verified** (you ran it or cross-checked).
- Flag unverified benchmarks with `(as reported)`.
- If a claim cannot be verified from the source, note it as a gap, not a fact.

---

## Commits

- Conventional commit messages: `feat:`, `docs:`, `chore:`, `fix:`, `analysis:`.
- One logical change per commit. Do not batch unrelated reference additions.
- Never commit generated BibTeX by hand — use `scripts/` automation.

---

## Meta: Evolving this file

Update this file when conventions change. Keep it short — it must remain readable in one sitting.
