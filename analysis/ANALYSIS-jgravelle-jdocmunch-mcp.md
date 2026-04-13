---
slug: jgravelle-jdocmunch-mcp
title: "Analysis — jdocmunch-mcp"
date: 2026-04-13
type: analysis
tool:
  name: "jdocmunch-mcp"
  repo: "https://github.com/jgravelle/jdocmunch-mcp"
  version: "v1.8.0"
  language: "Python"
  license: "Dual (non-commercial free / commercial paid)"
source: "references/jgravelle-jdocmunch-mcp.md"
local_clone: null
reviewed: true
reviewed_date: 2026-04-13
source_reviewed: false
updated: null
---

# ANALYSIS: jdocmunch-mcp

---

## Source review

Source vendored at `tools/jgravelle-jdocmunch-mcp/`. All claims below marked `(verified)` were
confirmed by reading the referenced source files directly.

### Architecture

Six-stage indexing pipeline wired across three packages:

- `parser/` — one module per format plus shared utilities (`sections.py`, `hierarchy.py`,
  `markdown_parser.py`, eight format-specific parsers)
- `storage/doc_store.py` — `DocIndex` + `DocStore`; all persistent state
- `tools/` — 16 thin handler modules imported by `server.py`

Entry point is `server.py::main()`, which starts an `mcp.server.Server` and registers all
tools. The CLI is a second entry point via `cli/` (`init.py` and `hooks.py`).

### Critical path (get_section)

1. `server.py` dispatches to `tools/get_section.py`
2. `get_section` calls `DocStore.get_section_content(owner, name, section_id)`
3. `doc_store.py::get_section_content` calls `index.get_section(section_id)` — O(1) dict lookup
   via `DocIndex._section_index` built in the `post_init` constructor method (verified from source)
4. Opens the cached raw file, seeks to `byte_start`, reads `byte_end - byte_start` bytes
   (verified from source: `f.seek(byte_start); raw = f.read(byte_end - byte_start)`)
5. Returns UTF-8 decoded string

### Key data structures

- `Section` dataclass (`parser/sections.py`): `id`, `repo`, `doc_path`, `title`, `content`,
  `level`, `parent_id`, `children`, `byte_start`, `byte_end`, `summary`, `tags`, `references`,
  `content_hash`, `embedding`
- `DocIndex` dataclass: sections list + `_section_index` dict (built at load time); `file_hashes`
  dict for SHA-256 drift detection; `index_version` field
- `DocStore`: JSON index at `~/.doc-index/{owner}/{name}.json`; raw content files under
  `~/.doc-index/{owner}/{name}/`; module-level `_INDEX_CACHE` dict keyed by
  `(str(index_path), mtime_ns)`

---

## Summary

jdocmunch-mcp is a Python MCP server that indexes documentation into heading-delimited sections
and exposes 16 tools for structured retrieval (the prior triage reported 13; the vendored source
registers 16, including `get_backlinks`, `get_stale_pages`, and `get_wiki_stats` added since
that triage). The core idea is a two-phase workflow: agents first call `search_sections` or
`get_toc` to receive summaries only, then call `get_section` or `get_sections` to fetch exact
content via stored byte offsets — loading no more than the section requested. This discipline
is the entire basis of the token-saving claim.

The architecture is well-executed and verifiably coherent from source. The savings figures in
TOKEN_SAVINGS.md (97–98%) are self-reported estimates, not reproducible measurements; actual
token reductions depend heavily on corpus structure and query specificity. The earlier triage
described `benchmarks/` as narrated case studies with no executable harness — this is now
partially contradicted by source: `benchmarks/wiki/run_benchmark.py` is a real, runnable
Python harness with tiktoken-based token counting. The tool is genuinely useful for structured
documentation corpora; its value is lower for free-form prose or small doc sets. The dual
license creates a meaningful barrier for commercial teams.

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
   `strip_mdx()` (verified: 12 compiled regex patterns removing YAML frontmatter, JSX tags,
   import/export, mermaid fence blocks), `.ipynb` via `convert_notebook()`, `.html` via
   `convert_html()`, `.xml/.svg/.xhtml` via `convert_xml()`, OpenAPI YAML/JSON via
   `convert_openapi()`, plain JSON/JSONC via `convert_json()`, Godot scene files via
   `convert_godot()`. All outputs are fed to the unified Markdown parser.

4. **Section splitting** — `parse_markdown()` in `parser/markdown_parser.py` walks the file
   line by line, tracking UTF-8 byte offsets per line (`len(line.encode("utf-8"))`) (verified
   from source). Both ATX headings (`# H1`) and setext headings (underline with `===` / `---`)
   are handled. Content before the first heading becomes a level-0 root section. Each section
   records `byte_start` and `byte_end` into the raw file.

   Section IDs use a hierarchical slug: `{repo}::{doc_path}::{ancestor_chain/leaf}#{level}`
   (verified from `sections.py::make_section_id` and `make_hierarchical_slug`). The ancestor
   chain prevents same-named headings under different parents from colliding or renumbering
   when the document is edited.

