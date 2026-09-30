import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/loader.js';
import { diffRun } from '../diff/engine.js';
import { isDockerAvailable } from '../network/docker-available.js';
import { runAgainstProtocol } from './run.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(HERE, '../../preflight.config.yml');
const WASM_DIR = resolve(HERE, '../../examples/wasm');

// Computed once at collection time, per vitest's documented top-level-await support, so
// `it.skipIf` sees a real boolean rather than a pending promise.
const dockerAvailable = await isDockerAvailable();
const wasmFilesPresent = existsSync(WASM_DIR) && existsSync(resolve(WASM_DIR, 'hello-world.wasm'));

describe('runAgainstProtocol (integration)', () => {
  it.skipIf(!dockerAvailable || !wasmFilesPresent)(
    'runs every example scenario against a real local network and produces resource data',
    async () => {
      const config = await loadConfig(CONFIG_PATH);
      const configDir = resolve(HERE, '../..');

      const results = await runAgainstProtocol(config, {
        hostPort: 8100,
        containerName: 'upgrade-preflight-it',
        protocolVersion: 27,
        configDir,
      });

      expect(results).toHaveLength(config.scenarios.length);
      for (const result of results) {
        expect(result.status).toBe('ok');
      }

      const helloResult = results.find((r) => r.scenario === 'say-hello');
      expect(helloResult?.success).toBe(true);
      expect(helloResult?.resources).not.toBeNull();

      // Diffing a run against itself must always report SAME.
      const selfDiff = diffRun(27, 27, results, results, () => 5);
      expect(selfDiff.overallVerdict).toBe('SAME');
    },
    180_000
  );

  it('logs why it skipped, when it skips', () => {
    if (!dockerAvailable) {
      console.log('upgrade-preflight integration test skipped: Docker is not available.');
    } else if (!wasmFilesPresent) {
      console.log(
        'upgrade-preflight integration test skipped: examples/wasm/*.wasm not built — run `cd examples && stellar contract build` and copy the outputs, see examples/wasm/README.md.'
      );
    }
    expect(true).toBe(true);
  });
});
