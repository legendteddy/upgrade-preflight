import { describe, expect, it } from 'vitest';
import { diffRun, diffScenario } from './engine.js';
import type { ResourceUsage, ScenarioResult } from './types.js';

function ok(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenario: 's1',
    status: 'ok',
    success: true,
    returnValue: 42,
    contractError: null,
    events: [],
    resources: baseResources(),
    minResourceFee: '100',
    ...overrides,
  };
}

function baseResources(overrides: Partial<ResourceUsage> = {}): ResourceUsage {
  return {
    instructions: 1000,
    diskReadBytes: 200,
    writeBytes: 50,
    readEntries: 2,
    writeEntries: 1,
    ...overrides,
  };
}

describe('diffScenario', () => {
  it('returns SAME for identical successful results within threshold', () => {
    const result = diffScenario(ok(), ok(), 5);
    expect(result.verdict).toBe('SAME');
  });

  it('returns ERROR when the baseline run failed as a tool/network error', () => {
    const baseline = ok({ status: 'error', toolError: 'network unreachable', success: false });
    const result = diffScenario(baseline, ok(), 5);
    expect(result.verdict).toBe('ERROR');
    expect(result.reason).toContain('network unreachable');
  });

  it('returns ERROR when the target run failed as a tool/network error', () => {
    const target = ok({ status: 'error', toolError: 'timeout', success: false });
    const result = diffScenario(ok(), target, 5);
    expect(result.verdict).toBe('ERROR');
  });

  it('never reports SAME on a tool error, even if success flags happen to match', () => {
    const baseline = ok({ status: 'error', toolError: 'x', success: false });
    const target = ok({ status: 'error', toolError: 'x', success: false });
    const result = diffScenario(baseline, target, 5);
    expect(result.verdict).toBe('ERROR');
  });

  it('returns BROKE when a scenario passed on baseline but failed on target', () => {
    const target = ok({ success: false, returnValue: null, contractError: 'trapped', resources: null, minResourceFee: null });
    const result = diffScenario(ok(), target, 5);
    expect(result.verdict).toBe('BROKE');
  });

  it('returns SAME when both versions fail with the identical error', () => {
    const failure = ok({ success: false, returnValue: null, contractError: 'trapped: bad input', resources: null, minResourceFee: null });
    const result = diffScenario(failure, { ...failure }, 5);
    expect(result.verdict).toBe('SAME');
  });

  it('returns BEHAVIOR_CHANGED when both versions fail with different errors', () => {
    const baseline = ok({ success: false, returnValue: null, contractError: 'trapped: A', resources: null, minResourceFee: null });
    const target = ok({ success: false, returnValue: null, contractError: 'trapped: B', resources: null, minResourceFee: null });
    const result = diffScenario(baseline, target, 5);
    expect(result.verdict).toBe('BEHAVIOR_CHANGED');
  });

  it('returns BEHAVIOR_CHANGED when return values differ', () => {
    const result = diffScenario(ok({ returnValue: 1 }), ok({ returnValue: 2 }), 5);
    expect(result.verdict).toBe('BEHAVIOR_CHANGED');
  });

  it('returns BEHAVIOR_CHANGED when emitted events differ', () => {
    const result = diffScenario(ok({ events: ['a'] }), ok({ events: ['b'] }), 5);
    expect(result.verdict).toBe('BEHAVIOR_CHANGED');
  });

  it('returns SAME when a cost metric changes by exactly the threshold percent', () => {
    // 1000 -> 1050 is exactly +5%
    const target = ok({ resources: baseResources({ instructions: 1050 }) });
    const result = diffScenario(ok(), target, 5);
    expect(result.verdict).toBe('SAME');
  });

  it('returns COSTS_CHANGED when a cost metric changes by more than the threshold percent', () => {
    // 1000 -> 1051 is just over +5%
    const target = ok({ resources: baseResources({ instructions: 1051 }) });
    const result = diffScenario(ok(), target, 5);
    expect(result.verdict).toBe('COSTS_CHANGED');
  });

  it('returns COSTS_CHANGED when a metric goes from zero to nonzero', () => {
    const baseline = ok({ resources: baseResources({ writeBytes: 0 }) });
    const target = ok({ resources: baseResources({ writeBytes: 10 }) });
    const result = diffScenario(baseline, target, 5);
    expect(result.verdict).toBe('COSTS_CHANGED');
  });

  it('returns SAME when a metric stays at zero on both sides', () => {
    const baseline = ok({ resources: baseResources({ writeBytes: 0 }) });
    const target = ok({ resources: baseResources({ writeBytes: 0 }) });
    const result = diffScenario(baseline, target, 5);
    expect(result.verdict).toBe('SAME');
  });

  it('respects a per-scenario threshold override tighter than the default', () => {
    // +3% would pass a 5% threshold but should fail a 1% threshold
    const target = ok({ resources: baseResources({ instructions: 1030 }) });
    const result = diffScenario(ok(), target, 1);
    expect(result.verdict).toBe('COSTS_CHANGED');
  });

  it('throws if baseline and target scenario names do not match', () => {
    expect(() => diffScenario(ok({ scenario: 'a' }), ok({ scenario: 'b' }), 5)).toThrow();
  });

  it('flags minResourceFee changes beyond threshold as COSTS_CHANGED', () => {
    const target = ok({ minResourceFee: '200' });
    const result = diffScenario(ok({ minResourceFee: '100' }), target, 5);
    expect(result.verdict).toBe('COSTS_CHANGED');
    expect(result.resourceDeltas.some((d) => d.metric === 'minResourceFee')).toBe(true);
  });
});

describe('diffRun', () => {
  it('computes overall verdict as the worst severity among scenarios', () => {
    const baseline = [ok({ scenario: 'a' }), ok({ scenario: 'b' })];
    const target = [ok({ scenario: 'a' }), ok({ scenario: 'b', success: false, contractError: 'nope', resources: null, minResourceFee: null })];
    const run = diffRun(27, 28, baseline, target, () => 5);
    expect(run.overallVerdict).toBe('BROKE');
    expect(run.scenarios).toHaveLength(2);
  });

  it('returns SAME overall when every scenario is SAME', () => {
    const baseline = [ok({ scenario: 'a' })];
    const target = [ok({ scenario: 'a' })];
    const run = diffRun(27, 28, baseline, target, () => 5);
    expect(run.overallVerdict).toBe('SAME');
  });

  it('reports ERROR for a scenario missing from the target results entirely', () => {
    const baseline = [ok({ scenario: 'a' })];
    const run = diffRun(27, 28, baseline, [], () => 5);
    expect(run.overallVerdict).toBe('ERROR');
    expect(run.scenarios[0]?.verdict).toBe('ERROR');
  });

  it('applies a per-scenario threshold function independently per scenario', () => {
    const baseline = [ok({ scenario: 'a' }), ok({ scenario: 'b' })];
    const target = [
      ok({ scenario: 'a', resources: baseResources({ instructions: 1030 }) }), // +3%
      ok({ scenario: 'b', resources: baseResources({ instructions: 1030 }) }), // +3%
    ];
    const run = diffRun(27, 28, baseline, target, (name) => (name === 'a' ? 1 : 5));
    expect(run.scenarios.find((s) => s.scenario === 'a')?.verdict).toBe('COSTS_CHANGED');
    expect(run.scenarios.find((s) => s.scenario === 'b')?.verdict).toBe('SAME');
  });
});
