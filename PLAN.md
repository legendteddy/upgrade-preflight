# PLAN: upgrade-preflight

## Goal

A CLI + GitHub Action that tells Soroban contract developers whether their contracts
behave the same, cost the same, or break after a Stellar protocol upgrade — by actually
running both versions against real scenarios on local `stellar/quickstart` networks and
diffing the results. Deterministic, no AI/LLM calls.

## Verified facts (re-checked live against current sources on 2026-09-29, not carried over
from an older draft)

Source: `https://raw.githubusercontent.com/stellar/quickstart/master/README.md` (fetched
directly) and `https://github.com/stellar/quickstart/blob/main/action.yml` (fetched via the
GitHub contents API and base64-decoded).

- Local network launch: `docker run -d -p "8000:8000" --name stellar stellar/quickstart --local`
- `--local` mode flags: `--protocol-version {n}` (default: latest supported by the image),
  `--limits {default|testnet|unlimited}` (default when omitted is `default`, which is
  stellar-core's very low built-in limits — **we always pass `--limits testnet` explicitly**
  so resource numbers are comparable to what contracts actually see on Testnet).
- `--enable core,horizon,rpc` — in `--local` mode `core` always runs regardless of `--enable`;
  `horizon` runs whenever `rpc` is requested (so friendbot is available); `friendbot` runs
  whenever `horizon` runs. We pass `--enable core,horizon,rpc` explicitly for clarity even
  though it's the default.
- Single main port **8000** multiplexes horizon, stellar-rpc (JSON-RPC at `/rpc`) and friendbot
  (`/friendbot?addr=G...`).
- Network passphrase, fixed: `Standalone Network ; February 2017`
- Root account, fixed (derived from the passphrase): public
  `GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI`, secret
  `SC5O7VZUXDJ6JBDSZ74DSERXL7W3Y5LTOAMRF7RQRL3TAGAPS7LUVG3L`. We fund scenario source accounts
  via friendbot (matches how real developers will use the tool against Testnet-shaped limits),
  not the root account directly.
- A real composite GitHub Action, `stellar/quickstart@main`, exists and does exactly the
  container-boot-and-health-wait dance: inputs `tag` (default `latest`), `enable` (default
  `core,horizon,rpc`), `network` (default `local`), `protocol_version` (default blank = image
  default), `health_interval`/`health_timeout`/`health_retries`. It maps ports 8000, 11626,
  11726, 11826 and polls `docker inspect`'s health status, where the container's own healthcheck
  is `curl POST /rpc {getHealth}` grep `healthy` AND `curl /friendbot` grep the expected
  `invalid_field` error body (i.e. friendbot answering at all, not a real funded response).
  Our own driver mirrors this same shape (docker run + healthcheck poll) rather than shelling
  out to someone else's action, because we need to run it twice sequentially (baseline, then
  target) with teardown between, which a single action invocation doesn't fit — but our
  `/action` GitHub Action wrapper documents `stellar/quickstart@main` as the reference
  implementation of "how to wait for this image to be healthy" in `ADDING_A_NETWORK_BACKEND.md`.
- `@stellar/stellar-sdk` latest published version at build time: `17.2.0` (`npm view
  @stellar/stellar-sdk version`). Soroban RPC methods used: `simulateTransaction`,
  `sendTransaction`, `getTransaction`, `getHealth` — verified against the installed package's
  own TypeScript types in `node_modules/@stellar/stellar-sdk/lib/esm/rpc/api.d.ts` rather than
  assumed from memory of an older SDK version.
- **Resource field names, verified by reading the actual XDR type
  (`lib/esm/xdr/generated/soroban-resources.d.ts`), not assumed**: the metered resources on a
  simulated transaction are `instructions`, `diskReadBytes`, and `writeBytes` — there is no
  `cpuInsns` or `memBytes` field; memory is not part of the declared Soroban resources at all.
  `SimulateTransactionSuccessResponse.transactionData` is a `SorobanDataBuilder`; calling
  `.build()` gives the raw `SorobanTransactionData` XDR, whose `.resources` holds the three
  fields above plus `.footprint` (`readOnly`/`readWrite` ledger key arrays, whose lengths give
  read/write entry counts). `minResourceFee` IS a flat string field on the success response, as
  originally assumed. `src/sdk/simulate.ts` isolates this exact extraction in one place.

## Unverified assumptions (isolated behind `src/network/quickstart.ts` and
`src/sdk/simulate.ts` so they're easy to fix in one place)

