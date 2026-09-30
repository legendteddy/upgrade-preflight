# Adding a network backend

`src/network/quickstart.ts` is the only place that knows how to start, health-check, and stop a
local Stellar network. Everything downstream (`src/runner/`, `src/diff/`, `src/report/`) works
against plain data (`ScenarioResult`, `RunDiff`) and has no idea Docker or quickstart exist.

This means a new backend — for example, a remote/hosted network runner, or a different local
image — is a matter of implementing the same small surface:

```ts
export interface QuickstartNetwork {
  containerName: string;
  rpcUrl: string;
  friendbotUrl: string;
  networkPassphrase: string;
  stop(): Promise<void>;
}

async function startQuickstart(opts: QuickstartOptions): Promise<QuickstartNetwork> { ... }
```

`src/runner/run.ts` only calls `startQuickstart` and `network.stop()` — it never shells out to
`docker` itself. To add a backend:

1. Write a new module (e.g. `src/network/my-backend.ts`) exporting a function with the same
   `Promise<QuickstartNetwork>` return shape.
2. Make sure `stop()` really tears things down even when startup partially failed — see how
   `startQuickstart` wraps its own health-check wait in a `try`/`catch` that calls
   `stopQuickstart` before rethrowing.
3. Add a CLI flag or config field to select it (the current CLI hardcodes the quickstart
   backend; see `ISSUES_BACKLOG.md` for the issue to make this pluggable end-to-end).
4. Write unit tests against a mocked `child_process`/HTTP layer, following the pattern in
   `src/network/quickstart.test.ts` — no real Docker required for the unit suite.

## Reference: how `stellar/quickstart@main`'s own GitHub Action waits for health

We don't use that action directly (we need to run two networks sequentially with teardown
between, which one action invocation doesn't fit), but its `action.yml` is the canonical
reference for "how do you know the image is actually ready": it polls
`docker inspect -f '{{.State.Health.Status}}'` against a container health check that itself
does `curl -X POST .../rpc {"method":"getHealth"}` (grep `healthy`) **and**
`curl .../friendbot` (grep the `invalid_field` error body, i.e. friendbot answering at all).
`src/network/quickstart.ts`'s `waitHealthy` performs the same two checks directly over HTTP
instead of shelling out to `docker inspect`, since we don't rely on Docker's own healthcheck
being configured on the container we start.
