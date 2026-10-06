# Changelog

## 0.1.0

First tagged version.

### What exists
- CLI: `run --from X --to Y`, `list-scenarios`, `validate`. Exit codes: `0` same or costs
  changed, `1` behavior changed or broke, `2` tool failure.
- Scenarios in `preflight.config.yml` (contract, function, typed arguments, optional submit,
  per-scenario cost threshold).
- Two real `stellar/quickstart` networks, one per protocol version, the same scenarios on both,
  and a diff with five verdicts: `SAME`, `COSTS_CHANGED`, `BEHAVIOR_CHANGED`, `BROKE`, `ERROR`.
- A check that each network's ledger reports the requested protocol before any scenario runs.
- Per-network contract and account identities normalized before diffing, so only real
  differences are reported.
- Markdown and JSON reports; a composite GitHub Action (`action/action.yml`).
- Four small example contracts with checked-in wasm and checksums.

### Verified
- Unit tests for the diff engine, normalization, config loading, argument encoding and reports.
- A real 27 to 28 run, reproduced twice with identical numbers (see the README).

### Known limitations
- The automated CI integration test boots one network. The two-network path runs only in the
  manual `Real cross-version diff` workflow.
- The example contracts are tiny; their cost figures are RPC simulation estimates and should not
  be extrapolated.
- The roughly 6% to 9% instruction drop from 27 to 28 has not been traced to a cause.
- The GitHub Action wrapper is not yet verified end to end.
- Requires Docker. Networks use `stellar/quickstart:latest` with `--protocol-version`.
