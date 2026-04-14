# agentic-context — Agent Guide

This `AGENTS.md`/`CLAUDE.md` describes conventions for maintaining this research repository and keeping it clean.

**Instruction precedence**: if this file conflicts with platform/system/developer instructions, follow platform/system/developer instructions.

---

## Project overview

This repo collects, summarizes, and analyzes tooling and papers related to **context management** in agentic LLM systems. The unit of interest is the active context window: what gets in, how it is prioritized, compressed, truncated, and evicted.

---

## Workflows

The full research pipeline has four stages. Each stage has dedicated skills.

### Stage 1 — Discovery

Find candidates before committing to a triage.

| Skill | Use when |
|---|---|
| `tessl__semantic-scholar-search` | Default. Official API, supports citation graphs and author lookup. |
| `tessl__google-scholar-search` | Fallback when Semantic Scholar has no coverage. Scraping-based. |
| `tessl__pubmed-search` | Biomedical literature only. |

### Stage 2 — Triage

Create `references/{slug}.md`, update `REVIEWED.md` and `REFERENCE_INDEX.md`.

| Skill | Use when |
|---|---|
| `tessl__triage-paper` | Source is an arxiv ID, DOI, or PDF. |
| `tessl__triage-tool` | Source is a GitHub URL, npm package, PyPI package, or CLI tool. |

All triage-stage claims must be marked `(as reported)`.

### Stage 3 — Full text retrieval

**Papers only.** Tool repos are public GitHub repos — fetch source directly in Stage 4. Skip Stage 3 entirely for tool analyses.

| Skill | Use when |
|---|---|
| `tessl__sci-hub-search` | Paper is behind a paywall; retrieves PDF by DOI or title. |
| `tessl__sci-data-extractor` | PDF contains tables, benchmark charts, or kinetics data to extract into structured form. |

### Stage 4 — Analysis

