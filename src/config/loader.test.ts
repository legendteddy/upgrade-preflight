import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './loader.js';

const validConfig = {
  contracts: [{ name: 'hello', wasm: './hello.wasm' }],
  accounts: ['default'],
  scenarios: [
    {
      name: 'say-hello',
      contract: 'hello',
      function: 'hello',
      args: [{ type: 'symbol', value: 'world' }],
    },
  ],
};

const largeIntegerTypes = ['u64', 'i64', 'u128', 'i128'] as const;
const invalidDecimalIntegers = ['', '  ', '0x10', '0b11', '1.5', 'abc'] as const;

function configWithArg(type: (typeof largeIntegerTypes)[number], value: string) {
  return {
    ...validConfig,
    scenarios: [
      {
        ...validConfig.scenarios[0],
        args: [{ type, value }],
      },
    ],
  };
}

describe('parseConfig', () => {
  it('accepts a minimal valid config and fills in defaults', () => {
    const config = parseConfig(validConfig);
    expect(config.thresholds.costPercent).toBe(5);
    expect(config.scenarios[0]?.sourceAccount).toBe('default');
    expect(config.scenarios[0]?.submit).toBe(false);
  });

  it('rejects a scenario referencing an undeclared contract', () => {
    const bad = {
      ...validConfig,
      scenarios: [{ ...validConfig.scenarios[0], contract: 'nonexistent' }],
    };
    expect(() => parseConfig(bad)).toThrow(ConfigError);
  });

  it('rejects a scenario referencing an undeclared account', () => {
    const bad = {
      ...validConfig,
      scenarios: [{ ...validConfig.scenarios[0], sourceAccount: 'nonexistent' }],
    };
    expect(() => parseConfig(bad)).toThrow(ConfigError);
  });

  it('rejects a config with no contracts', () => {
    expect(() => parseConfig({ ...validConfig, contracts: [] })).toThrow(ConfigError);
  });

  it('rejects a config with no scenarios', () => {
    expect(() => parseConfig({ ...validConfig, scenarios: [] })).toThrow(ConfigError);
  });

  it('rejects an arg with an unknown type', () => {
    const bad = {
      ...validConfig,
      scenarios: [
        {
          ...validConfig.scenarios[0],
          args: [{ type: 'not-a-real-type', value: '1' }],
        },
      ],
    };
    expect(() => parseConfig(bad)).toThrow(ConfigError);
  });

  it.each(
    largeIntegerTypes.flatMap((type) => invalidDecimalIntegers.map((value) => [type, value] as const)),
  )('rejects non-decimal %s value %j with a path-aware error', (type, value) => {
    try {
      parseConfig(configWithArg(type, value));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).toContain('scenarios.0.args.0.value');
      expect((err as Error).message).toContain(type);
      expect((err as Error).message).toContain(JSON.stringify(value));
    }
  });

  it.each([
    ['u64', '0'],
    ['u64', '18446744073709551615'],
    ['i64', '-1'],
    ['i64', '-9223372036854775808'],
    ['i64', '9223372036854775807'],
    ['u128', '0'],
    ['u128', '340282366920938463463374607431768211455'],
    ['i128', '-1'],
    ['i128', '-170141183460469231731687303715884105728'],
    ['i128', '170141183460469231731687303715884105727'],
  ] as const)('accepts decimal %s value %s', (type, value) => {
    const config = parseConfig(configWithArg(type, value));
    expect(config.scenarios[0]?.args[0]).toEqual({ type, value });
  });

  it('accepts a per-scenario threshold override', () => {
    const config = parseConfig({
      ...validConfig,
      scenarios: [{ ...validConfig.scenarios[0], thresholds: { costPercent: 10 } }],
    });
    expect(config.scenarios[0]?.thresholds?.costPercent).toBe(10);
  });

  it('error message lists the offending path', () => {
    try {
      parseConfig({ ...validConfig, contracts: [] });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).toContain('contracts');
    }
  });
});
