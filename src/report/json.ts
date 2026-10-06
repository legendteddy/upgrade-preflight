import type { RunDiff } from '../diff/types.js';

export interface JsonReport {
  schemaVersion: 1;
  fromProtocol: number;
  toProtocol: number;
  /** The quickstart image both networks ran; absent in reports from before it was recorded. */
  image?: string;
  overallVerdict: RunDiff['overallVerdict'];
  scenarios: RunDiff['scenarios'];
  coverageNote: string;
}

export function toJsonReport(diff: RunDiff): JsonReport {
  return {
    schemaVersion: 1,
    fromProtocol: diff.fromProtocol,
    toProtocol: diff.toProtocol,
    ...(diff.image ? { image: diff.image } : {}),
    overallVerdict: diff.overallVerdict,
    scenarios: diff.scenarios,
    coverageNote: `This report covers only the ${diff.scenarios.length} scenario(s) defined in the config. Untested code paths are not covered.`,
  };
}

/** A `ScenarioResult.returnValue` can be a native `bigint` (scValToNative decodes Soroban's
 * u64/i64/u128/i128 types that way), which plain `JSON.stringify` throws on outright. */
export function toJson(diff: RunDiff): string {
  return JSON.stringify(
    toJsonReport(diff),
    (_key, value) => (typeof value === 'bigint' ? `${value.toString()}n` : value),
    2
  );
}
