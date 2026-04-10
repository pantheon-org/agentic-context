---
title: "Analysis — jdocmunch-mcp"
date: 2026-04-10
type: analysis
tool:
  name: "jdocmunch-mcp"
  repo: "https://github.com/jgravelle/jdocmunch-mcp"
  version: "v1.7.1"
  language: "Python"
  license: "Dual (non-commercial free / commercial paid)"
source: "references/jgravelle-jdocmunch-mcp.md"
---

# ANALYSIS: jdocmunch-mcp

---

## Summary

jdocmunch-mcp is a Python MCP server that indexes documentation into heading-delimited sections
and exposes 13 tools for structured retrieval. The core idea is a two-phase workflow: agents
first call `search_sections` or `get_toc` to receive summaries only, then call `get_section`
or `get_sections` to fetch exact content via stored byte offsets — loading no more than the
section requested. This discipline is the entire basis of the token-saving claim.

The architecture is well-executed and verifiably coherent from source. The savings figures in
TOKEN_SAVINGS.md (97–98%) are self-reported estimates, not reproducible measurements; actual
token reductions depend heavily on corpus structure and query specificity. The three benchmark
files in `benchmarks/` are narrated case studies authored by the developer, not independent
harnesses. The tool is genuinely useful for structured documentation corpora; its value is
lower for free-form prose or small doc sets. The dual license creates a meaningful barrier for
commercial teams.

---

## What it does (verified from source)

### Core mechanism

Indexing follows a six-stage pipeline (verified from `parser/`, `storage/`, `tools/`):

1. **Discovery** — GitHub API walk (`tools/index_repo.py`) or local directory traversal
   (`tools/index_local.py`). GitHub traversal is paginated via `httpx`.

2. **Security filtering** — `security.py` applies path-traversal checks, `.gitignore`-pattern
   exclusion via `pathspec`, binary detection, and a secret-file heuristic that silently skips
   files matching `secret*.md` or containing credential-like patterns.

3. **Preprocessing** — `preprocess_content()` in the parser package dispatch module converts
   non-Markdown formats to Markdown before parsing. Covered conversions: `.mdx` via
   `strip_mdx()` (12 compiled
   regex patterns removing YAML frontmatter, JSX tags, import/export, mermaid), `.ipynb` via
   `convert_notebook()`, `.html` via `convert_html()`, `.xml/.svg/.xhtml` via `convert_xml()`,
   OpenAPI YAML/JSON via `convert_openapi()`, plain JSON/JSONC via `convert_json()`, Godot
   scene files via `convert_godot()`. All outputs are fed to the unified Markdown parser.

4. **Section splitting** — `parse_markdown()` in `parser/markdown_parser.py` walks the file
   line by line, tracking UTF-8 byte offsets per line (`len(line.encode("utf-8"))`). Both ATX
   headings (`# H1`) and setext headings (underline with `===` / `---`) are handled. Content
   before the first heading becomes a level-0 root section. Each section records `byte_start`
   and `byte_end` into the raw file.

   Section IDs use a hierarchical slug: `{repo}::{doc_path}::{ancestor_chain/leaf}#{level}`.
   The ancestor chain prevents same-named headings under different parents from colliding or
   renumbering when the document is edited.

5. **Hierarchy wiring** — `parser/hierarchy.py::wire_hierarchy()` uses a level-stack to
   assign `parent_id` and `children` to each section in a second linear pass.

6. **Storage** — `DocStore` in `storage/doc_store.py` writes two artefacts atomically (temp
   file + rename): a JSON index at `~/.doc-index/{owner}/{name}.json` containing section
   metadata (titles, summaries, byte offsets, hashes, optional embeddings) but not full
   content, and raw content files under `~/.doc-index/{owner}/{name}/`. An in-memory LRU
   cache keyed by `(index_path, mtime_ns)` prevents redundant `json.load()` calls within
   a server process.

Retrieval is O(1): `DocStore.get_section_content()` opens the cached raw file, seeks to
`byte_start`, and reads `byte_end - byte_start` bytes — no re-parsing required.

**Drift detection** uses SHA-256 hashes per file. `DocStore.detect_changes()` compares the
stored hash map against current file hashes and returns `(changed, new, deleted)` lists,
enabling incremental re-index rather than full rebuilds.

**Search** has two modes controlled by the presence of stored embeddings (verified from
`storage/doc_store.py::DocIndex.search()`):

- **Lexical (default)**: weighted keyword scoring across title (exact: +20, substring: +10,
  word overlap: +5 per word), summary (substring: +8, word: +2 per word), tags (+3),
  content (capped at +5). Results with score zero excluded. Content stripped from results.

- **Semantic (optional)**: cosine-similarity over stored embedding vectors using a pure-Python
  dot-product implementation (no numpy). Falls back to lexical if no embeddings are present or
  query embedding fails. Three providers: Gemini `text-embedding-004` (768 dims), OpenAI
  `text-embedding-3-small` (1536 dims), and `sentence-transformers/all-MiniLM-L6-v2` (384
  dims, fully offline). Auto-detection uses env-var priority: explicit override, then
  `GOOGLE_API_KEY`, then `OPENAI_API_KEY`, then local sentence-transformers.

