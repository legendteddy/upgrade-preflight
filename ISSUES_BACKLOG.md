# Issues backlog

Candidate issues, each written to be posted to GitHub as-is. Every entry states the current
state at a specific commit, what to build, how to verify it, and what is out of scope.
Complexity (Trivial / Medium / High) follows the tiers in [`CONTRIBUTING.md`](CONTRIBUTING.md).
If you pick one up, comment on the issue first so two people don't build the same thing.

Audited commit: `3235411`

---

### 1. Run a real two-protocol comparison in the CI integration job
**Complexity:** Medium

**Description**
The tool's central behavior (same scenarios on two protocol versions, then a diff) is only
exercised by hand. A regression in the two-network path would not fail CI.

**Current state**
`src/runner/run.integration.test.ts` boots one network at protocol 27 and diffs the result
against itself with `diffRun(27, 27, results, results, ...)`, which always returns `SAME`. The
two-network path in `src/cli/index.ts` runs only through the manual workflow
`.github/workflows/real-diff.yml`. That workflow found a real bug (per-network contract IDs made
every scenario look changed, fixed in `src/sdk/normalize.ts`) which no test had caught.

**What to build**
An integration test that calls `runAgainstProtocol` for protocol 27 and 28 on different host
ports and diffs them with `diffRun`. It should assert that every scenario has `status: 'ok'` on
both sides, that no scenario has verdict `ERROR`, and that the read-only scenarios have equal
events after normalization. State the CI time added (roughly four extra minutes) and decide
whether it runs on every push or on a schedule.

**Acceptance criteria**
- [ ] The test fails if the identity normalization in `src/runner/run.ts` is removed.
- [ ] It skips cleanly, with a logged reason, when Docker is unavailable (same as the existing test).
- [ ] The PR states the CI time impact and the chosen trigger.

**Out of scope**
Asserting specific instruction counts. Changing the diff engine or thresholds.

**Verification**
`npm run test:integration` with Docker running.

---

### 2. Explain the instruction-count drop from protocol 27 to 28
**Complexity:** Medium (investigation)

**Description**
The first real 27 to 28 run showed instructions down 5.8% to 8.9% in every scenario. The
absolute drop is nearly constant (about 20k to 31k) even for very different scenarios, which
suggests a fixed per-call cost changed. That is a guess. Nobody has measured it.

**Current state**
The README's "A real captured result" section has the numbers (for example `sum-to-1000`:
342106 to 311611). `examples/contracts/heavy-loop` exposes `sum_to(n)`, so cost can be varied
with the amount of work.

**What to build**
Run `sum_to` with several values of n (for example 0, 1000, 10000, 100000) on protocols 27 and
28 using a scratch config, and separate the fixed cost from the per-iteration cost on each
protocol. Write the result to `docs/FINDINGS_27_TO_28.md` with the raw JSON reports linked or
committed. Trace the cause to a protocol change only if you can cite a source; otherwise say it
is unknown.

**Acceptance criteria**
- [ ] A table of n against instructions for both protocols, from real runs.
- [ ] A clear statement of what the data does and does not establish.
- [ ] No change is attributed to a specific CAP without a link to its text.

**Out of scope**
Changing thresholds, the diff engine, or the example contracts.

**Verification**
After `npm run build`, reproduce any one row with
`node dist/cli/index.js run --from 27 --to 28 --config <your config>`.

---

### 3. Compare more than two protocol versions in one run
**Complexity:** High

**Description**
To see which protocol introduced a change you currently have to run several two-version
comparisons by hand.

**Current state**
`upgrade-preflight run --from X --to Y` (`src/cli/index.ts`) boots exactly two networks on host
ports 8000 and 8001, runs every scenario on both, and diffs once. The JSON report has
`schemaVersion: 1` and a single `fromProtocol`/`toProtocol` pair.

**What to build**
`--protocols 27,28,29` that runs each version once, sequentially, and diffs each adjacent pair,
producing one combined report that attributes each change to its version boundary.

**Acceptance criteria**
- [ ] `--from`/`--to` keeps working unchanged.
- [ ] Each version's network is started once, not once per pair.
- [ ] The Markdown report labels each change by boundary (for example "27 to 28").
- [ ] The JSON report bumps `schemaVersion` and documents the new shape.
- [ ] Unit tests cover pair generation and verdict attribution without Docker.

**Out of scope**
Running networks in parallel. Diffing non-adjacent versions.

**Verification**
Unit tests (`npm test`), plus a real run: `node dist/cli/index.js run --protocols 27,28`.

---

### 4. Add a real-world contract corpus
**Complexity:** Medium

**Description**
The four example contracts are tiny, so the first real result says little about real contracts.

**Current state**
`examples/contracts/` has `hello-world`, `counter`, `heavy-loop` and `auth`, each with a
checked-in `.wasm` under `examples/wasm/` and a `CHECKSUMS.txt`.

**What to build**
Add two or three contracts taken from an open-source upstream Stellar repository (for example
one with token-style storage and events), pinned to a specific upstream commit and built with
the documented steps. Add a second config, `preflight.corpus.config.yml`, with scenarios that
cover a success path and one failure path per contract.

