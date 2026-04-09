# Scripts

Automation for PDF extraction, reference sync, and BibTeX generation.

| Script | Purpose |
|---|---|
| `extract_pdf.py` | Run `marker-pdf` on `references/papers/*.pdf` → `.md` snapshots |
| `build_reference_index.py` | Fetch BibTeX from arxiv API for all paper IDs → `references/bib/` |
| `sync_ref.py` | Download PDFs listed in `PUNCHLIST.md` to `references/papers/` |

## PDF extraction

Preferred tool: `marker-pdf` (produces structured Markdown with headings and tables).
Fallback: `pdftotext -layout` (fast, plain text, degrades on multi-column layouts).

## Setup

```bash
pip install marker-pdf
```
