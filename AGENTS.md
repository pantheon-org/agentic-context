# agentic-context — Agent Guide

This `AGENTS.md`/`CLAUDE.md` describes conventions for maintaining this research repository and keeping it clean.

**Instruction precedence**: if this file conflicts with platform/system/developer instructions, follow platform/system/developer instructions.

---

## Project overview

This repo collects, summarizes, and analyzes tooling and papers related to **context management** in agentic LLM systems. The unit of interest is the active context window: what gets in, how it is prioritized, compressed, truncated, and evicted.

---

## Workflow: Add a new reference

1. Create a new file in `references/` with a stable, descriptive name:
   - Prefer: `<author>-<topic>.md` (e.g. `press-longchat.md`, `ge-llmlingua.md`)
   - For papers: `<firstauthor>-<short-title>.md`
2. Include YAML frontmatter at the top (see `templates/REFERENCE-paper.md` or `templates/REFERENCE-tool.md`).
3. In the body, keep the structure scannable:
   - **TL;DR** (3–8 bullets)
   - **What's novel / different**
   - **Compression / injection / truncation mechanism** (as applicable)
   - **Token budget model** (hard caps, soft priorities, eviction)
   - **Metrics / benchmarks** (quote numbers carefully; include source)
   - **Open questions / risks / missing details**
4. Update `references/REFERENCE_INDEX.md` with a one-line entry.
5. Update `README.md` tables in the same change if adding a notable tool or paper.

---

## Workflow: Add an external tool to `tools/`

1. Clone or snapshot the repo into `tools/<repo-name>/`.
2. Add it as a git submodule if it's actively maintained; otherwise snapshot it with a commit pinned at the examined version.
3. Record the pinned commit/version in the reference summary frontmatter (`local_clone: ../tools/<repo-name>`).
4. Proceed with triage (see below).

---

## Workflow: Triage new systems (`REVIEWED.md`)

All newly examined systems, tools, and papers go through `REVIEWED.md` **first**, unless the user explicitly directs otherwise.

1. Examine the system (clone, read docs, read code as needed).
2. Write a triage entry in `REVIEWED.md`: summary table row + short assessment.
3. Decide disposition with the user:
   - **Not promoted**: stays in `REVIEWED.md` with reasoning. Prevents re-examination.
   - **Promoted to ANALYSIS.md**: add to comparison matrices; note "PROMOTED" in `REVIEWED.md`.
   - **Standalone analysis**: create `ANALYSIS-<name>.md` if the tool/paper warrants a deep dive.
4. Lightweight PoC tools can be documented in `REVIEWED.md` without promotion.

The triage log is reverse-chronological with a summary table at the top and detailed sections below.

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
