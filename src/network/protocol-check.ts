/** `getNetwork().protocolVersion` is documented as the Stellar Core protocol version associated
 * with the latest ledger. A run is only a valid "protocol N" run if the network really reports N;
 * otherwise a diff between two runs could be comparing the same protocol and say nothing about
 * an upgrade. The SDK types the field as a string and the RPC docs as a number, so accept both. */
export function assertLedgerProtocol(reported: string | number, expected: number): number {
  const actual = Number(reported);
  if (!Number.isInteger(actual)) {
    throw new Error(`Network reported an unreadable protocol version: ${String(reported)}`);
  }
  if (actual !== expected) {
    throw new Error(
      `Requested protocol ${expected} but the network's ledger reports protocol ${actual}. ` +
        'A comparison against this network would not test the requested upgrade.'
    );
  }
  return actual;
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** A freshly started network can report healthy a few ledgers before the requested protocol is
 * applied, so poll briefly rather than failing on the first read. Still throws if the ledger
 * never reaches the requested protocol. */
export async function waitForLedgerProtocol(
  read: () => Promise<string | number>,
  expected: number,
  opts: WaitOptions = {}
): Promise<number> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const deadline = now() + timeoutMs;
  let last: string | number = 'unavailable';
  for (;;) {
    try {
      last = await read();
      if (Number(last) === expected) return expected;
    } catch {
      // RPC not answering yet; keep polling until the deadline.
    }
    if (now() >= deadline) break;
    await sleep(intervalMs);
  }
  return assertLedgerProtocol(last, expected);
}
