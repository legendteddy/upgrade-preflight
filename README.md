# Upgrade Preflight

A CLI + GitHub Action that tells Soroban developers whether their smart contracts behave the
same, cost the same, or break after a Stellar protocol upgrade — by actually running both
protocol versions on real local networks and diffing the results. Node operators have upgrade
tooling built around them; contract developers get a short Testnet window before each Mainnet
vote and no easy way to answer "will my contract break or get more expensive on the new
protocol?" This does that check, deterministically, with no AI/LLM involved anywhere.

## How it works

1. You describe a set of contract-call scenarios in `preflight.config.yml`.
2. `upgrade-preflight run --from 27 --to 28` boots two real, local
   [`stellar/quickstart`](https://github.com/stellar/quickstart) networks — one per protocol
   version — deploys your contracts, and runs every scenario against both.
3. It diffs the results and reports one of five verdicts per scenario (and overall):
   `SAME`, `COSTS_CHANGED`, `BEHAVIOR_CHANGED`, `BROKE`, or `ERROR` (a tool/network failure,
   never a statement about your contract).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for exactly what each verdict means and two
non-obvious rules (an exactly-at-threshold cost change is `SAME`; two versions failing
identically is `SAME`, not `BROKE`).

## Quickstart

Requires [Docker](https://docs.docker.com/get-docker/).

```bash
git clone https://github.com/stellarbrief/upgrade-preflight.git
cd upgrade-preflight
npm install
npm run build
node dist/cli/index.js run --from 27 --to 28
```

This runs the bundled `preflight.config.yml` and its four example contracts (see
[`examples/`](examples/)) against protocol 27 and 28.

## What has and hasn't been verified

- The diff engine (verdict rules, thresholds, bigint-safe comparison) is unit-tested.
- The automated CI integration test boots **one** `stellar/quickstart` network at protocol 27,
  deploys the example contracts, runs every scenario, and checks resource data comes back. It
  does not compare two protocol versions.
- The full two-network comparison (`run --from X --to Y`) is exercised by the manual
  **Real cross-version diff** workflow (`.github/workflows/real-diff.yml`), which uploads the
  Markdown and JSON reports as artifacts. Before each report the tool checks that the RPC's
  `getNetwork().protocolVersion` (documented as the protocol of the latest ledger) matches the
  requested protocol, and fails if it doesn't.

### A real captured result: protocol 27 → 28

From the workflow's runs on the bundled `preflight.config.yml` and its four example contracts.
Two independent runs produced identical numbers. The full report and where it came from are in
[`docs/samples/`](docs/samples/).

| Scenario | Verdict | Instructions (27 → 28) |
| --- | --- | --- |
| say-hello | COSTS_CHANGED | 360010 → 336076 (-6.6%) |
| increment-counter | COSTS_CHANGED | 368190 → 338842 (-8.0%) |
| read-counter | COSTS_CHANGED | 362598 → 331274 (-8.6%) |
| sum-to-1000 | COSTS_CHANGED | 342106 → 311611 (-8.9%) |
| restricted-call | COSTS_CHANGED | 344204 → 324317 (-5.8%) |

Return values, emitted events, disk reads, writes and footprint entries were identical across
both protocols; the minimum resource fee moved by 0.1% to 0.2%.

What this does and doesn't show:

- These are tiny example contracts, and the figures are `simulateTransaction` estimates from the
  RPC, not on-ledger metered costs. Don't extrapolate them to real contracts.
- The drop is roughly constant across very different scenarios, which suggests a change in
  fixed per-call overhead rather than in contract logic. That is an interpretation; this project
  has not traced it to a specific protocol change.
- The automated CI integration test still boots a single network. The two-network path runs only
  in the manual workflow above.

## How verdicts work, and their limits

Every report states exactly how many scenarios ran and includes an explicit "untested code
paths are not covered" disclaimer — `upgrade-preflight` only tells you about the specific
contract calls you gave it scenarios for. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#what-this-tool-does-not-prove).

## Writing your own scenarios

See [`docs/WRITING_SCENARIOS.md`](docs/WRITING_SCENARIOS.md).

## Using it in CI

See [`docs/CI_USAGE.md`](docs/CI_USAGE.md) for the GitHub Action and exit codes.

## Roadmap

See [`ISSUES_BACKLOG.md`](ISSUES_BACKLOG.md) for scoped, ready-to-pick-up issues, and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the fuller design writeup.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, the PR flow, and how issues are rated.

## License

MIT — see [`LICENSE`](LICENSE).