**Summarization** operates in three tiers: heading text (free, always available), AI batch
(Claude Haiku or Gemini Flash, in batches of 8 sections), then `"Section: {title}"` fallback.

**Token savings accounting** in `storage/token_tracker.py`: each search response computes
`raw_bytes = sum(len(content) for matched_doc_sections)` minus `response_bytes`, divided by
4 (the bytes-per-token heuristic). `tiktoken` (cl100k_base) is used if installed for an
accurate count. Savings accumulate in `~/.doc-index/_savings.json`. A background `httpx`
thread posts an anonymised `{delta, anon_id}` payload to
`https://j.gravelle.us/APIs/savings/post.php` unless `JDOCMUNCH_SHARE_SAVINGS=0` is set
(verified from source — telemetry is opt-out, not opt-in).

### Interface / API

13 MCP tools registered on the server (verified from `tools/` directory):

| Tool | Purpose |
|---|---|
| `index_local` | Index a local folder |
| `index_repo` | Index a GitHub repository |
| `list_repos` | List indexed documentation sets |
| `get_toc` | Flat section list, summaries only |
| `get_toc_tree` | Nested section tree per document |
| `get_document_outline` | Section hierarchy for one document |
| `search_sections` | Weighted keyword or semantic search, summaries only |
| `get_section` | Full content of one section by ID (byte-range read) |
| `get_sections` | Batch content retrieval |
| `get_section_context` | Section + ancestor headings + child summaries |
| `delete_index` | Remove a doc index |
| `get_broken_links` | Detect internal links that no longer resolve |
| `get_doc_coverage` | Which symbol IDs have matching doc sections |

Every response includes a `_meta` envelope: `latency_ms`, `sections_returned`, `tokens_saved`,
`total_tokens_saved`, `cost_avoided`, `total_cost_avoided`.

`get_doc_coverage` accepts a list of jcodemunch-format symbol IDs
(`{repo}::{filepath}::{name}#{type}`) and matches them against section titles. It degrades
gracefully when IDs are passed as plain strings, but the integration is not documented beyond
a single comment in the source.

### Dependencies

Core (always installed): `mcp>=1.10.0,<2.0.0`, `httpx>=0.27.0`, `pathspec>=0.12.0`,
`pyyaml>=6.0`. Python 3.10+ required.

Optional: `anthropic>=0.40.0` (Claude Haiku summarization), `google-generativeai>=0.8.0`
(Gemini Flash summarization or Gemini embeddings), `openai>=1.0.0` (OpenAI embeddings),
`sentence-transformers` (offline semantic search — not listed in `pyproject.toml` extras,
must be installed manually). No database; all state is JSON files under `~/.doc-index/`.

### Scope / limitations

- Savings are highest for well-structured, heading-rich documentation. Plain-text and
  prose-heavy files fall back to paragraph-block splitting, producing coarser sections.

- Semantic search is functional but underdocumented. `sentence-transformers` is not listed
  as a pyproject extra and has no install instructions in the README.

- The `tokens_saved` figure in `_meta` counts all section bytes in matched documents, not
  bytes an agent would have actually read. This inflates reported savings for documents with
  many sections where only one is relevant.

- Storage is local-only (`~/.doc-index/`). No multi-user or remote-index support.

- Telemetry is opt-out. Savings deltas are posted to `j.gravelle.us` by default. Not
  prominently documented.

- No background index watcher or TTL-based auto-refresh. Drift detection requires an
  explicit re-index call.

---

## Benchmark claims — verified vs as-reported

| Metric | Value | Status |
|---|---|---|
| Find specific topic: ~12,000 raw tokens vs ~400 jDocMunch, ~97% savings | TOKEN_SAVINGS.md | as reported — no methodology disclosed |
| Browse doc structure: ~40,000 vs ~800, ~98% savings | TOKEN_SAVINGS.md | as reported — no methodology disclosed |
| Read one section: ~12,000 vs ~300, ~97.5% savings | TOKEN_SAVINGS.md | as reported — no methodology disclosed |
| Explore a doc set: ~100,000 vs ~2,000, ~98% savings | TOKEN_SAVINGS.md | as reported — no methodology disclosed |
| Kubernetes: 500 files indexed in 3,352 ms, 4,355 sections | benchmarks/ | as reported — developer-authored case study |
| Kubernetes: 5 parallel queries at 83–100 ms each | benchmarks/ | as reported — developer-authored case study |
| Kubernetes: credential plugin section 863 B from 95,051-byte file (110x reduction) | benchmarks/ | as reported — byte figures consistent with architecture |
| SciPy: 430 files / 10,402 sections indexed in 2,247 ms | benchmarks/ | as reported |
| LangChain MDX: 490 MDX files parsed, section count +754% after strip_mdx() | benchmarks/ | as reported |
| Byte-offset O(1) retrieval via seek() + read() | storage/doc_store.py | verified from source |
| In-memory index cache keyed by (path, mtime_ns) | storage/doc_store.py | verified from source |
| Atomic writes via temp-file rename | storage/doc_store.py | verified from source |
| SHA-256 per-file drift detection | storage/doc_store.py | verified from source |
| Opt-out telemetry to j.gravelle.us | storage/token_tracker.py | verified from source |

