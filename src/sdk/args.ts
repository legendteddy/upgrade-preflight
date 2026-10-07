import { nativeToScVal, type xdr } from '@stellar/stellar-sdk';
import { DECIMAL_INTEGER_PATTERN, type ScVarArg } from '../config/schema.js';

/** Converts our config's typed arg entries into real `xdr.ScVal`s via the SDK's own
 * `nativeToScVal` helper, rather than hand-building ScVal XDR ourselves. `bytes` values are
 * given as hex strings in config (documented in docs/WRITING_SCENARIOS.md). `sourceAccountPublicKey`
 * resolves the `source-account` sentinel arg — see schema.ts. */
export function toScVal(arg: ScVarArg, sourceAccountPublicKey: string): xdr.ScVal {
  switch (arg.type) {
    case 'source-account':
      return nativeToScVal(sourceAccountPublicKey, { type: 'address' });
    case 'u32':
      return nativeToScVal(arg.value, { type: 'u32' });
    case 'i32':
      return nativeToScVal(arg.value, { type: 'i32' });
    case 'u64':
      return nativeToScVal(parseDecimalInteger(arg.type, arg.value), { type: 'u64' });
    case 'i64':
      return nativeToScVal(parseDecimalInteger(arg.type, arg.value), { type: 'i64' });
    case 'u128':
      return nativeToScVal(parseDecimalInteger(arg.type, arg.value), { type: 'u128' });
    case 'i128':
      return nativeToScVal(parseDecimalInteger(arg.type, arg.value), { type: 'i128' });
    case 'bool':
      return nativeToScVal(arg.value, { type: 'bool' });
    case 'string':
      return nativeToScVal(arg.value, { type: 'string' });
    case 'symbol':
      return nativeToScVal(arg.value, { type: 'symbol' });
    case 'address':
      return nativeToScVal(arg.value, { type: 'address' });
    case 'bytes':
      return nativeToScVal(Buffer.from(arg.value, 'hex'), { type: 'bytes' });
  }
}

function parseDecimalInteger(type: 'u64' | 'i64' | 'u128' | 'i128', value: string): bigint {
  if (!DECIMAL_INTEGER_PATTERN.test(value)) {
    throw new TypeError(`Invalid ${type} value ${JSON.stringify(value)}: expected a decimal integer.`);
  }
  return BigInt(value);
}
