# Architecture

## The problem

A Soroban contract developer gets a short Testnet window before each Mainnet protocol upgrade
vote, but no easy way to answer: "will my contract behave the same, cost the same, or break on
the new protocol?" Node operators have upgrade tooling built around them; contract developers
don't have an equivalent.

## The approach

`upgrade-preflight` runs the *same* set of scenarios (contract calls) against two real local
networks — one on the baseline protocol version, one on the target — using
[`stellar/quickstart`](https://github.com/stellar/quickstart)'s `--local` mode, then diffs the
captured results. Nothing is simulated or guessed: both runs execute real transactions (via
`simulateTransaction`, and real submission for scenarios marked `submit: true`) against a real
`stellar-core` + `stellar-rpc` stack.

## Module map

```
src/config/    preflight.config.yml schema (zod) + YAML loader
src/network/   the stellar/quickstart Docker driver: start, health-check, stop
src/sdk/       thin wrappers around @stellar/stellar-sdk: account funding, arg encoding,
               contract deployment, transaction simulation + resource extraction
src/runner/    orchestrates one full run against one protocol version: fund accounts,
               deploy contracts, execute every scenario, always tear the network down
src/diff/      pure functions: given two ScenarioResult sets, produce verdicts and deltas
src/report/    Markdown + JSON renderers over a RunDiff
src/cli/       the `upgrade-preflight` command line entry point
action/        a composite GitHub Action wrapping the CLI
```

The `diff` and `report` modules take no dependency on the network or SDK modules at all — they
operate purely on the `ScenarioResult`/`RunDiff` data shapes in `src/diff/types.ts`. This is
deliberate: it's what makes the diff logic exhaustively unit-testable without Docker (see
`src/diff/engine.test.ts`), and it's the boundary a contributor adding a new network backend
(see [ADDING_A_NETWORK_BACKEND.md](ADDING_A_NETWORK_BACKEND.md)) needs to produce results for.

## Verdicts

Each scenario gets one of five verdicts, and the overall run takes the worst of all of them
(severity order: `SAME` < `COSTS_CHANGED` < `BEHAVIOR_CHANGED` < `BROKE` < `ERROR`):

| Verdict | Meaning |
| --- | --- |
| `SAME` | Same behavior, resource usage within threshold (default 5%, overridable per scenario). |
| `COSTS_CHANGED` | Same behavior, but CPU instructions, ledger I/O, or `minResourceFee` moved beyond the threshold. |
| `BEHAVIOR_CHANGED` | Different return value or emitted events, or the two versions failed with different errors. |
| `BROKE` | Passed on baseline, failed on target. |
| `ERROR` | The tool itself failed (network never came up, a result went missing) — never a statement about the contract. |

Two behavior choices worth knowing about, since they're not obvious from the verdict names
alone:

- **A cost delta exactly at the threshold is `SAME`, not `COSTS_CHANGED`** — the check is
  "strictly greater than," so a 5% threshold treats a +5.0% change as still within bounds. See
  `src/diff/engine.test.ts`'s "exactly the threshold" tests.
- **When both versions fail, matching errors count as `SAME`** — the reasoning is that a
  contract failing identically on both protocols is *consistent* behavior, even though it's a
  failure; only a *change* in behavior (including which error occurs) is reported as
  `BEHAVIOR_CHANGED`.

## What this tool does not prove

Every report explicitly states the scenario count and that untested code paths are not
covered. `upgrade-preflight` can only tell you about the exact function calls you gave it
scenarios for — it is not a fuzzer, a formal verifier, or a substitute for your own test suite.
