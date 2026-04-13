---
slug: "rtk"
title: "rtk — Benchmark Reproduction"
source: "https://github.com/rtk-ai/rtk"
local_clone: "../../tools/rtk"
harness_present: true
harness_path: "scripts/benchmark.sh"
outcome: "repro guide (not run)"
updated: 2026-04-13
---

# rtk — Benchmark Reproduction

**Source**: `https://github.com/rtk-ai/rtk` (v0.35.0, master branch)
**Date**: 2026-04-10
**Environment**: macOS Darwin 25.4.0
**Outcome**: not yet run — harness structure verified from source; see notes below

---

## Harness location

```text
scripts/benchmark.sh        # primary benchmark harness (17.7 KB, verified from source)
scripts/rtk-economics.sh    # session-level economics estimates
```

No npm or language runtime dependencies are required; the harness is a plain bash script. It requires the `rtk` binary and the language toolchains for any sections you want to run (git, cargo, go, python, node, etc.).

## How to reproduce

```shell
# Install rtk (required)
brew install rtk
# or
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh

# Clone the repo
git clone https://github.com/rtk-ai/rtk
cd rtk

# Run benchmark against installed rtk
bash scripts/benchmark.sh

# Or build from source and run against local binary
cargo build --release
bash scripts/benchmark.sh   # picks up ./target/release/rtk automatically
```

## What the harness measures (verified from source)

- Runs live commands (`git status`, `cargo test`, `pytest -v`, `go test -v`, `golangci-lint`, `ruff check`, etc.) on temporary fixtures created in `mktemp -d` directories.
- Compares `ceil(chars / 4)` token estimates for raw output vs rtk-filtered output. The bash implementation is `$(( (len + 3) / 4 ))` (integer ceiling division).
- Includes a `bench_rewrite` section that verifies `rtk rewrite` correctness (e.g., compound `cargo test && git push` rewrites to `rtk cargo test && rtk git push`) — these are correctness tests, counted in the GOOD/FAIL totals.
- Reports per-test: icon (✅/⚠️/❌), name, raw command, rtk command, raw tokens, filtered tokens, savings %.
  - ✅ GOOD: rtk output is non-empty and smaller (strictly fewer tokens) than raw.
  - ⚠️ SKIP: rtk output has same or more tokens than raw (or raw has 0 tokens). In SKIP mode, raw token count is added to both TOTAL_UNIX and TOTAL_RTK (no credit for savings).
  - ❌ FAIL: rtk output is empty. Raw count added to both totals (no savings assumed).
- Reports aggregate: `✅ N good ⚠️ M skip ❌ P fail`, then `Tokens: TOTAL_UNIX → TOTAL_RTK (-PCT%)`.
- **80% CI gate**: exits non-zero (`exit 1`) if `GOOD_PCT` (= `GOOD_TESTS * 100 / TOTAL_TESTS`) is less than 80. Source: lines 587-591 of `scripts/benchmark.sh`.
- Optionally writes per-test debug files to `scripts/benchmark/{unix,rtk,diff}/` when `$CI` is unset.

## Token estimation methodology (verified from source)

The harness uses `$(( (len + 3) / 4 ))` (bash integer ceiling of string length / 4) as the token proxy — the same `ceil(chars / 4)` heuristic used by `rtk gain`. The Rust implementation in `src/core/tracking.rs::estimate_tokens()` is:

```rust
pub fn estimate_tokens(text: &str) -> usize {
    (text.len() as f64 / 4.0).ceil() as usize
}
```

This is not a real LLM tokenizer. It operates on byte length (`.len()` in Rust returns bytes, not Unicode codepoints), which means:

- ASCII-only outputs: reliable approximation.
- Code with multi-byte Unicode (e.g., emoji in commit messages, non-ASCII identifiers): overcounts bytes, inflates estimated savings.
- Actual LLM token savings could differ by 20-30% from reported figures depending on content type and tokenizer.

## Expected output format

```text
✅ git status          │ git status               │ rtk git status          │    420 →     84 (-80%)
✅ cargo test          │ cargo test 2>&1           │ rtk cargo test          │  12400 →   1240 (-90%)
✅ pytest              │ pytest -v 2>&1 || true    │ rtk pytest -v           │   3200 →    320 (-90%)
...
═══════════════════════════════════════════════════════
  ✅ N good  ⚠️ M skip  ❌ P fail    N/T (PCT%)
  Tokens: TOTAL_UNIX → TOTAL_RTK  (-SAVE_PCT%)
```

## Environment requirements (verified from source)

The benchmark auto-skips sections for unavailable toolchains. Sections and their requirements:

| Section | Requirement |
|---|---|
| ls, find, grep, diff, wc, json, env, log, read, summary | none (uses repo files) |
| git | `git` in PATH; must be run inside a git repo |
| cargo, test, err | `cargo` in PATH |
| curl | `curl` in PATH |
| wget | `wget` in PATH |
| Modern JS (tsc, eslint, vitest, playwright, prisma, pnpm) | `package.json` in CWD; individual binaries in PATH or `node_modules/.bin/` |
| gh | `gh` in PATH and inside a git repo |
| docker | `docker` in PATH |
| kubectl | `kubectl` in PATH |
| python (ruff, pytest) | `python3`, `ruff`, `pytest` all in PATH |
| go (golangci-lint, go test) | `go` and `golangci-lint` in PATH |

Running from the rtk repo root covers git, cargo, grep, find, and most system sections without any extra setup.

## Notes

- The `rtk rewrite` correctness section tests 6 cases (`git status`, `ls -al`, `npm exec`, `cargo test`, compound `cargo test && git push`). These are included in GOOD/FAIL counts and affect the 80% gate.
- Debug files in `scripts/benchmark/{unix,rtk,diff}/` are only written when `$CI` is unset. In CI mode the directory is not created.
- The `scripts/rtk-economics.sh` script generates README table data by running commands on a sample project and computing aggregate session-level estimates. This is what produces the README benchmark table — it is not an independent measurement but a projection based on per-command measurements.
- Source-reviewed version: `tools/rtk/` vendored at `v0.35.0` (`Cargo.toml`). The benchmark script is the copy at `tools/rtk/scripts/benchmark.sh`.
