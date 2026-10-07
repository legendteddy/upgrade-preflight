import { Address, scValToNative, StrKey } from '@stellar/stellar-sdk';
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

  describe('i32', () => {
    it('round-trips zero and negative values', () => {
      expect(scValToNative(toScVal({ type: 'i32', value: 0 }, DUMMY_ADDRESS))).toBe(0);
      expect(scValToNative(toScVal({ type: 'i32', value: -7 }, DUMMY_ADDRESS))).toBe(-7);
    });

    it('accepts the 32-bit signed boundaries', () => {
      expect(scValToNative(toScVal({ type: 'i32', value: -2147483648 }, DUMMY_ADDRESS))).toBe(-2147483648);
      expect(scValToNative(toScVal({ type: 'i32', value: 2147483647 }, DUMMY_ADDRESS))).toBe(2147483647);
    });

    it('rejects values just outside the 32-bit signed range', () => {
      expect(() => toScVal({ type: 'i32', value: 2147483648 }, DUMMY_ADDRESS)).toThrow(/invalid value.*i32/);
      expect(() => toScVal({ type: 'i32', value: -2147483649 }, DUMMY_ADDRESS)).toThrow(/invalid value.*i32/);
    });
  });

  describe('u64', () => {
    it('round-trips zero and the maximum value', () => {
      expect(scValToNative(toScVal({ type: 'u64', value: '0' }, DUMMY_ADDRESS))).toBe(0n);
      expect(scValToNative(toScVal({ type: 'u64', value: '18446744073709551615' }, DUMMY_ADDRESS))).toBe(
        18446744073709551615n,
      );
    });

    it('rejects a value one past the maximum', () => {
      expect(() => toScVal({ type: 'u64', value: '18446744073709551616' }, DUMMY_ADDRESS)).toThrow(
        /for u64 out of range/,
      );
    });

    it('rejects a negative value for an unsigned type', () => {
      expect(() => toScVal({ type: 'u64', value: '-1' }, DUMMY_ADDRESS)).toThrow(/u64.*negative/);
    });

    it('rejects a non-decimal value with a readable error', () => {
      expect(() => toScVal({ type: 'u64', value: 'abc' }, DUMMY_ADDRESS)).toThrow(
        /Invalid u64 value "abc": expected a decimal integer/,
      );
    });
  });

  describe('i64', () => {
    it('round-trips both 64-bit signed boundaries', () => {
      expect(scValToNative(toScVal({ type: 'i64', value: '-9223372036854775808' }, DUMMY_ADDRESS))).toBe(
        -9223372036854775808n,
      );
      expect(scValToNative(toScVal({ type: 'i64', value: '9223372036854775807' }, DUMMY_ADDRESS))).toBe(
        9223372036854775807n,
      );
    });

    it('rejects values just outside the 64-bit signed range', () => {
      expect(() => toScVal({ type: 'i64', value: '9223372036854775808' }, DUMMY_ADDRESS)).toThrow(
        /for i64 out of range/,
      );
      expect(() => toScVal({ type: 'i64', value: '-9223372036854775809' }, DUMMY_ADDRESS)).toThrow(
        /for i64 out of range/,
      );
    });
  });

  describe('u128', () => {
    const U128_MAX = 2n ** 128n - 1n;

    it('round-trips zero and the maximum value', () => {
      expect(scValToNative(toScVal({ type: 'u128', value: '0' }, DUMMY_ADDRESS))).toBe(0n);
      expect(scValToNative(toScVal({ type: 'u128', value: U128_MAX.toString() }, DUMMY_ADDRESS))).toBe(U128_MAX);
    });

    it('rejects a value one past the maximum', () => {
      expect(() => toScVal({ type: 'u128', value: (U128_MAX + 1n).toString() }, DUMMY_ADDRESS)).toThrow(
        /for u128 out of range/,
      );
    });

    it('rejects a negative value for an unsigned type', () => {
      expect(() => toScVal({ type: 'u128', value: '-1' }, DUMMY_ADDRESS)).toThrow(/u128.*negative/);
    });
  });

  describe('i128 boundaries', () => {
    it('round-trips the minimum value', () => {
      const min = -(2n ** 127n);
      expect(scValToNative(toScVal({ type: 'i128', value: min.toString() }, DUMMY_ADDRESS))).toBe(min);
    });

    it('rejects a value one past the maximum', () => {
      expect(() => toScVal({ type: 'i128', value: (2n ** 127n).toString() }, DUMMY_ADDRESS)).toThrow(
        /for i128 out of range/,
      );
    });
  });

  describe('bool', () => {
    it('round-trips true and false', () => {
      expect(scValToNative(toScVal({ type: 'bool', value: true }, DUMMY_ADDRESS))).toBe(true);
      expect(scValToNative(toScVal({ type: 'bool', value: false }, DUMMY_ADDRESS))).toBe(false);
    });
  });

  describe('string', () => {
    it('round-trips an empty string', () => {
      expect(scValToNative(toScVal({ type: 'string', value: '' }, DUMMY_ADDRESS))).toBe('');
    });

    it('round-trips non-ASCII text, including multi-byte characters and emoji', () => {
      const value = 'héllo 世界 🚀';
      expect(scValToNative(toScVal({ type: 'string', value }, DUMMY_ADDRESS))).toBe(value);
    });
  });

  describe('address', () => {
    it('round-trips an account address', () => {
      expect(scValToNative(toScVal({ type: 'address', value: DUMMY_ADDRESS }, DUMMY_ADDRESS))).toBe(DUMMY_ADDRESS);
    });

    it('round-trips a contract address', () => {
      const contract = StrKey.encodeContract(Buffer.alloc(32, 1));
      expect(scValToNative(toScVal({ type: 'address', value: contract }, DUMMY_ADDRESS))).toBe(contract);
      expect(Address.fromString(contract).toString()).toBe(contract);
    });

    it.each([
      ['a malformed string', 'not-an-address'],
      ['an empty string', ''],
      ['an address with a bad checksum', DUMMY_ADDRESS.slice(0, -1) + 'A'],
    ])('rejects %s with a readable error', (_label, value) => {
      expect(() => toScVal({ type: 'address', value }, DUMMY_ADDRESS)).toThrow(/Unsupported address type/);
    });
  });
});
