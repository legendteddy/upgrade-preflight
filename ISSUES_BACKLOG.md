# Issues backlog

20 scoped issues, ready to post to GitHub. Complexity ratings follow the
[Stellar Wave Program](https://docs.drips.network/wave/)'s three tiers.

## Trivial (8)

### 1. Add a `--quiet` flag to suppress the per-network startup log lines
The CLI logs "Starting baseline network..." etc. to stderr unconditionally. Add a `--quiet`
flag to `upgrade-preflight run` that suppresses these, for cleaner CI logs when the Markdown
report is the only wanted output.
- [ ] `--quiet` suppresses the two `console.error` startup lines in `src/cli/index.ts`
- [ ] Markdown/JSON output is unaffected
- Suggested files: `src/cli/index.ts`

### 2. Publish a JSON Schema for `preflight.config.yml`
Generate a JSON Schema from `PreflightConfigSchema` (zod has `z.toJSONSchema()`) and commit it,
so editors can offer autocomplete/validation on the YAML config.
- [ ] `schema/preflight.config.schema.json` is generated and committed
- [ ] A script or npm command regenerates it
- Suggested files: `src/config/schema.ts`, new `scripts/generate-schema.ts`

### 3. Add a README badge row (CI status, license, npm if published)
- [ ] Badges render correctly on GitHub
- Suggested files: `README.md`

### 4. Improve the "no target result" error message in `diffRun`
Currently a generic "No target-run result was captured..." — include the full list of scenario
names that WERE found in the target run, to make debugging a typo'd scenario name faster.
- [ ] Error message lists available scenario names
- [ ] Existing test in `src/diff/engine.test.ts` still passes; add one for the new message content
- Suggested files: `src/diff/engine.ts`

### 5. Add a `hello-world` variant scenario with a non-ASCII string argument
Exercises the `string` arg type's UTF-8 handling explicitly.
- [ ] New scenario added to `preflight.config.yml` and covered by a unit test on `src/sdk/args.ts`
- Suggested files: `preflight.config.yml`, `src/sdk/args.test.ts`

### 6. Document the exit codes in `--help` output
`upgrade-preflight run --help` should mention exit codes 0/1/2 inline, not just in
`docs/CI_USAGE.md`.
- [ ] `commander`'s `.addHelpText('after', ...)` used to append the exit code table
- Suggested files: `src/cli/index.ts`

### 7. Add a CONTRIBUTING.md note on WSL/Docker Desktop quirks
Docker Desktop on Windows via WSL2 has known port-binding gotchas; document the one workaround
maintainers actually needed (if any) building this repo.
- [ ] A short "Known environment quirks" section added
- Suggested files: `CONTRIBUTING.md`

### 8. Rename `contractError` to `errorMessage` for clarity — or document why not
`ScenarioDiff.baseline.contractError`/`.target.contractError` reads oddly for a genuine
tool-level `ERROR` scenario (where it's always `null`). Either rename for clarity or add a
one-line doc comment on `ScenarioResult` explaining the distinction from `toolError`.
- [ ] Either the rename lands (with all call sites and tests updated) or a doc comment is added
- Suggested files: `src/diff/types.ts`

## Medium (8)

### 9. Add an HTML report renderer
A `toHtml(diff: RunDiff): string` alongside `toMarkdown`/`toJson`, styled minimally, for
attaching to CI artifacts or publishing as a GitHub Pages report.
- [ ] `src/report/html.ts` with the same coverage-disclaimer guarantee as `toMarkdown`
- [ ] Unit tests mirroring `src/report/markdown.test.ts`
- [ ] `--html-out` flag wired up in the CLI
- Suggested files: `src/report/html.ts`, `src/cli/index.ts`

### 10. Support running scenarios concurrently within one network
`runAgainstProtocol` currently executes scenarios sequentially. For configs with many
independent (non-state-mutating) scenarios, running them concurrently against the same network
would speed up CI significantly.
- [ ] A `--concurrency <n>` flag (default 1, preserving today's behavior)
- [ ] Scenarios with `submit: true` against the same contract are still serialized relative to
  each other, to avoid sequence-number races
- Suggested files: `src/runner/run.ts`, `src/cli/index.ts`

### 11. Make the network backend pluggable via config
Currently `src/runner/run.ts` hardcodes `startQuickstart`. Add a `network.backend` config field
(default `quickstart`) and a small registry, per `docs/ADDING_A_NETWORK_BACKEND.md`.
- [ ] `PreflightConfigSchema` gains an optional `network.backend` field
- [ ] At least the existing quickstart backend is selectable by name
- [ ] `docs/ADDING_A_NETWORK_BACKEND.md` updated to reflect the registry
- Suggested files: `src/config/schema.ts`, `src/runner/run.ts`, `src/network/`

### 12. Verify `examples/wasm/CHECKSUMS.txt` in CI
Add a CI step that recomputes SHA-256 over `examples/wasm/*.wasm` and fails if it doesn't match
`CHECKSUMS.txt`, catching a stale checked-in wasm after a contract source change.
- [ ] New CI step (or script invoked by one) in `.github/workflows/ci.yml`
- [ ] Fails with a clear message naming the mismatched file
- Suggested files: `.github/workflows/ci.yml`, new `scripts/verify-checksums.sh`

### 13. Add a `Testnet` read-only mode (no local Docker network)
For a quick sanity check without spinning up Docker: run all scenarios as read-only
simulations against public Testnet RPC on both "before" and "after" by pinning to specific
ledger sequences, where possible — otherwise document why this can't fully substitute for the
local-network mode.
- [ ] A `--testnet-readonly` flag or separate command
- [ ] Clearly documented limits vs. the local-network mode
- Suggested files: `src/cli/index.ts`, `docs/CI_USAGE.md`

### 14. Add per-scenario timeout handling
A hung RPC call currently has no scenario-level timeout — only the underlying HTTP client's
default. Add an explicit, configurable per-scenario timeout that surfaces as a clean `ERROR`
verdict rather than hanging the whole run.
- [ ] `preflight.config.yml` gains an optional `scenario.timeoutMs`
- [ ] A timed-out scenario reports `status: 'error'` with a clear message, not a crash
- Suggested files: `src/config/schema.ts`, `src/runner/run.ts`

### 15. Cache the Docker image pull between the two protocol runs
Right now each `startQuickstart` call implicitly pulls (or reuses, if Docker already has it)
the same `stellar/quickstart:latest` image twice. Add an explicit `docker pull` step with
retries (mirroring `stellar/quickstart@main`'s own action.yml pattern) run once up front.
- [ ] Image pulled once, with retry-with-backoff, before either network starts
- [ ] Unit test on the retry logic with a mocked `child_process`
- Suggested files: `src/network/quickstart.ts`

### 16. Add a `list-scenarios --json` output mode
For programmatic consumption (e.g. a PR-comment bot per issue #20) — currently `list-scenarios`
only prints a human-readable line per scenario.
- [ ] `--json` flag prints an array of `{name, contract, function, submit}`
- [ ] Unit test covering the JSON shape
- Suggested files: `src/cli/index.ts`

## High (4)

### 17. Protocol matrix runs (compare N versions in one command)
Extend `run` to accept a comma-separated list of protocol versions (`--protocols 27,28,29`) and
diff each adjacent pair, producing one combined report — useful for seeing exactly which
version introduced a change across a longer-supported contract.
- [ ] `upgrade-preflight run --protocols 27,28,29` runs N networks sequentially and diffs N-1 pairs
- [ ] Combined Markdown report clearly attributes each change to its version boundary
- [ ] Existing two-version `--from`/`--to` usage keeps working unchanged
- Suggested files: `src/cli/index.ts`, `src/runner/run.ts`, `src/report/markdown.ts`

### 18. A plugin system for custom scenario "checks" beyond return-value/event/cost diffing
Let a contributor register a custom assertion function (e.g. "the emitted `transfer` event's
`amount` topic must be within X of a computed value") that runs against both results and can
independently flag a verdict, beyond the built-in return-value/events/cost comparison.
- [ ] A documented plugin interface (`docs/ADDING_A_CHECK.md`)
- [ ] At least one non-trivial example plugin ships in `examples/`
- [ ] Plugin failures compose correctly into the overall verdict severity ordering
- Suggested files: `src/diff/`, new `docs/ADDING_A_CHECK.md`

### 19. Replay real recorded Testnet transactions as scenarios
Given a transaction hash, fetch its real operation + arguments from a public Testnet RPC/Horizon
endpoint and auto-generate a scenario from it (deploying the same contract to the local network
first), so a developer doesn't have to hand-write scenarios for cases they've already seen fail
in the wild.
- [ ] `upgrade-preflight import-tx --hash <hash> --network testnet` scaffolds a scenario
- [ ] Handles the case where the referenced contract's wasm isn't available locally with a clear
  error
- Suggested files: new `src/import/`, `src/cli/index.ts`

### 20. A PR-comment bot for the GitHub Action
When run on a pull request, post the Markdown report as a PR comment (updating a previous
comment rather than piling up new ones), in addition to the job summary the action already
writes.
- [ ] `action/action.yml` gains an opt-in `comment-on-pr: true` input
- [ ] Uses the run's own `GITHUB_TOKEN` — no new secret required
- [ ] Updates a single comment across re-runs instead of duplicating
- Suggested files: `action/action.yml`, new `action/post-comment.sh`
