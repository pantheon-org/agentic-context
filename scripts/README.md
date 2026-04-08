# Scripts

Automation for PDF extraction, reference sync, and BibTeX generation.

| Script | Purpose |
|---|---|
| `extract-pdf.sh` | Run `marker-pdf` on `references/papers/*.pdf` → `.md` snapshots |
| `generate-bib.sh` | Fetch BibTeX from arxiv API for all paper IDs → `references/bib/` |
| `sync-refs.sh` | Download PDFs listed in `PUNCHLIST.md` to `references/papers/` |

## PDF extraction

Preferred tool: `marker-pdf` (produces structured Markdown with headings and tables).
Fallback: `pdftotext -layout` (fast, plain text, degrades on multi-column layouts).

## Setup

```bash
pip install marker-pdf
```
