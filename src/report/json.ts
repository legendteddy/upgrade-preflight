import type { RunDiff } from '../diff/types.js';

export interface JsonReport {
  schemaVersion: 1;
  fromProtocol: number;
  toProtocol: number;
  overallVerdict: RunDiff['overallVerdict'];
  scenarios: RunDiff['scenarios'];
  coverageNote: string;
}

export function toJsonReport(diff: RunDiff): JsonReport {
  return {
    schemaVersion: 1,
    fromProtocol: diff.fromProtocol,
    toProtocol: diff.toProtocol,
    overallVerdict: diff.overallVerdict,
    scenarios: diff.scenarios,
    coverageNote: `This report covers only the ${diff.scenarios.length} scenario(s) defined in the config. Untested code paths are not covered.`,
  };
}

export function toJson(diff: RunDiff): string {
  return JSON.stringify(toJsonReport(diff), null, 2);
}
