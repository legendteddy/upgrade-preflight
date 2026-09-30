# Contributing

## Setup

```bash
git clone https://github.com/stellarbrief/upgrade-preflight.git
cd upgrade-preflight
npm install
```

Docker is required for the integration test suite and for actually running the CLI, but not
for most day-to-day work (lint, typecheck, unit tests, and the build all run without it).

## Development loop

```bash
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run test          # unit tests (no Docker required)
npm run test:integration  # integration tests (Docker required; skip cleanly without it)
npm run build          # compile to dist/
```

## Branch / PR flow

1. Fork the repo and create a branch off `main`.
2. Make your change, with tests — see "What needs tests" below.
3. Run the full development loop above before opening a PR.
4. Open a PR using the template; link the issue you're closing, if any.

## Code style

TypeScript strict mode, ESM throughout (`"type": "module"`), relative imports use `.js`
extensions even though the source files are `.ts` — this is the standard pattern for
`moduleResolution: "NodeNext"` and lets `tsx` (dev) and `tsc` (build) both resolve the same
import correctly. ESLint (`typescript-eslint` recommended rules) enforces the rest.

## What needs tests

- **`src/diff/` and `src/report/`** are pure functions over plain data — every new verdict rule
  or report field needs a unit test here. This is the easiest, fastest place to add coverage
  and needs no Docker at all.
- **`src/config/`** — new schema fields need both an acceptance test and a rejection test.
- **`src/network/`** — mock `node:child_process` and `fetch`, following
  `src/network/quickstart.test.ts`. Assert the exact Docker flags, not just "it was called."
- **`src/sdk/` and `src/runner/`** — these touch a real network and are harder to unit-test in
  isolation; if you're adding a scenario type or arg type, a unit test on `src/sdk/args.ts`'s
  encoding is usually enough, with an integration test covering the real end-to-end path.

## How issues are rated for complexity

Issues in [`ISSUES_BACKLOG.md`](ISSUES_BACKLOG.md) are rated **Trivial**, **Medium**, or
**High**, matching the [Stellar Wave Program](https://docs.drips.network/wave/)'s complexity
tiers:

- **Trivial**: typos, small bug fixes, a new example scenario, better error messages.
- **Medium**: a standard new feature or an involved bug fix — a new report format, a new arg
  type, CI improvements.
- **High**: a complex feature, refactor, or new integration — a new network backend, a plugin
  system, protocol-matrix (N-version) runs.

## Contributing via Stellar Wave

This repo is applying to the [Stellar Wave Program](https://docs.drips.network/wave/), where
maintainers list scoped issues and outside contributors solve them for points.