5. **Hierarchy wiring** — `parser/hierarchy.py::wire_hierarchy()` uses a level-stack to
   assign `parent_id` and `children` to each section in a second linear pass.

6. **Storage** — `DocStore` in `storage/doc_store.py` writes two artefacts atomically (temp
   file + rename) (verified from source: `tmp_path.replace(index_path)`): a JSON index at
   `~/.doc-index/{owner}/{name}.json` containing section metadata (titles, summaries, byte
   offsets, hashes, optional embeddings) but not full content, and raw content files under
   `~/.doc-index/{owner}/{name}/`. A module-level `_INDEX_CACHE` dict keyed by
   `(str(index_path), mtime_ns)` prevents redundant `json.load()` calls within a server
   process (verified from source).

Retrieval is O(1) (verified from source): `DocStore.get_section_content()` looks up the
section dict in `DocIndex._section_index` (a plain Python dict built at `post_init`
time), then opens the cached raw file, seeks to `byte_start`, and reads
`byte_end - byte_start` bytes — no re-parsing required.

**Drift detection** uses SHA-256 hashes per file (verified from source: `hashlib.sha256`).
`DocStore.detect_changes()` compares the stored hash map against current file hashes and
returns `(changed, new, deleted)` lists, enabling incremental re-index rather than full
rebuilds.

**Search** has two modes controlled by the presence of stored embeddings (verified from
`storage/doc_store.py::DocIndex.search()`):

- **Lexical (default)**: weighted keyword scoring across title (exact: +20, substring: +10,
  word overlap: +5 per word), summary (substring: +8, word: +2 per word), tags (+3),
  content (capped at +5). Results with score zero excluded. Content stripped from results.

- **Semantic (optional)**: cosine-similarity over stored embedding vectors using a pure-Python
  dot-product implementation (no numpy) (verified from `embeddings/provider.py::cosine_similarity`).
  Falls back to lexical if no embeddings are present or query embedding fails. Three providers:
  Gemini `text-embedding-004` (768 dims), OpenAI `text-embedding-3-small` (1536 dims), and
  `sentence-transformers/all-MiniLM-L6-v2` (384 dims, fully offline). Auto-detection priority
  (verified from source): explicit `JDOCMUNCH_EMBEDDING_PROVIDER` override, then
  `GOOGLE_API_KEY`, then `OPENAI_API_KEY`, then installed `sentence-transformers`.

**Summarization** operates in three tiers: heading text (free, always available), AI batch
(Claude Haiku or Gemini Flash, in batches of 8 sections), then `"Section: {title}"` fallback.
Additional summarizer providers added since prior triage: MiniMax and ZhipuAI (GLM), selected
via `JDOCMUNCH_SUMMARIZER_PROVIDER` env var (verified from source `CLAUDE.md`).

**Token savings accounting** in `storage/token_tracker.py` (verified from source): each
`search_sections` response computes `raw_bytes = sum(len(content) for all_sections_in_matched_documents)`
minus `response_bytes`, divided by 4 (the bytes-per-token heuristic). `tiktoken`
(cl100k_base) is used if installed for an accurate count. Savings accumulate in
`~/.doc-index/_savings.json`. A background `httpx` thread posts an anonymised
`{"delta": <int>, "anon_id": <uuid4>}` payload to
`https://j.gravelle.us/APIs/savings/post.php` unless `JDOCMUNCH_SHARE_SAVINGS=0` is set
(verified from source — telemetry is opt-out, not opt-in).

**Savings accounting flaw** (verified from source): in `tools/search_sections.py`, `raw_bytes`
is computed as the sum of `content` bytes for every section belonging to any document that
appeared in the result set — not the bytes the agent would have actually consumed. A query
returning one result from a 100-section document reports savings as if the agent would have
read all 100 sections. This inflates reported savings figures substantially for large corpora.

**Claude Code integration hooks** (new since prior triage — verified from `cli/hooks.py`):
three Claude Code hooks are now shipped:

- `PreToolUse` — intercepts `Read` calls on doc files above 2 KB and prints a stderr hint
  directing Claude to use `search_sections` + `get_section` instead (never hard-blocks, to
  preserve the Edit workflow requiring a prior Read)
- `PostToolUse` — auto-reindexes a doc file after `Edit`/`Write` by spawning
  `jdocmunch-mcp index-file <path>` as a fire-and-forget background process
- `PreCompact` — emits a session snapshot of indexed repos as a `systemMessage` so doc
  orientation survives context compaction

### Interface / API

16 MCP tools registered on the server (verified from `server.py::list_tools()`; prior triage
reported 13 — three tools were added: `get_backlinks`, `get_stale_pages`, `get_wiki_stats`):

