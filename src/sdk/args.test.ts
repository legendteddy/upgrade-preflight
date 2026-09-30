import { scValToNative } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { toScVal } from './args.js';

const DUMMY_ADDRESS = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';

describe('toScVal', () => {
  it('round-trips a u32', () => {
    const scVal = toScVal({ type: 'u32', value: 7 }, DUMMY_ADDRESS);
    expect(scValToNative(scVal)).toBe(7);
  });

  it('round-trips an i128 given as a string', () => {
    const scVal = toScVal({ type: 'i128', value: '123456789012345678901' }, DUMMY_ADDRESS);
    expect(scValToNative(scVal)).toBe(123456789012345678901n);
  });

  it('round-trips a symbol', () => {
    const scVal = toScVal({ type: 'symbol', value: 'hello' }, DUMMY_ADDRESS);
    expect(scValToNative(scVal)).toBe('hello');
  });

  it('resolves the source-account sentinel to the given public key', () => {
    const scVal = toScVal({ type: 'source-account' }, DUMMY_ADDRESS);
    expect(scValToNative(scVal)).toBe(DUMMY_ADDRESS);
  });

  it('round-trips bytes given as a hex string', () => {
    const scVal = toScVal({ type: 'bytes', value: 'deadbeef' }, DUMMY_ADDRESS);
    expect(Buffer.from(scValToNative(scVal) as Uint8Array).toString('hex')).toBe('deadbeef');
  });
});
