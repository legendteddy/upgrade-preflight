#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import { loadConfig, ConfigError } from '../config/loader.js';
import { diffRun } from '../diff/engine.js';
import type { ScenarioEntry } from '../config/schema.js';
import { toMarkdown } from '../report/markdown.js';
import { toJson } from '../report/json.js';
import { runAgainstProtocol } from '../runner/run.js';
import { isDockerAvailable } from '../network/docker-available.js';
import { writeFile } from 'node:fs/promises';

const program = new Command();

program
  .name('upgrade-preflight')
  .description('Diffs Soroban contract behavior across two Stellar protocol versions on local networks.')
  .version('0.1.0');

program
  .command('run')
  .description('Run all configured scenarios against two protocol versions and diff the results.')
  .requiredOption('--from <protocol>', 'baseline protocol version', parseIntOption)
  .requiredOption('--to <protocol>', 'target protocol version', parseIntOption)
  .option('-c, --config <path>', 'path to preflight.config.yml', 'preflight.config.yml')
  .option('--markdown-out <path>', 'write the Markdown report to this file')
  .option('--json-out <path>', 'write the JSON report to this file')
  .action(async (options) => {
    const configPath = resolve(process.cwd(), options.config);
    const config = await loadConfig(configPath).catch(exitOnConfigError);

    if (!(await isDockerAvailable())) {
      console.error(
        'Docker is not available (docker info failed). upgrade-preflight needs Docker to run stellar/quickstart networks.'
      );
      process.exitCode = 1;
      return;
    }

    const configDir = dirname(configPath);
    const costThresholdFor = (scenario: string): number => {
      const entry = config.scenarios.find((s: ScenarioEntry) => s.name === scenario);
      return entry?.thresholds?.costPercent ?? config.thresholds.costPercent;
    };

    console.error(`Starting baseline network (protocol ${options.from})...`);
    const baselineResults = await runAgainstProtocol(config, {
      hostPort: 8000,
      containerName: `upgrade-preflight-${options.from}`,
      protocolVersion: options.from,
      configDir,
    });

    console.error(`Starting target network (protocol ${options.to})...`);
    const targetResults = await runAgainstProtocol(config, {
      hostPort: 8001,
      containerName: `upgrade-preflight-${options.to}`,
      protocolVersion: options.to,
      configDir,
    });

    const diff = diffRun(options.from, options.to, baselineResults, targetResults, costThresholdFor);

    const markdown = toMarkdown(diff);
    console.log(markdown);
    if (options.markdownOut) await writeFile(options.markdownOut, markdown, 'utf8');
    if (options.jsonOut) await writeFile(options.jsonOut, toJson(diff), 'utf8');

    if (diff.overallVerdict === 'BEHAVIOR_CHANGED' || diff.overallVerdict === 'BROKE') {
      process.exitCode = 1;
    } else if (diff.overallVerdict === 'ERROR') {
      process.exitCode = 2;
    }
  });

program
  .command('list-scenarios')
  .description('List the scenarios declared in a config file.')
  .option('-c, --config <path>', 'path to preflight.config.yml', 'preflight.config.yml')
  .action(async (options) => {
    const config = await loadConfig(resolve(process.cwd(), options.config)).catch(exitOnConfigError);
    for (const scenario of config.scenarios) {
      console.log(`${scenario.name}  (${scenario.contract}.${scenario.function}, submit=${scenario.submit})`);
    }
  });

program
  .command('validate')
  .argument('<config>', 'path to preflight.config.yml')
  .description('Validate a config file without running anything.')
  .action(async (configPath: string) => {
    await loadConfig(resolve(process.cwd(), configPath)).catch(exitOnConfigError);
    console.log('Config is valid.');
  });

function parseIntOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Not a valid integer: "${value}"`);
  return parsed;
}

function exitOnConfigError(err: unknown): never {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

program.parseAsync(process.argv);
