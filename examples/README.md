# Example contracts

Four small, real Soroban contracts used as upgrade-preflight's own test fixtures and as the
demo case in the root [README](../README.md). Each targets a different kind of resource usage
so the diff engine has something distinct to report on:

| Contract | Exercises |
| --- | --- |
| `hello-world` | The default `stellar contract init` template — a pure, read-only call. |
| `counter` | Ledger read/write resource accounting (instance storage). |
| `heavy-loop` | CPU instruction cost, with no ledger I/O at all. |
| `auth` | `require_auth` / authorization resource cost. |

## Building

```bash
cd examples
stellar contract build
```

Compiled `.wasm` files land under `target/wasm32v1-none/release/` (gitignored — see the root
`.gitignore`). Committed, stable copies used by `../preflight.config.yml` and CI live in
[`wasm/`](wasm/), alongside a `CHECKSUMS.txt` — see [`wasm/README.md`](wasm/README.md) for how
to regenerate them after changing a contract.
