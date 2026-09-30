# Security Policy

## Reporting a vulnerability

Please do not open a public GitHub issue for a security vulnerability. Instead, use GitHub's
[private vulnerability reporting](https://github.com/stellarbrief/upgrade-preflight/security/advisories/new)
for this repository, or open a regular issue asking a maintainer to reach out privately if
that option isn't available to you.

## Scope

This project runs local, ephemeral Docker networks and generates throwaway test keypairs; it
never touches Testnet, Mainnet, or any real account. Relevant concerns include (but aren't
limited to):

- A generated test secret key leaking into logs, reports, or CI output. `src/sdk/accounts.ts`
  never persists secrets, and report renderers never receive a `Keypair`, only public
  addresses and results — but a new code path that threads a secret into a log line would be a
  real finding.
- A `preflight.config.yml` from an untrusted source causing unexpected `docker run` arguments —
  the config schema (`src/config/schema.ts`) only ever produces fixed, known flags; report if
  you find a way to inject arbitrary Docker arguments through a config value.
- The GitHub Action (`action/action.yml`) running with more permissions or network access than
  it needs.

## Supported versions

This project is pre-1.0; only the `main` branch receives fixes.
