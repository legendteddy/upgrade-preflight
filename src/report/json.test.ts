import { describe, expect, it } from 'vitest';
import { diffRun } from '../diff/engine.js';
import type { ScenarioResult } from '../diff/types.js';
import { toJson, toJsonReport } from './json.js';

function ok(name: string, returnValue: unknown = 1): ScenarioResult {
  return {
    scenario: name,
    status: 'ok',
    success: true,
    returnValue,
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

  it('records the quickstart image only when one is known', () => {
    const run = diffRun(27, 28, [ok('a')], [ok('a')], () => 5);
    expect(toJsonReport({ ...run, image: 'stellar/quickstart:v672-b1475.1-latest' }).image).toBe(
      'stellar/quickstart:v672-b1475.1-latest'
    );
    expect('image' in toJsonReport(run)).toBe(false);
  });

  it('includes a coverage note naming the scenario count', () => {
    const run = diffRun(27, 28, [ok('a'), ok('b')], [ok('a'), ok('b')], () => 5);
    const report = toJsonReport(run);
    expect(report.coverageNote).toContain('2 scenario');
  });

  it('serializes a bigint return value without throwing (scValToNative decodes u64/i128 as bigint)', () => {
    const run = diffRun(27, 28, [ok('a', 5050n)], [ok('a', 5050n)], () => 5);
    expect(() => toJson(run)).not.toThrow();
    expect(toJson(run)).toContain('5050n');
  });
});
