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

## Keeping PUNCHLIST.md accurate

`PUNCHLIST.md` is the canonical queue. Keep it in sync as work progresses.

**Status markers** (defined in the legend at the top of the file):

- `[ ]` — not yet started
- `[~]` — triage in progress (agent running or work underway)
- `[x]` — triage complete; `references/{slug}.md` exists and `REVIEWED.md` row added
- `[-]` — skipped; reason recorded in `REVIEWED.md`

**Rules:**

- Mark an item `[~]` when you start a triage agent for it.
- Mark it `[x]` only after the triage skill has completed and all three artifacts exist: `references/{slug}.md`, a `REVIEWED.md` row, and a `REFERENCE_INDEX.md` row.
- Mark it `[-]` if the tool/paper is out of scope or superseded; add a one-line reason to `REVIEWED.md`.
- Do not remove rows from `PUNCHLIST.md` — the history of what was considered matters.
- If a new tool or paper surfaces during a session, add it as `[ ]` before the session ends.

---

## Promoting a reference to ANALYSIS

A triage (`references/{slug}.md`) is a snapshot based on public documentation. An ANALYSIS goes further: it reads the source code, attempts to reproduce benchmark claims, and produces a verified assessment.

### When to promote

Promote a `pending` reference to an ANALYSIS when any of these apply:

- The tool/paper is a strong candidate for adoption and claims need independent verification.
- Self-reported metrics are unusually high (>80% token reduction, >90% accuracy) with no disclosed methodology.
- The mechanism is novel enough that the architecture warrants a detailed code-level write-up.
- A direct comparison between two or more triaged tools is needed.

Do not promote solely because triage is complete — most references should remain at `pending`.

### Workflow

1. **Vendor the source.** Add the repo as a git submodule into `tools/<slug>/` pinned to the commit examined:
   ```
   git submodule add <repo-url> tools/<slug>
   ```
   Record the pinned commit in the reference frontmatter (`local_clone: ../tools/<slug>`). For large or peripheral repos, link-only is acceptable — note the decision in the reference file.

2. **Read the source.** Focus on: the critical path from agent call to token-reduced output, data structures used to represent context, and any benchmark harness (`benchmarks/`, `eval/`, `tests/`).

3. **Attempt claim reproduction.** Run the disclosed benchmark harness if one exists. Record results in `benchmarks/sources/{slug}-repro.md` (methodology, environment, outcome). Mark results `(verified)` or `(attempted — inconclusive)` as appropriate.

4. **Write `analysis/ANALYSIS-{slug}.md`.** Follow the conventions in "Writing ANALYSIS documents" below.

5. **Update `ANALYSIS.md`.** Add a row to the comparison matrix and a line under "Recommended reading order" if the analysis is worth reading first.

6. **Update `REVIEWED.md`.** Change the status from `pending` to `analysis`.

### What counts as "verified"

- **Verified** — you ran the benchmark harness yourself with a disclosed model, dataset, and environment, and results are within 10% of the reported figure.
- **Partially verified** — the harness ran but on a different dataset or model than the paper/README used.
- **Attempted — inconclusive** — the harness exists but produced errors, missing dependencies, or results that diverge significantly.
- **As reported** — no reproduction attempted; use this for all triage-stage claims.

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
