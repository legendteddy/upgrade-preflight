# Upgrade Preflight

A CLI + GitHub Action that tells Soroban developers whether their smart contracts behave the
same, cost the same, or break after a Stellar protocol upgrade — by actually running both
protocol versions on real local networks and diffing the results. Node operators have upgrade
tooling built around them; contract developers get a short Testnet window before each Mainnet
vote and no easy way to answer "will my contract break or get more expensive on the new
protocol?" This does that check, deterministically, with no AI/LLM involved anywhere.

**See a real result without Docker:** the
[Upgrade Preflight playground](https://stellarbrief.github.io/playground/preflight/) shows the real
recorded 27 to 28 and 28 to 29 reports and re-runs this tool's diff engine on them in your browser.

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
- The automated CI integration test boots **one** `stellar/quickstart` network at protocol 27
  (on a pinned image tag, see below), deploys the example contracts, runs every scenario, and
  checks resource data comes back. It does not compare two protocol versions.
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

### A second real result: protocol 28 → 29

Taken the day after protocol 29's stellar-core release, on the then-current
`stellar/quickstart:latest`. Two runs were identical. Details are in
[`docs/samples/`](docs/samples/).

| Scenario | Verdict | Instructions (28 → 29) |
| --- | --- | --- |
| say-hello | SAME | 336076 → 331176 (-1.5%) |
| increment-counter | SAME | 338842 → 333954 (-1.4%) |
| read-counter | SAME | 331274 → 325386 (-1.8%) |
| sum-to-1000 | SAME | 311611 → 306731 (-1.6%) |
| restricted-call | SAME | 324317 → 319423 (-1.5%) |

All verdicts are `SAME` because the changes are under the default 5% threshold; behavior, events
and every other resource are identical. The protocol 28 figures here match the protocol 28
figures in the 27 → 28 table exactly, even though they came from different image builds.

### The quickstart image decides what you can test

The core version inside a `stellar/quickstart` image determines which protocols it can run, and
`latest` moves. On 2026-10-06 `latest` was republished; after that, protocol 27 stopped running
on it (the first contract upload failed with a host error), while 28 and 29 ran fine. The
27 → 28 result above was taken on the image that `latest` pointed to before that
(`v672-b1475.1-latest`). The cause inside the image has not been investigated.

- Pass `--image <ref>` (CLI) or the `image` input (Action and workflow) to choose the image. The
  report records it.
- The CI integration test pins a tag so it doesn't break when `latest` moves.
- For reproducible results, pin a tag from Docker Hub's list; for a new protocol, use a newer one.

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
