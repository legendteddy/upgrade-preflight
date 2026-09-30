# Using upgrade-preflight in CI

## As a GitHub Action

```yaml
- uses: stellarbrief/upgrade-preflight/action@main
  with:
    config: preflight.config.yml
    from: '27'
    to: '28'
```

This requires a Linux runner with Docker available (GitHub-hosted `ubuntu-latest` runners have
it by default). See [`action/action.yml`](../action/action.yml) for all inputs — it's a thin
composite wrapper that installs Node, builds the CLI, and runs
`upgrade-preflight run --from <from> --to <to> --config <config>`, then writes the Markdown
report to the job summary.

## Exit codes

- `0`: overall verdict `SAME` or `COSTS_CHANGED` — nothing broke.
- `1`: overall verdict `BEHAVIOR_CHANGED` or `BROKE` — treat this as a CI failure.
- `2`: overall verdict `ERROR` — the tool itself failed (network never came up, etc.). This is
  NOT a statement about your contract; re-run once the underlying issue (usually Docker/image
  availability) is fixed.

## Running it locally first

```bash
npm install
npm run build
node dist/cli/index.js run --from 27 --to 28 --config preflight.config.yml
```

Docker must be running locally for this — the CLI checks `docker info` up front and exits with
a clear message if it isn't available, rather than failing deep inside a network start.