| Tool | Registered name | Purpose |
|---|---|---|
| `index_local` | `index_local` | Index a local folder |
| `index_repo` | `doc_index_repo` | Index a GitHub repository |
| `list_repos` | `doc_list_repos` | List indexed documentation sets |
| `get_toc` | `get_toc` | Flat section list, summaries only |
| `get_toc_tree` | `get_toc_tree` | Nested section tree per document |
| `get_document_outline` | `get_document_outline` | Section hierarchy for one document |
| `search_sections` | `search_sections` | Weighted keyword or semantic search, summaries only |
| `get_section` | `get_section` | Full content of one section by ID (byte-range read) |
| `get_sections` | `get_sections` | Batch content retrieval |
| `get_section_context` | `get_section_context` | Section + ancestor headings + child summaries |
| `delete_index` | `delete_index` | Remove a doc index |
| `get_broken_links` | `get_broken_links` | Detect internal links that no longer resolve |
| `get_doc_coverage` | `get_doc_coverage` | Which symbol IDs have matching doc sections |
| `get_backlinks` | `get_backlinks` | Sections that link to a given section (new) |
| `get_stale_pages` | `get_stale_pages` | Identify pages not updated recently (new) |
| `get_wiki_stats` | `get_wiki_stats` | Aggregate statistics for an indexed wiki (new) |

Every response includes a `_meta` envelope: `latency_ms`, `sections_returned`, `tokens_saved`,
`total_tokens_saved`, `cost_avoided`, `total_cost_avoided`.

`get_doc_coverage` accepts a list of jcodemunch-format symbol IDs
(`{repo}::{filepath}::{name}#{type}`) and matches them against section titles. It degrades
gracefully when IDs are passed as plain strings, but the integration is not documented beyond
a single comment in the source.

### Dependencies

Core (always installed, verified from `pyproject.toml`): `mcp>=1.10.0,<2.0.0`,
`httpx>=0.27.0`, `pathspec>=0.12.0`, `pyyaml>=6.0`. Python 3.10+ required.

Optional extras (verified from `pyproject.toml`): `anthropic>=0.40.0` (`[anthropic]`),
`google-generativeai>=0.8.0` (`[gemini]` or `[semantic]`), `openai>=1.0.0` (`[openai]`,
`[minimax]`, `[zhipu]`). `sentence-transformers` is not listed as a pyproject extra
(verified — absent from `pyproject.toml`) and must be installed manually; auto-detected at
runtime if importable. No database; all state is JSON files under `~/.doc-index/`.

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
| Byte-offset O(1) retrieval via seek() + read() | storage/doc_store.py | verified |
| O(1) section dict lookup via `_section_index` built at load time | storage/doc_store.py | verified |
| In-memory index cache keyed by (path, mtime_ns) | storage/doc_store.py | verified |
| Atomic writes via temp-file rename | storage/doc_store.py | verified |
| SHA-256 per-file drift detection | storage/doc_store.py | verified |
| Opt-out telemetry to j.gravelle.us | storage/token_tracker.py | verified |
| Savings flaw: counts all sections in matched docs, not returned sections | storage/doc_store.py, tools/search_sections.py | verified |
| 16 tools registered (not 13 as in prior triage) | server.py | verified |
| `sentence-transformers` not a pyproject.toml extra | pyproject.toml | verified |
| INDEX_VERSION = 2 in source (prior analysis said INDEX_VERSION = 2; CLAUDE.md inside tool says 1 — stale docs) | storage/doc_store.py | verified |

**Prior triage claim partially contradicted:** the earlier triage stated "no script, fixture
dataset, or assertion harness that an external party can execute." Source review found
`benchmarks/wiki/run_benchmark.py` — a real Python harness that accepts a cloned wiki path
and query list, tokenizes with tiktoken cl100k_base, parses sections offline, and scores
results. It is reproducible by any external party with `pip install tiktoken` and a cloned
wiki. The three older narrated benchmark files remain developer-authored case studies without
executables, but the tool set now includes one genuine reproducible harness.

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

**Benchmark harness is limited.** The older narrated case studies remain developer-authored
with no assertion mechanism. `benchmarks/wiki/run_benchmark.py` is a real harness with
tiktoken-based token counting, but it uses an offline approximation of jDocMunch's section
parser (a simplified in-script heading splitter, not the actual `parse_markdown()` path) and
hardcodes a `SEARCH_META_TOKENS = 190` estimate rather than measuring live MCP responses. It
exercises the concept but does not run the production code path. No CI coverage for benchmark
regression exists.

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

**Index version migration is silent (verified).** `INDEX_VERSION = 2` is hardcoded in source
(`storage/doc_store.py` line 15). A version mismatch silently drops the index (`load_index`
returns `None`) and triggers a full re-index with no user notification. The embedded CLAUDE.md
inside the tool still states `INDEX_VERSION=1` — stale documentation. Large corpora would
silently re-index on upgrade.

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
| Benchmark harness | One reproducible harness (`benchmarks/wiki/run_benchmark.py`, tiktoken-based); three older narrated case studies with no assertions; harness uses offline parser approximation, not production code path |
| License | Dual: free non-commercial; paid commercial ($79 Builder / $349 Studio / $1,999 Platform) |
| Maturity | v1.8.0; 13 tools in prior triage (16 verified from source); test suite present; active development |