**Acceptance criteria**
- [ ] The upstream repository, commit and license are recorded next to the sources.
- [ ] The wasm builds reproducibly and its checksum is added to `CHECKSUMS.txt`.
- [ ] The PR includes the Markdown report from a real 27 to 28 run of the new config.

**Out of scope**
Downloading wasm at run time. Changing the diff logic.

**Verification**
Follow `examples/README.md` to build, then `node dist/cli/index.js run --from 27 --to 28 --config preflight.corpus.config.yml`.

---

### 5. Verify the checked-in wasm checksums in CI
**Complexity:** Trivial

**Description**
A contract source change that forgets to rebuild its wasm would go unnoticed.

**Current state**
`examples/wasm/CHECKSUMS.txt` lists a SHA-256 per file in `sha256sum` format
(`<hash> *<file>`). Nothing in `.github/workflows/ci.yml` checks it.

**What to build**
A CI step in the `unit` job that runs `sha256sum -c CHECKSUMS.txt` from `examples/wasm/` and
fails with a message naming the mismatched file.

**Acceptance criteria**
- [ ] The step passes on `main` today.
- [ ] Altering one byte of a wasm makes the step fail and name that file.

**Out of scope**
Rebuilding the wasm in CI.

**Verification**
Run the same `sha256sum -c` command locally before and after altering a copy of a wasm file.

---

### 6. Add a per-scenario timeout
**Complexity:** Medium

**Description**
A hung RPC call stalls the whole run with no clear error.

**Current state**
`runScenario` in `src/runner/run.ts` has no explicit timeout around building, simulating or
submitting a scenario. Only network startup is bounded (`waitHealthy`, 120 seconds).

**What to build**
An optional `timeoutMs` (per scenario, with a global default in the config schema) that turns a
timed-out scenario into a result with `status: 'error'` and a clear message, which the diff
engine already reports as `ERROR`.

**Acceptance criteria**
- [ ] A scenario that exceeds its timeout reports `ERROR` and the run continues.
- [ ] The config schema documents the new field and its default.
- [ ] A unit test uses an injected slow function and a fake clock.

**Out of scope**
Retrying a timed-out scenario.

**Verification**
`npm test`.

---

### 7. Post the report as a pull request comment from the GitHub Action
**Complexity:** High

**Description**
The report is only visible in the job summary, which reviewers rarely open.

**Current state**
`action/action.yml` builds the CLI, runs it, and appends the Markdown to `$GITHUB_STEP_SUMMARY`.
`docs/CI_USAGE.md` documents the inputs and exit codes.

**What to build**
An opt-in `comment-on-pr` input that posts the report as a PR comment using the run's own
`GITHUB_TOKEN`, and updates that same comment on re-runs instead of adding new ones.

**Acceptance criteria**
- [ ] Re-running the workflow edits the existing comment.
- [ ] It does nothing on non-PR events and when the token cannot write (for example fork PRs).
- [ ] `docs/CI_USAGE.md` documents the input and the permissions it needs.

**Out of scope**
Other CI providers. Failing the build based on the comment.

**Verification**
Run the action from a test repository's pull request and link the resulting comment in your PR.

---

### 8. Import a scenario from a transaction hash
**Complexity:** High

**Description**
Scenarios are hand-written YAML. A developer who saw a transaction fail has to translate it by
hand.

**Current state**
`src/config/schema.ts` defines the scenario shape (contract, function, typed args). Argument
encoding is in `src/sdk/args.ts`. There is no import path.

**What to build**
`upgrade-preflight import-tx --hash <hash> --rpc <url>` that fetches the transaction, decodes
its contract invocation (contract, function, arguments), and prints a scenario in the existing
YAML shape. Argument types the schema cannot express should produce a clear error, not a wrong
scenario.

**Acceptance criteria**
- [ ] Works against a captured Testnet transaction fixture in unit tests, without network access.
- [ ] A clear error when the invocation uses an unsupported argument type.
- [ ] A clear message that the contract's wasm must be supplied separately.

**Out of scope**
Deploying the contract automatically. Mainnet credentials.

**Verification**
Unit tests with the fixture, plus a manual run against a public Testnet RPC.

---

### 9. Cover argument-encoding edge cases in tests
**Complexity:** Trivial

**Description**
Bad arguments should fail with a clear message, and every supported type should be tested.

**Current state**
`src/sdk/args.test.ts` covers five cases: `u32`, an `i128` given as a string, `symbol`, the
`source-account` sentinel, and `bytes` as hex. The schema also supports `i32`, `u64`, `i64`,
`u128`, `bool`, `string` and `address`, which have no tests.

**What to build**
Tests for each untested type, including a non-ASCII `string`, `u64`/`i64`/`u128` boundary values,
a negative value for an unsigned type, and an invalid `address`. Fix `toScVal` only if a test
exposes a real bug.

**Acceptance criteria**
- [ ] Every type in `ScVarArgSchema` has at least one passing test.
- [ ] Invalid input is asserted to throw with a readable message.

**Out of scope**
Adding new argument types.

**Verification**
`npm test`.