See [Promoting a reference to ANALYSIS](#promoting-a-reference-to-analysis) for the full checklist.

| Skill | Use when |
|---|---|
| `tessl__reproduce-benchmark` | A benchmark harness exists; runs it and writes `benchmarks/sources/{slug}-repro.md`. |

**When running multiple Stage 4 analyses in parallel:** each agent writes only `analysis/ANALYSIS-{slug}.md` and `benchmarks/sources/{slug}-repro.md`. Do not have parallel agents modify `REVIEWED.md` or `ANALYSIS.md` — update those in a single consolidation pass after all agents complete.

**Full pipeline:**

```text
semantic-scholar-search (or google-scholar / pubmed)
  → triage-paper / triage-tool          (references/{slug}.md)
      → sci-hub-search                  (download PDF if paywalled)
          → sci-data-extractor          (extract benchmark tables)
              → reproduce-benchmark     (verify claims)
                  → promote to ANALYSIS
```

Most references stop at Stage 2. Only promote to Stage 4 when the criteria in [Promoting a reference to ANALYSIS](#promoting-a-reference-to-analysis) are met.

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

1. **Vendor the source.** Add the repo as a git submodule into `tools/<slug>/` pinned to the commit examined. This is **required before writing an ANALYSIS document** — do not proceed to Step 2 without a local clone.

   ```sh
   git submodule add <repo-url> tools/<slug>
   ```

   Record the path in the analysis frontmatter (`local_clone: tools/<slug>/`). Set `source_reviewed: true` only after you have actually read the source files.

   > **No exceptions for link-only analyses.** A write-up based solely on public documentation is a reference summary (`references/{slug}.md`), not an analysis. Do not create `analysis/ANALYSIS-{slug}.md` without a vendored clone.

2. **Read the source.** Focus on: the critical path from agent call to token-reduced output, data structures used to represent context, and any benchmark harness (`benchmarks/`, `eval/`, `tests/`).

3. **Attempt claim reproduction.** Run the disclosed benchmark harness if one exists. Record results in `benchmarks/sources/{slug}-repro.md` (methodology, environment, outcome). Mark results `(verified)` or `(attempted — inconclusive)` as appropriate.

4. **Write `analysis/ANALYSIS-{slug}.md`.** Follow the conventions in "Writing ANALYSIS documents" below.

5. **Update `ANALYSIS.md`.** Add a row to the comparison matrix (including the **Overlap & recommendation** column — which tools it overlaps with and which to prefer) and a line under "Recommended reading order" if the analysis is worth reading first.

6. **Update `REVIEWED.md`.** Change the status from `pending` to `analysis`.

### What counts as "verified"

- **Verified** — you ran the benchmark harness yourself with a disclosed model, dataset, and environment, and results are within 10% of the reported figure.
- **Partially verified** — the harness ran but on a different dataset or model than the paper/README used.
- **Attempted — inconclusive** — the harness exists but produced errors, missing dependencies, or results that diverge significantly.
- **As reported** — no reproduction attempted; use this for all triage-stage claims.

### Repro guide vs repro results

A `benchmarks/sources/{slug}-repro.md` file that describes the harness, its methodology, and instructions for running it is a **repro guide**. It is not a reproduction. Actual **repro results** require executing the harness and recording the outcome.

Most analyses in this repo currently contain repro guides only. Do not conflate a repro guide with a reproduction. A guide always stays `(as reported)` until the harness is actually run.

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

## ANALYSIS.md comparison matrix

The matrix is the primary at-a-glance overview. Every row must include all seven columns:

| Column | Content |
|---|---|
| Tool / Paper | Name linked to the `analysis/ANALYSIS-{slug}.md` file |
| Approach | One-sentence mechanism description |
| Compression | Headline figure with source qualifier (`as reported` / `verified`) |
| Token budget model | How the tool decides what to include/exclude |
| Benchmarks | Harness status and reproduction state |
| Notes | License, stars, material risks |
| **Overlap & recommendation** | Which tools cover similar ground; which to prefer and when |

**Overlap & recommendation** is the most important column for a synthesis document. It must answer two questions:
1. *What does this tool overlap with?* — name the peers by slug.
2. *When should you pick this one over them?* — one concrete differentiator (license, depth, dep footprint, modality, etc.).

Example: `Overlaps code-review-graph and jcodemunch-mcp (AST-graph family). Prefer code-review-graph for richer toolset (MIT); use this only if WASM zero-dep bundle is required.`

Keep entries to one or two sentences — the goal is a quick decision signal, not a full comparison.

---

## Research / claim hygiene

- Distinguish clearly between **"as reported"** (paper/tool claims) and **verified** (you ran it or cross-checked).
- Flag unverified benchmarks with `(as reported)`.
- If a claim cannot be verified from the source, note it as a gap, not a fact.

---

## Updating the GitHub Pages site

The site is an Astro/Starlight build in `site/`. Generated content is gitignored — deployment is fully automatic.

### How it works

```text
source files (repo root)
  analysis/ANALYSIS-*.md
  benchmarks/sources/*-repro.md
  references/*.md
  ANALYSIS.md
  REVIEWED.md
        │
        ▼
  site/scripts/copy-content.mjs   ← runs at build time; rewrites links, strips slug field
        │
        ▼
  site/src/content/docs/          ← gitignored; never commit manually
        │
        ▼
  site/dist/                      ← built output, deployed to GitHub Pages
```

### When the site updates

The `.github/workflows/deploy-site.yml` workflow triggers on every push to `main` that touches:

```text
analysis/**  ·  benchmarks/**  ·  references/**
ANALYSIS.md  ·  REVIEWED.md   ·  site/**
```

Pushing source file changes to `main` is all that is required — CI handles the copy and build.

### Verifying locally before pushing

```bash
cd site
npm run build        # runs copy-content.mjs then astro build
# open site/dist/   # or: npm run preview
```

A clean build with the expected page count confirms the content is valid. New tool entries should produce three pages: `/analysis/<slug>/`, `/benchmarks/<slug>/`, `/references/<slug>/`.

### Checklist for a new tool entry

Every new tool triage + analysis should produce these source files before pushing:

- [ ] `references/<slug>.md` → becomes `/references/<slug>/`
- [ ] `analysis/ANALYSIS-<slug>.md` → becomes `/analysis/<slug>/`
- [ ] `benchmarks/sources/<slug>-repro.md` → becomes `/benchmarks/<slug>/`
- [ ] Row in `ANALYSIS.md` matrix and reading order
- [ ] Row in `REVIEWED.md` summary table

---

## Commits

- Conventional commit messages: `feat:`, `docs:`, `chore:`, `fix:`, `analysis:`.
- One logical change per commit. Do not batch unrelated reference additions.
- Never commit generated BibTeX by hand — use `scripts/` automation.

---

## Meta: Evolving this file

Update this file when conventions change. Keep it short — it must remain readable in one sitting.