No benchmark is independently reproducible. The three files in `benchmarks/` are narrated
case studies generated by Claude Sonnet on developer-controlled corpora running on Windows.
There is no script, fixture dataset, or assertion harness that an external party can execute.

---

## Architectural assessment

### What's genuinely novel

The section-first two-phase workflow occupies a distinct position between full-file reads
(high recall, expensive) and embedding-based chunking (requires infrastructure, loses
structural context). Heading boundaries as the chunking unit, combined with byte-offset
storage for O(1) retrieval, and a TOC-first navigation layer before content commitment,
is a coherent and practical design.

The hierarchical slug scheme is a sound engineering choice. Using the ancestor heading chain
as the slug prefix makes IDs stable under sibling insertions: a new same-named heading
elsewhere in the document does not renumber IDs in other branches. This matters for
agents caching section IDs across turns.

Incremental indexing by SHA-256 hash diff is well-implemented. Rebuilding only changed
files is important for large documentation repos that update frequently.

The multi-format preprocessing pipeline (convert-to-Markdown, parse once) avoids maintaining
separate retrieval paths per format. The MDX pre-processor with 12 compiled regex patterns
covering Mintlify/JSX constructs is a genuine addition over generic Markdown tools.

The multi-provider embedding layer with pure-Python cosine similarity (no numpy) enables
offline semantic search without a mandatory heavy dependency chain.

### Gaps and risks

**Savings accounting is misleading.** The `tokens_saved` figure counts all section bytes in
matched documents. A query returning one result from a 100-section document reports ~99%
savings even if the agent would only have opened the relevant section. This inflates headline
numbers and makes comparison with other tools unreliable.

**No independent benchmark harness.** All benchmark evidence is developer-authored narration.
No fixtures, no assertion scripts, no CI coverage for benchmark regression.

**Telemetry is opt-out.** Savings deltas and an anonymous UUID are posted to a third-party
URL by default. Non-starter for air-gapped or privacy-sensitive deployments. Not disclosed
prominently in the README.

**Commercial license barrier.** Any for-profit organization using jdocmunch-mcp for internal
developer tooling requires a paid commercial license. Studio tier ($349) covers five developers;
Platform ($1,999) covers org-wide internal deployment. This eliminates the tool as a candidate
for open-source agent frameworks.

**Semantic search is an undocumented optional.** The `sentence-transformers` provider is
functional but not listed in `pyproject.toml` extras and has no README install instructions.
Teams relying on lexical fallback may get degraded recall on paraphrase-heavy queries without
understanding why.

**Index version migration is silent.** `INDEX_VERSION = 2` is hardcoded. A version mismatch
silently drops the index and triggers a full re-index with no user notification. Large corpora
would silently re-index on upgrade.

---

## Recommendation

Adopt for non-commercial or individually licensed teams managing large, well-structured
documentation corpora (API references, framework docs, Kubernetes-scale Markdown trees)
where agents need section-level navigation without loading entire files. The byte-offset
retrieval and structural search are well-implemented and the two-phase workflow discipline
is sound.

Do not adopt if:

- The deployment is within a for-profit organization and the commercial license cost is
  prohibitive.
- Telemetry cannot be disabled (verify `JDOCMUNCH_SHARE_SAVINGS=0` is enforced).
- Corpora are predominantly prose-heavy free-form text (savings will be modest).
- Reproducible benchmark evidence is required before adoption.

For open-source or non-commercial agent pipelines, jdocmunch-mcp is the most complete
structural documentation retrieval MCP server available as of this writing. Treat published
savings figures as illustrative estimates, not measured performance guarantees.

---

## Comparison hooks (for ANALYSIS.md matrix)

| Dimension | jdocmunch-mcp |
|---|---|
| Approach | Structural section indexing via heading boundaries; byte-offset O(1) retrieval |
| Compression | Summaries-only search results; full content only on explicit get_section call |
| Token budget model | Per-call savings estimate (raw doc bytes minus response bytes / 4); opt-out telemetry |
| Injection strategy | Agent-driven two-phase: search or TOC first, targeted retrieval second |
| Eviction | No eviction; persistent JSON index; incremental update via hash-based drift detection |
| Benchmark harness | Developer-authored narrated case studies only; no executable harness |
| License | Dual: free non-commercial; paid commercial ($79 Builder / $349 Studio / $1,999 Platform) |
| Maturity | v1.7.1; 137 stars; 13 tools; test suite present; active development |
