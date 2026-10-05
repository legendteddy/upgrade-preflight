import { describe, expect, it } from 'vitest';
import { assertLedgerProtocol, waitForLedgerProtocol } from './protocol-check.js';

describe('assertLedgerProtocol', () => {
  it('accepts a matching number or numeric string', () => {
    expect(assertLedgerProtocol(28, 28)).toBe(28);
    expect(assertLedgerProtocol('27', 27)).toBe(27);
  });

  it('rejects a network running a different protocol than requested', () => {
    expect(() => assertLedgerProtocol(29, 28)).toThrow(/Requested protocol 28 .* protocol 29/);
  });

  it('rejects an unreadable value', () => {
    expect(() => assertLedgerProtocol('latest', 28)).toThrow(/unreadable protocol version/);
  });
});

describe('waitForLedgerProtocol', () => {
  function fakeClock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it('waits through earlier protocols until the requested one appears', async () => {
    const reads = [26, 26, '28'];
    const clock = fakeClock();
    const result = await waitForLedgerProtocol(async () => reads.shift()!, 28, { ...clock });
    expect(result).toBe(28);
  });

  it('keeps polling through RPC errors', async () => {
    let calls = 0;
    const clock = fakeClock();
    const result = await waitForLedgerProtocol(
      async () => {
        if (++calls < 3) throw new Error('not ready');
        return 28;
      },
      28,
      { ...clock }
    );
    expect(result).toBe(28);
  });

  it('throws once the deadline passes without reaching the requested protocol', async () => {
    const clock = fakeClock();
    await expect(
      waitForLedgerProtocol(async () => 27, 28, { ...clock, timeoutMs: 10_000, intervalMs: 2_000 })
    ).rejects.toThrow(/Requested protocol 28 .* protocol 27/);
  });
});
