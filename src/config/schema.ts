import { z } from 'zod';

export const DECIMAL_INTEGER_PATTERN = /^-?\d+$/;

type LargeIntegerType = 'u64' | 'i64' | 'u128' | 'i128';

function decimalIntegerString(type: LargeIntegerType) {
  return z.string().superRefine((value, ctx) => {
    if (!DECIMAL_INTEGER_PATTERN.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `${type} value ${JSON.stringify(value)} must be a decimal integer`,
      });
    }
  });
}

export const ScVarArgSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('u32'), value: z.number().int().nonnegative() }),
  z.object({ type: z.literal('i32'), value: z.number().int() }),
  z.object({ type: z.literal('u64'), value: decimalIntegerString('u64') }),
  z.object({ type: z.literal('i64'), value: decimalIntegerString('i64') }),
  z.object({ type: z.literal('u128'), value: decimalIntegerString('u128') }),
  z.object({ type: z.literal('i128'), value: decimalIntegerString('i128') }),
  z.object({ type: z.literal('bool'), value: z.boolean() }),
  z.object({ type: z.literal('string'), value: z.string() }),
  z.object({ type: z.literal('symbol'), value: z.string() }),
  z.object({ type: z.literal('address'), value: z.string() }),
  z.object({ type: z.literal('bytes'), value: z.string() }),
  // Resolved at run time to the scenario's own `sourceAccount` public key — the config can't
  // know that address in advance, since a fresh keypair is generated and funded per run.
  z.object({ type: z.literal('source-account') }),
]);

export type ScVarArg = z.infer<typeof ScVarArgSchema>;

export const ThresholdsSchema = z.object({
  costPercent: z.number().positive().default(5),
});

export type Thresholds = z.infer<typeof ThresholdsSchema>;

export const ContractEntrySchema = z.object({
  name: z.string().min(1),
  wasm: z.string().min(1),
});

export type ContractEntry = z.infer<typeof ContractEntrySchema>;

export const ExpectedResultSchema = z.object({
  success: z.boolean().optional(),
  errorContains: z.string().optional(),
});

export type ExpectedResult = z.infer<typeof ExpectedResultSchema>;

export const ScenarioEntrySchema = z.object({
  name: z.string().min(1),
  contract: z.string().min(1),
  function: z.string().min(1),
  args: z.array(ScVarArgSchema).default([]),
  sourceAccount: z.string().min(1).default('default'),
  submit: z.boolean().default(false),
  expected: ExpectedResultSchema.optional(),
  thresholds: ThresholdsSchema.partial().optional(),
});

export type ScenarioEntry = z.infer<typeof ScenarioEntrySchema>;

export const PreflightConfigSchema = z
  .object({
    contracts: z.array(ContractEntrySchema).min(1),
    accounts: z.array(z.string().min(1)).default(['default']),
    scenarios: z.array(ScenarioEntrySchema).min(1),
    thresholds: ThresholdsSchema.default({ costPercent: 5 }),
  })
  .refine(
    (config) => {
      const contractNames = new Set(config.contracts.map((c) => c.name));
      return config.scenarios.every((s) => contractNames.has(s.contract));
    },
    { message: 'Every scenario.contract must reference a name declared in contracts[].' }
  )
  .refine(
    (config) => {
      const accountNames = new Set(config.accounts);
      return config.scenarios.every((s) => accountNames.has(s.sourceAccount));
    },
    { message: 'Every scenario.sourceAccount must reference a name declared in accounts[].' }
  );

export type PreflightConfig = z.infer<typeof PreflightConfigSchema>;
