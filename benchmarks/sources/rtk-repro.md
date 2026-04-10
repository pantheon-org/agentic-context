# rtk — Benchmark Reproduction

**Source**: `https://github.com/rtk-ai/rtk` (v0.35.0, master branch)
**Date**: 2026-04-10
**Environment**: macOS Darwin 25.4.0
**Outcome**: not yet run — harness structure verified from source; see notes below

---

## Harness location

```text
scripts/benchmark.sh    # primary benchmark harness
scripts/rtk-economics.sh  # session-level economics estimates
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

## What the harness measures

- Runs live commands (`git status`, `cargo test`, `pytest -v`, `go test -v`, `golangci-lint`, etc.) on temporary fixtures created in `mktemp -d` directories.
- Compares `ceil(chars / 4)` token estimates for raw output vs rtk-filtered output.
- Reports per-test: name, raw command, rtk command, raw tokens, filtered tokens, savings %.
- Reports aggregate: total raw tokens, total filtered tokens, overall savings %.
- Exits non-zero if fewer than 80% of tests show improvement.
- Optionally writes per-test debug files to `scripts/benchmark/{unix,rtk,diff}/` when run outside CI.

## Token estimation methodology

The harness uses `ceil(${#output} / 4)` (bash string length / 4) as the token proxy — the same `ceil(chars / 4)` heuristic used by `rtk gain`. This is not a real LLM tokenizer. Actual savings for the same output could differ by 20-30% depending on the tokenizer and content type.

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

## Notes

- The `rtk rewrite` subcommand section verifies that compound commands (`cargo test && git push`) are correctly rewritten to `rtk cargo test && rtk git push`. This is a correctness test, not a token test.
- Sections that require toolchains not installed on the host machine are skipped silently.
- The `scripts/rtk-economics.sh` script generates README table data by running commands on a sample project and computing aggregate session-level estimates. This is what produces the README benchmark table — it is not an independent measurement but a projection based on per-command measurements.
