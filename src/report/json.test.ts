import { describe, expect, it } from 'vitest';
import { diffRun } from '../diff/engine.js';
import type { ScenarioResult } from '../diff/types.js';
import { toJsonReport } from './json.js';

function ok(name: string): ScenarioResult {
  return {
    scenario: name,
    status: 'ok',
    success: true,
    returnValue: 1,
    contractError: null,
    events: [],
    resources: null,
    minResourceFee: null,
  };
}

describe('toJsonReport', () => {
  it('round-trips through JSON.stringify/parse without losing scenario data', () => {
    const run = diffRun(27, 28, [ok('a')], [ok('a')], () => 5);
    const report = toJsonReport(run);
    const parsed = JSON.parse(JSON.stringify(report));
    expect(parsed.scenarios).toHaveLength(1);
    expect(parsed.overallVerdict).toBe('SAME');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('includes a coverage note naming the scenario count', () => {
    const run = diffRun(27, 28, [ok('a'), ok('b')], [ok('a'), ok('b')], () => 5);
    const report = toJsonReport(run);
    expect(report.coverageNote).toContain('2 scenario');
  });
});
