# Samples

Real outputs from real runs, kept so the report format and results can be inspected without
Docker. Nothing here is hand-written or edited.

| Files | What it is |
| --- | --- |
| `27-to-28.report.md`, `27-to-28.report.json` | The report from a real protocol 27 to 28 run. |
| `28-to-29.report.md`, `28-to-29.report.json` | The report from a real protocol 28 to 29 run. |
| `*.provenance.json` | Where, when and how each was produced (workflow run, commit, command, image). |

Both runs used `stellar/quickstart:latest` as it was on the day. The image matters: its core
version decides which protocols it can run, and `latest` moves. The two samples were taken on
different image builds, which is why each provenance file names the image (inferred from Docker
Hub's tag timestamps, since the tool did not yet record it). Reports made with `--image` record
the image themselves.

Each sample has a provenance file. If you add a sample, add its provenance with it and keep the
files exactly as the tool produced them. A number shown anywhere in this project's docs should
come from a file here or be labeled as an example.

To reproduce, see the README's quickstart; the workflow that produced this sample is
`.github/workflows/real-diff.yml` (trigger it from the Actions tab with the two protocol
versions as inputs).
