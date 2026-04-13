---
slug: "choihyunsus-n2-arachne"
title: "Benchmark repro guide — n2-arachne"
source: "https://github.com/choihyunsus/n2-arachne"
local_clone: "../../tools/choihyunsus-n2-arachne"
harness_present: false
harness_path: null
outcome: "stub — no harness found"
updated: 2026-04-13
---

# Benchmark Repro Guide: n2-arachne

This document records the state of the benchmark harness for n2-arachne as found in the vendored source at `tools/choihyunsus-n2-arachne/`.

---

## Harness status

**No executable benchmark harness is available in the vendored source.**

The following benchmark script paths are referenced in the repository but are absent from the tree:

| Reference location | Path referenced | Present in repo |
|---|---|---|
| `CHANGELOG.md` (v4.0.0) | `test/test-benchmark.js` | No |
| `README.md` (Run benchmarks section) | `test/bench-hybrid-engine.js` | No |
| `README.md` (Run benchmarks section) | `test/bench-10mb.js` | No |

The `package.json` test script is `echo 'Tests run via CI pipeline'` — no runnable test or benchmark is available to the public. The `data-hybrid-bench/benchmark-report.json` output path referenced in the README also does not exist in the vendored tree.

---

## Claimed benchmark figures (as reported)

All figures below are from `README.md` and `CHANGELOG.md`. None have been independently reproduced.

### Real-world compression benchmark

| Metric | Claimed value | Source |
|---|---|---|
| Project size | 3,219 files / 4.68 M tokens | README benchmark table |
| Arachne output | 14,074 tokens | README benchmark table |
| Compression ratio | 333x (99.7% reduction) | README benchmark table |
| Initial index time | 627 ms | README benchmark table |
| Incremental index time | 0 ms | README benchmark table |
| SQLite DB size | 24 MB | README benchmark table |

Benchmark subject: N2 Browser project (the author's own production project). No independent dataset is provided.

### Search engine performance (v4.0)

Hardware: AMD Ryzen 5 5600G, Node v24, Windows x64 (as stated in README).

| Search Mode | Engine | Claimed performance | Notes |
|---|---|---|---|
| Keyword | Rust BM25 (memchr + rayon) | 4.98 ms / query | 1.3x faster than TS fallback |
| Keyword | SQLite LIKE | 0.021 ms / query | DB index path |
| Semantic KNN | sqlite-vec (C++ SIMD) | 29.52 ms / query | 10K × 768D vectors |
| Batch Cosine | Rust (napi-rs) | 4.91 ms / query | Retired — causes GC/OOM at scale |

Note: The README intro callout also states "25ms" for the sqlite-vec scan. This is internally inconsistent with the 29.52 ms figure in the benchmark table. Both values claim the same test conditions (10,000 × 768D vectors). Neither is reproducible without the benchmark scripts.

The BatchCosine (Rust) path is labelled "Legacy" in the README and has been retired from the production code path in v4.0 due to V8 heap OOM on large corpora. The 19.9x speedup figure in the CHANGELOG (and 22.3x in the README table) refers to this retired path.

The headline "1GB codebase search in 0.54 seconds" appears on line 12 of the README but is not supported by any benchmark table entry.

---

## How to run (if scripts become available)

The README specifies:

```bash
cd tools/choihyunsus-n2-arachne
npm run build
node test/bench-hybrid-engine.js   # Engine comparison (BM25 vs sqlite-vec vs TS)
node test/bench-10mb.js             # Memory scale test
```

Output would be written to `data-hybrid-bench/benchmark-report.json`.

### Environment requirements (as stated in README)

- Node.js >= 18 (tested with Node v24)
- npm or npx
- Ollama running locally on `http://localhost:11434` (for semantic/hybrid benchmarks)
- `nomic-embed-text` model pulled in Ollama
- The Rust native module must be built or the prebuilt `.node` must be compatible with the host platform/arch

### Building the Rust module from source

```bash
cd tools/choihyunsus-n2-arachne/native
cargo build --release
# The .node file will be output to native/ after napi-rs post-build
```

Requires: Rust toolchain (stable), `napi-build` crate dependencies.

---

## Reproduction notes

This guide was written based on source inspection only. The benchmark scripts were not executed. The repro status is:

- **Compression claim (333x)**: cannot reproduce — no harness, no test dataset provided.
- **Index time (627 ms)**: cannot reproduce — no harness, no test dataset provided.
- **BM25 search time (4.98 ms)**: cannot reproduce — `test/bench-hybrid-engine.js` absent.
- **sqlite-vec KNN time (25 ms / 29.52 ms)**: cannot reproduce — same harness absent; figure is internally inconsistent.
- **BatchCosine speedup (19.9x / 22.3x)**: cannot reproduce; path is retired from production code and labelled "Legacy".

If the benchmark scripts are published by the author, running them on a representative codebase (ideally not the author's own N2 Browser project) would be the minimum needed to validate the compression and performance claims.
