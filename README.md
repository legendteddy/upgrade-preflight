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

## Example output

The command above prints a Markdown report like this. Protocol 28 introduced Soroban host
changes (CAP-85); this specific sample was NOT captured from a real run in this environment
(Docker isn't available here — see `PLAN.md`), so it's illustrative, not a real result:

```markdown
# Upgrade Preflight: protocol 27 → 28

**Overall verdict: ⚠️ COSTS_CHANGED**

| Scenario | Verdict | Baseline | Target | Notes |
| --- | --- | --- | --- | --- |
| say-hello | ✅ SAME | ok | ok | Same behavior and resource usage within threshold. |
| increment-counter | ✅ SAME | ok | ok | Same behavior and resource usage within threshold. |
| read-counter | ✅ SAME | ok | ok | Same behavior and resource usage within threshold. |
| sum-to-1000 | ⚠️ COSTS_CHANGED | ok | ok | Same behavior, but resource usage changed beyond the 5% threshold: instructions +7.2% (100000 -> 107200). |
| restricted-call | ✅ SAME | ok | ok | Same behavior and resource usage within threshold. |
```

A protocol 28 vs 29 run is expected to report `SAME`, since the real Protocol 29 release
(see `stellarbrief/advisory-brief`'s own fixture) is a security fix with no other relevant
changes — that's a valid, useful result worth having the tool confirm, not a sign it isn't
doing anything.

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

See [`ISSUES_BACKLOG.md`](ISSUES_BACKLOG.md) for ~20 scoped, ready-to-pick-up issues, and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the fuller design writeup.

## Contributing via Stellar Wave

This repo is applying to the [Stellar Wave Program](https://docs.drips.network/wave/), where
maintainers list scoped issues and outside contributors solve them for points. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, the PR flow, and how issues are rated.

## License

MIT — see [`LICENSE`](LICENSE).
