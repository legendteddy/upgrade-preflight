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
