import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { PreflightConfigSchema, type PreflightConfig } from './schema.js';

export class ConfigError extends Error {}

export function parseConfig(raw: unknown): PreflightConfig {
  const result = PreflightConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(formatZodError(result.error));
  }
  return result.data;
}

export async function loadConfig(path: string): Promise<PreflightConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    throw new ConfigError(`Could not read config file at ${path}: ${(err as Error).message}`);
  }

  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new ConfigError(`Could not parse ${path} as YAML: ${(err as Error).message}`);
  }

  return parseConfig(raw);
}

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${path}: ${issue.message}`;
  });
  return `Invalid preflight config:\n${lines.join('\n')}`;
}
