# Samples

Real outputs from real runs, kept so the report format and results can be inspected without
Docker. Nothing here is hand-written or edited.

| Files | What it is |
| --- | --- |
| `27-to-28.report.md`, `27-to-28.report.json` | The report from a real protocol 27 to 28 run. |
| `27-to-28.provenance.json` | Where, when and how it was produced (workflow run, commit, command). |

Each sample has a provenance file. If you add a sample, add its provenance with it and keep the
files exactly as the tool produced them. A number shown anywhere in this project's docs should
come from a file here or be labeled as an example.

To reproduce, see the README's quickstart; the workflow that produced this sample is
`.github/workflows/real-diff.yml` (trigger it from the Actions tab with the two protocol
versions as inputs).