- Exactly which protocol version numbers the currently-published `stellar/quickstart:latest`
  image tag supports for `--protocol-version` was NOT verified by actually booting the image
  (Docker is not installed in this build environment — see "Environment limits" below). The
  demo docs use protocol 27 vs 28 as instructed by the spec, but the actual command a user runs
  is `upgrade-preflight run --from 27 --to 28`, and if the installed image doesn't support one
  of those, the tool will report a clear `ERROR` verdict (network never reached `healthy`), not
  a silent wrong answer.
- The exact resource/cost field NAMES (`instructions`, `diskReadBytes`, `writeBytes`,
  `minResourceFee`) are verified against the installed SDK's actual XDR type definitions (see
  above) — but the numeric VALUES a real network would return for any given contract call were
  never observed, since no local network could be booted here. `src/sdk/simulate.ts` isolates
  the extraction in one function with a unit test against a hand-built fixture matching the
  real type shape, so a field-name drift in a future SDK version fails a fast unit test instead
  of silently mis-mapping data.

## Environment limits during this build

Docker is not installed on this machine, so:
- The network driver (`src/network/`) is built and unit-tested against a mocked
  `child_process`, per the spec — this is exactly what the spec's own test plan calls for.
- The integration test suite (`npm run test:integration`) is written and DOES exercise a real
  two-network run against the `hello-world` example, but it could not actually execute here —
  confirmed live: it skips cleanly (`1 passed | 1 skipped`, with a console message naming
  "Docker is not available"), not failing, exactly as designed.
- The README/demo output for the protocol 27 vs 28 comparison is clearly labeled as sample
  output, not a real captured run, per the spec's explicit instruction not to present output as
  real unless it was actually run.

Rust and the `wasm32v1-none` target ARE available (via WSL) and `stellar-cli` 27.1.0 is
installed, so the four example contracts (`hello-world`, `counter`, `heavy-loop`, `auth`) are
real, compiled `.wasm` files, not stubs — built via `stellar contract build` (confirmed: all
four compiled cleanly, 516–818 bytes each, checksums in `examples/wasm/CHECKSUMS.txt`) and
copied into the committed `examples/wasm/` directory the config and CI actually reference. The
CLI itself was run end-to-end against the real config (`validate`, `list-scenarios`, and `run`,
which correctly reports "Docker is not available" and exits 1) — the only thing not verified
live in this environment is an actual two-network Docker run, which CI's `integration` job
(GitHub-hosted `ubuntu-latest` runners ship Docker) will exercise for real on first push.

**Real build-config finding**: `tsc -p tsconfig.build.json` (emit mode, `noEmit: false`) failed
to resolve ambient Node globals (`process`, `Buffer`, `fetch`, `node:*` imports) even though
`tsc --noEmit` against the same `tsconfig.json` it extends worked fine — `@types/node` was
correctly installed and deduped in `node_modules/@types/node`, so this wasn't a missing
dependency. Adding an explicit `"types": ["node"]` to `tsconfig.build.json`'s own
`compilerOptions` (overriding the inherited automatic-inclusion behavior) fixed it. The root
cause wasn't fully isolated beyond that — noted here rather than left silent, since "why did
adding this line fix it" is exactly the kind of thing a future contributor hitting the same
error would want on record.

## Architecture

```
/src/cli/            command definitions (run, list-scenarios, validate-config)
/src/config/         zod schema + loader for preflight.config.yml
/src/network/        quickstart driver: start(protocolVersion), waitHealthy, fundAccount, stop
/src/sdk/            thin, isolated wrapper around @stellar/stellar-sdk simulate/deploy calls
/src/runner/         deploys wasm, executes scenarios, captures results into ScenarioResult
/src/diff/           compares two ScenarioResult sets, applies thresholds, computes verdicts
/src/report/         Markdown + JSON renderers
/action/             composite GitHub Action wrapper around the CLI
/examples/           hello-world, counter, heavy-loop, auth — real Soroban contracts + wasm
/docs/               ARCHITECTURE.md, WRITING_SCENARIOS.md, ADDING_A_NETWORK_BACKEND.md, CI_USAGE.md
```

## Build order

1. PLAN.md (this file), repo scaffold, CI, lint/test setup
2. Config schema + diff engine + verdict logic + unit tests
3. Report renderers + snapshot tests
4. Network driver (quickstart) with mocked-process tests
5. SDK wrapper + runner (deploy + scenarios), integration test (skips cleanly without Docker)
6. CLI + GitHub Action wrapper
7. Examples (real compiled contracts), docs, templates, ISSUES_BACKLOG.md
8. Final pass: lint, typecheck, unit tests, production build; fix everything

## Rules followed

- Do not invent flags, endpoints or response fields — see "Verified facts" and "Unverified
  assumptions" above.
- Never print secret keys in logs or reports — only test/local keys are ever generated, and the
  report renderer strips any `S...` secret-looking string defensively as a second layer.
- Not pushing anything — the user pushes this repo themselves.
