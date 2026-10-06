import { describe, expect, it } from 'vitest';
import { diffRun } from '../diff/engine.js';
import type { ScenarioResult } from '../diff/types.js';
import { toMarkdown } from './markdown.js';

function ok(name: string): ScenarioResult {
  return {
    scenario: name,
    status: 'ok',
    success: true,
    returnValue: 1,
    contractError: null,
    events: [],
    resources: { instructions: 100, diskReadBytes: 10, writeBytes: 5, readEntries: 1, writeEntries: 1 },
    minResourceFee: '100',
  };
}

describe('toMarkdown', () => {
  it('includes the untested-paths disclaimer', () => {
    const run = diffRun(27, 28, [ok('a')], [ok('a')], () => 5);
    const markdown = toMarkdown(run);
    expect(markdown).toContain('not covered');
  });

  it('includes the overall verdict prominently', () => {
    const run = diffRun(27, 28, [ok('a')], [ok('a')], () => 5);
    const markdown = toMarkdown(run);
    expect(markdown).toContain('Overall verdict: ✅ SAME');
  });

  it('names the quickstart image when one is recorded, and omits the line otherwise', () => {
    const run = diffRun(27, 28, [ok('a')], [ok('a')], () => 5);
    expect(toMarkdown({ ...run, image: 'stellar/quickstart:v672-b1475.1-latest' })).toContain(
      'Quickstart image: `stellar/quickstart:v672-b1475.1-latest`'
    );
    expect(toMarkdown(run)).not.toContain('Quickstart image');
  });

  it('lists every scenario in the table', () => {
    const run = diffRun(27, 28, [ok('a'), ok('b')], [ok('a'), ok('b')], () => 5);
    const markdown = toMarkdown(run);
    expect(markdown).toContain('| a |');
    expect(markdown).toContain('| b |');
  });

  it('never claims success beyond what was tested', () => {
    const run = diffRun(27, 28, [ok('a')], [ok('a')], () => 5);
    const markdown = toMarkdown(run);
    expect(markdown.toLowerCase()).not.toMatch(/your contract is fine/);
  });
});
