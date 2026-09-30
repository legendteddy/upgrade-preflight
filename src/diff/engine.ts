import type {
  ResourceDelta,
  ResourceUsage,
  RunDiff,
  ScenarioDiff,
  ScenarioResult,
  Verdict,
} from './types.js';

const RESOURCE_METRICS: (keyof ResourceUsage)[] = [
  'instructions',
  'diskReadBytes',
  'writeBytes',
  'readEntries',
  'writeEntries',
];

const VERDICT_SEVERITY: Record<Verdict, number> = {
  SAME: 0,
  COSTS_CHANGED: 1,
  BEHAVIOR_CHANGED: 2,
  BROKE: 3,
  ERROR: 4,
};

export function diffScenario(
  baseline: ScenarioResult,
  target: ScenarioResult,
  costThresholdPercent: number
): ScenarioDiff {
  if (baseline.scenario !== target.scenario) {
    throw new Error(
      `diffScenario: scenario name mismatch (baseline="${baseline.scenario}", target="${target.scenario}")`
    );
  }

  if (baseline.status === 'error' || target.status === 'error') {
    const side = baseline.status === 'error' ? 'baseline' : 'target';
    const message = baseline.status === 'error' ? baseline.toolError : target.toolError;
    return {
      scenario: baseline.scenario,
      verdict: 'ERROR',
      reason: `Tool or network failure on the ${side} run: ${message ?? 'unknown error'}`,
      baseline,
      target,
      resourceDeltas: [],
      costThresholdPercent,
    };
  }

  if (baseline.success && !target.success) {
    return {
      scenario: baseline.scenario,
      verdict: 'BROKE',
      reason: `Scenario passed on the baseline protocol but failed on the target protocol: ${
        target.contractError ?? 'no error message returned'
      }`,
      baseline,
      target,
      resourceDeltas: [],
      costThresholdPercent,
    };
  }

  if (!baseline.success && !target.success) {
    const sameError = normalizeError(baseline.contractError) === normalizeError(target.contractError);
    if (sameError) {
      return {
        scenario: baseline.scenario,
        verdict: 'SAME',
        reason: 'Scenario failed identically on both protocol versions.',
        baseline,
        target,
        resourceDeltas: [],
        costThresholdPercent,
      };
    }
    return {
      scenario: baseline.scenario,
      verdict: 'BEHAVIOR_CHANGED',
      reason: `Scenario failed on both versions, but with different errors. Baseline: "${
        baseline.contractError ?? ''
      }". Target: "${target.contractError ?? ''}".`,
      baseline,
      target,
      resourceDeltas: [],
      costThresholdPercent,
    };
  }

  // Both succeeded.
  const returnValueChanged = !deepEqualJson(baseline.returnValue, target.returnValue);
  const eventsChanged = !arraysEqual(baseline.events, target.events);

  if (returnValueChanged || eventsChanged) {
    const parts: string[] = [];
    if (returnValueChanged) parts.push('return value differs');
    if (eventsChanged) parts.push('emitted events differ');
    return {
      scenario: baseline.scenario,
      verdict: 'BEHAVIOR_CHANGED',
      reason: `Scenario succeeded on both versions, but ${parts.join(' and ')}.`,
      baseline,
      target,
      resourceDeltas: [],
      costThresholdPercent,
    };
  }

  const resourceDeltas = computeResourceDeltas(baseline, target);
  const changedMetrics = resourceDeltas.filter((d) => isChanged(d, costThresholdPercent));

  if (changedMetrics.length > 0) {
    const summary = changedMetrics
      .map((d) => `${d.metric} ${formatPercent(d.percentChange)} (${d.baseline} -> ${d.target})`)
      .join(', ');
    return {
      scenario: baseline.scenario,
      verdict: 'COSTS_CHANGED',
      reason: `Same behavior, but resource usage changed beyond the ${costThresholdPercent}% threshold: ${summary}.`,
      baseline,
      target,
      resourceDeltas,
      costThresholdPercent,
    };
  }

  return {
    scenario: baseline.scenario,
    verdict: 'SAME',
    reason: 'Same behavior and resource usage within threshold.',
    baseline,
    target,
    resourceDeltas,
    costThresholdPercent,
  };
}

export function diffRun(
  fromProtocol: number,
  toProtocol: number,
  baselineResults: ScenarioResult[],
  targetResults: ScenarioResult[],
  costThresholdPercentFor: (scenario: string) => number
): RunDiff {
  const targetByName = new Map(targetResults.map((r) => [r.scenario, r]));
  const scenarios: ScenarioDiff[] = baselineResults.map((baseline) => {
    const target = targetByName.get(baseline.scenario);
    if (!target) {
      return {
        scenario: baseline.scenario,
        verdict: 'ERROR' as const,
        reason: `No target-run result was captured for scenario "${baseline.scenario}".`,
        baseline,
        target: {
          scenario: baseline.scenario,
          status: 'error',
          toolError: 'missing result',
          success: false,
          returnValue: null,
          contractError: null,
          events: [],
          resources: null,
          minResourceFee: null,
        },
        resourceDeltas: [],
        costThresholdPercent: costThresholdPercentFor(baseline.scenario),
      };
    }
    return diffScenario(baseline, target, costThresholdPercentFor(baseline.scenario));
  });

  const overallVerdict = scenarios.reduce<Verdict>(
    (worst, s) => (VERDICT_SEVERITY[s.verdict] > VERDICT_SEVERITY[worst] ? s.verdict : worst),
    'SAME'
  );

  return { fromProtocol, toProtocol, scenarios, overallVerdict };
}

function computeResourceDeltas(baseline: ScenarioResult, target: ScenarioResult): ResourceDelta[] {
  const deltas: ResourceDelta[] = [];

  if (baseline.resources && target.resources) {
    for (const metric of RESOURCE_METRICS) {
      const b = baseline.resources[metric];
      const t = target.resources[metric];
      deltas.push({ metric, baseline: b, target: t, percentChange: percentChange(b, t) });
    }
  }

  const feeBaseline = baseline.minResourceFee !== null ? Number(baseline.minResourceFee) : null;
  const feeTarget = target.minResourceFee !== null ? Number(target.minResourceFee) : null;
  if (feeBaseline !== null && feeTarget !== null) {
    deltas.push({
      metric: 'minResourceFee',
      baseline: feeBaseline,
      target: feeTarget,
      percentChange: percentChange(feeBaseline, feeTarget),
    });
  }

  return deltas;
}

function percentChange(baseline: number, target: number): number | null {
  if (baseline === 0) {
    return target === 0 ? 0 : null;
  }
  return ((target - baseline) / baseline) * 100;
}

function isChanged(delta: ResourceDelta, thresholdPercent: number): boolean {
  if (delta.percentChange === null) return delta.baseline !== delta.target;
  return Math.abs(delta.percentChange) > thresholdPercent;
}

function formatPercent(percent: number | null): string {
  if (percent === null) return 'from zero';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

function normalizeError(error: string | null): string {
  return (error ?? '').trim().toLowerCase();
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}
