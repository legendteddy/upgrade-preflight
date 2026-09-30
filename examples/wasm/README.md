# Committed wasm artifacts

These `.wasm` files are copies of `../target/wasm32v1-none/release/*.wasm` after running
`stellar contract build` in `examples/`, checked in so `preflight.config.yml` and CI don't need
a Rust toolchain to run a preflight (only to rebuild a *changed* contract).

## Regenerating after a contract change

```bash
cd examples
stellar contract build
cp target/wasm32v1-none/release/hello_world.wasm wasm/hello-world.wasm
cp target/wasm32v1-none/release/counter.wasm wasm/counter.wasm
cp target/wasm32v1-none/release/heavy_loop.wasm wasm/heavy-loop.wasm
cp target/wasm32v1-none/release/auth.wasm wasm/auth.wasm
sha256sum wasm/*.wasm > wasm/CHECKSUMS.txt
```

CI does not verify `CHECKSUMS.txt` automatically yet — see `ISSUES_BACKLOG.md` for the issue to
add that check.
