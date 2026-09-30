import type { RunDiff, ScenarioDiff, Verdict } from '../diff/types.js';

const VERDICT_EMOJI: Record<Verdict, string> = {
  SAME: '✅',
  COSTS_CHANGED: '⚠️',
  BEHAVIOR_CHANGED: '🔶',
  BROKE: '❌',
  ERROR: '🛑',
};

export function toMarkdown(diff: RunDiff): string {
  const lines: string[] = [];

  lines.push(
    `# Upgrade Preflight: protocol ${diff.fromProtocol} → ${diff.toProtocol}`,
    '',
    `**Overall verdict: ${VERDICT_EMOJI[diff.overallVerdict]} ${diff.overallVerdict}**`,
    ''
  );

  lines.push('| Scenario | Verdict | Baseline | Target | Notes |', '| --- | --- | --- | --- | --- |');
  for (const scenario of diff.scenarios) {
    lines.push(
      `| ${scenario.scenario} | ${VERDICT_EMOJI[scenario.verdict]} ${scenario.verdict} | ${summarizeSide(
        scenario.baseline.success
      )} | ${summarizeSide(scenario.target.success)} | ${scenario.reason.replace(/\|/g, '\\|')} |`
    );
  }
  lines.push('');

  for (const scenario of diff.scenarios) {
    if (scenario.resourceDeltas.length === 0) continue;
    lines.push(`### ${scenario.scenario} — resource usage`, '', '| Metric | Baseline | Target | Δ |', '| --- | --- | --- | --- |');
    for (const delta of scenario.resourceDeltas) {
      const pct = delta.percentChange === null ? 'from zero' : `${delta.percentChange >= 0 ? '+' : ''}${delta.percentChange.toFixed(1)}%`;
      lines.push(`| ${delta.metric} | ${delta.baseline} | ${delta.target} | ${pct} |`);
    }
    lines.push('');
  }

  lines.push('## What to do next', '', nextStepsFor(diff), '');
  lines.push(
    '## What this does not prove',
    '',
    `This report covers only the ${diff.scenarios.length} scenario(s) defined in the config. ` +
      'Any contract code path not exercised by a scenario is untested and not covered by this verdict.',
    ''
  );

  return lines.join('\n');
}

function summarizeSide(success: boolean): string {
  return success ? 'ok' : 'failed';
}

function nextStepsFor(diff: RunDiff): string {
  switch (diff.overallVerdict) {
    case 'SAME':
      return 'No action needed for the scenarios tested. Consider adding more scenarios to widen coverage before the real upgrade vote.';
    case 'COSTS_CHANGED':
      return 'Behavior is unchanged, but resource usage or fees moved beyond the threshold. Review the affected scenarios below and re-check your fee assumptions before the upgrade.';
    case 'BEHAVIOR_CHANGED':
      return 'At least one scenario returned a different result or emitted different events on the target protocol. Investigate before the upgrade — this can break callers who depend on the current behavior.';
    case 'BROKE':
      return 'At least one scenario that passed on the current protocol fails on the target protocol. Do not upgrade until this is understood and fixed or explicitly accepted.';
    case 'ERROR':
      return 'The tool could not complete one or more scenarios (network or tooling failure, not a contract behavior result). Re-run once the underlying issue is fixed — a network error here does not tell you anything about your contract.';
  }
}

export function scenarioDetail(scenario: ScenarioDiff): string {
  return [
    `### ${scenario.scenario}`,
    '',
    `Verdict: ${scenario.verdict}`,
    '',
    scenario.reason,
  ].join('\n');
}
