/** Mirrors @stellar/stellar-sdk's XDR `SorobanResources` field names exactly
 * (`instructions`, `diskReadBytes`, `writeBytes`) plus footprint entry counts derived from
 * `footprint.readOnly`/`readWrite` — there is no separate "memBytes" resource in the current
 * protocol; memory is not part of the declared transaction resources. See
 * src/sdk/simulate.ts and PLAN.md "Verified facts". */
export interface ResourceUsage {
  instructions: number;
  diskReadBytes: number;
  writeBytes: number;
  readEntries: number;
  writeEntries: number;
}

export interface ScenarioResult {
  scenario: string;
  /** Whether the tool itself managed to run the scenario at all (network/tool failure vs a
   * contract-level failure). ERROR is only ever produced from `status === 'error'`. */
  status: 'ok' | 'error';
  /** Present only when status === 'error'. */
  toolError?: string;
  /** Whether the contract call itself succeeded (no error) — meaningless when status is 'error'. */
  success: boolean;
  returnValue: unknown;
  contractError: string | null;
  events: string[];
  resources: ResourceUsage | null;
  minResourceFee: string | null;
}

export type Verdict = 'SAME' | 'COSTS_CHANGED' | 'BEHAVIOR_CHANGED' | 'BROKE' | 'ERROR';

export interface ResourceDelta {
  metric: keyof ResourceUsage | 'minResourceFee';
  baseline: number;
  target: number;
  percentChange: number | null;
}

export interface ScenarioDiff {
  scenario: string;
  verdict: Verdict;
  reason: string;
  baseline: ScenarioResult;
  target: ScenarioResult;
  resourceDeltas: ResourceDelta[];
  costThresholdPercent: number;
}

export interface RunDiff {
  fromProtocol: number;
  toProtocol: number;
  scenarios: ScenarioDiff[];
  overallVerdict: Verdict;
}
