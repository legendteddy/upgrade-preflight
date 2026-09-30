# Writing scenarios

A `preflight.config.yml` declares which contracts to deploy and which function calls
("scenarios") to run against them on both protocol versions.

## Minimal example

```yaml
contracts:
  - name: hello-world
    wasm: ./examples/target/wasm32v1-none/release/hello_world.wasm

accounts:
  - default

scenarios:
  - name: say-hello
    contract: hello-world
    function: hello
    args:
      - type: symbol
        value: world
```

## Top-level fields

- `contracts` (required, at least one): `{ name, wasm }`. `wasm` is a path to a compiled
  contract, resolved relative to the config file's own directory.
- `accounts` (optional, default `["default"]`): names for the funded accounts scenarios can use
  as their source account. A fresh keypair is generated and funded via friendbot for each name,
  fresh on every run — configs never contain secret keys.
- `thresholds.costPercent` (optional, default `5`): the global resource-change threshold. A
  scenario's own `thresholds.costPercent` overrides this.
- `scenarios` (required, at least one): see below.

## Scenario fields

- `name` (required): must be unique; used to match a baseline result to its target result.
- `contract` (required): must match a `contracts[].name`.
- `function` (required): the contract function to call.
- `args` (optional, default `[]`): an ordered list of typed arguments. Each entry is
  `{ type, value }` (or just `{ type: source-account }`, see below). Supported types:
  `u32`, `i32`, `u64`, `i64`, `u128`, `i128` (the 64/128-bit integer types take `value` as a
  *string*, to avoid JS number precision loss), `bool`, `string`, `symbol`, `address` (a `G...`
  or `C...` strkey), `bytes` (a hex string), and the special `source-account` type described
  below.
- `sourceAccount` (optional, default `"default"`): which named account signs/submits this call.
- `submit` (optional, default `false`): when `false`, the scenario only *simulates* the call
  (no state change, no fee spent) — this is enough to compare behavior and cost. Set `true` for
  scenarios whose state-changing effect you specifically want to exercise (e.g. the `counter`
  example's `increment`).
- `expected` (optional, currently informational — not yet enforced by the diff engine, see
  `ISSUES_BACKLOG.md`): `{ success?, errorContains? }`.
- `thresholds.costPercent` (optional): overrides the global threshold for this scenario only.

### The `source-account` arg type

Some contracts (like the bundled `auth` example) need the transaction's own source account
passed in as a contract argument — for example to call `.require_auth()` on it. Since a fresh
keypair is generated per run, the config can't hardcode that address. Use:

```yaml
args:
  - type: source-account
```

and the runner substitutes the actual funded account's public key at execution time.

## Choosing `submit: true` vs. simulation-only

Simulation (`submit: false`) is cheaper and sufficient for comparing return values, events, and
resource costs — this covers most scenarios. Use `submit: true` only when you need to observe
an actual, finalized state change (for example, to then run a second scenario that reads back
the updated state) — see `examples/preflight.config.yml`'s `counter` scenarios for exactly that
pattern.
