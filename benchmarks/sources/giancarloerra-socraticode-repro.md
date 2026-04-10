# socraticode — Benchmark Reproduction

**Source**: `https://github.com/giancarloerra/SocratiCode` (tag: v1.3.2)
**Date**: 2026-04-10
**Environment**: not run — no scripted harness exists
**Outcome**: not reproducible — benchmark is an author-run live session documented in README; no benchmark script is committed to the repository

---

## Claimed figures (as reported)

Benchmark conducted on VS Code (2.45M lines of TypeScript/JavaScript, 5,300+ files, 55,437 indexed chunks) with Claude Opus 4.6.

| Question | Grep (bytes) | SocratiCode (bytes) | Reduction | Speedup |
|---|---|---|---|---|
| How does VS Code implement workspace trust restrictions? | 56,383 | 21,149 | 62.5% | 49.7x |
| How does the diff editor compute and display text differences? | 37,650 | 15,961 | 57.6% | 40.2x |
| How does VS Code handle extension activation and lifecycle? | 36,231 | 16,181 | 55.3% | 34.4x |
| How does the integrated terminal spawn and manage shells? | 50,159 | 22,518 | 55.1% | 31.1x |
| How does VS Code implement the command palette and quick pick? | 70,087 | 20,676 | 70.5% | 31.7x |
| Total | 250,510 | 96,485 | 61.5% | 37.2x |

Additional claims:

- 84% fewer tool calls (31 → 5 across 5 questions)
- 60–90 ms search latency vs 2–3.5 s per grep query

## Methodology analysis

The README describes the following methodology:

- Grep approach: `grep -rl` to find matching files, identify core files, read them in 200-line chunks, repeat until enough context is gathered.
- SocratiCode approach: single `codebase_search` call returning 10 most relevant chunks.
- "Bytes" = raw bytes exchanged between Claude and the tools during a live session (not LLM input tokens, not total session tokens including reasoning).

Key limitations:

1. **Not tokens, bytes.** The metric is raw bytes of tool output, not LLM tokens. Byte count and token count diverge for code (tokenizer compression ratios differ by language and content type).
2. **Favorable baseline.** The grep workflow reads files in 200-line chunks and follows dead ends. A focused `ripgrep --json` with targeted file reads would consume fewer bytes.
3. **Single repo, single model, single session.** VS Code is a TypeScript monorepo — well-structured, dense with named abstractions, and highly amenable to semantic search. Results on Python, Ruby, or polyglot monorepos are not reported.
4. **Questions are architectural.** "How does X implement Y" questions favor semantic search. Exact identifier lookups or cross-language refactoring queries would favor BM25 or hybrid differently.
5. **No confidence interval or error bars.** A single run per question is reported.

## Reproduction instructions

No scripted benchmark harness exists. To approximate the benchmark manually:

```shell
# Install SocratiCode (requires Docker)
npx -y socraticode

# Add to MCP config, then index a repo
# Call: codebase_index with projectPath pointing to VS Code repo

# Run the five benchmark questions via codebase_search
# Compare Claude Code /cost token counts against equivalent grep workflows
```

To reproduce the grep baseline:

```shell
cd /path/to/vscode
# Question 1: workspace trust
grep -rl "workspace trust" . | head -20
# Read each file in 200-line chunks until context is sufficient
```

Token counts must be measured from Claude Code's `/cost` command or session token logging — there is no standalone harness to automate this.

## Notes on the hybrid search mechanism (verified from source)

The underlying `searchChunks()` function in `src/services/qdrant.ts` is confirmed to use Qdrant's native hybrid query API:

```typescript
qdrant.query(collectionName, {
  prefetch: [
    { query: queryVector, using: "dense", limit: prefetchLimit, filter },
    { query: { text: query, model: "qdrant/bm25" }, using: "bm25", limit: prefetchLimit, filter },
  ],
  query: { fusion: "rrf" },
  limit,
  with_payload: true,
})
```

This requires Qdrant v1.15.2+. The BM25 model runs server-side inside the Qdrant container; IDF corpus is built from indexed documents at upsert time.

## Test suite

Unit, integration, and e2e tests exist in `tests/` (Vitest). No standalone token benchmark harness is present.

```shell
npm test            # all tests (requires Docker + Qdrant + Ollama)
npm run test:unit   # unit tests only (no Docker required)
```
