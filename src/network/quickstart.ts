import { spawn } from 'node:child_process';

export interface QuickstartOptions {
  /** Container name; must be unique per concurrently-running network. */
  containerName: string;
  /** Host port to bind the image's single main port (8000) to. */
  hostPort: number;
  /** Soroban protocol version to run, or undefined for the image default (latest). */
  protocolVersion?: number;
  /** Docker image reference. Defaults to the published stellar/quickstart:latest. */
  image?: string;
  /** Health-check timeout/poll interval overrides, mainly for fast unit tests. */
  healthTimeoutMs?: number;
  healthPollIntervalMs?: number;
}

export interface QuickstartNetwork {
  containerName: string;
  rpcUrl: string;
  friendbotUrl: string;
  networkPassphrase: string;
  stop(): Promise<void>;
}

export const STANDALONE_NETWORK_PASSPHRASE = 'Standalone Network ; February 2017';

/** Real, load-bearing fact verified against
 * https://raw.githubusercontent.com/stellar/quickstart/master/README.md on 2026-09-29 — see PLAN.md. */
export const DEFAULT_IMAGE = 'stellar/quickstart:latest';

export async function startQuickstart(opts: QuickstartOptions): Promise<QuickstartNetwork> {
  const image = opts.image ?? DEFAULT_IMAGE;
  const args = [
    'run',
    '-d',
    '--rm',
    '--name',
    opts.containerName,
    '-p',
    `${opts.hostPort}:8000`,
    image,
    '--local',
    '--limits',
    'testnet',
    '--enable',
    'core,horizon,rpc',
  ];
  if (opts.protocolVersion !== undefined) {
    args.push('--protocol-version', String(opts.protocolVersion));
  }

  await runDocker(args);

  const rpcUrl = `http://localhost:${opts.hostPort}/rpc`;
  const friendbotUrl = `http://localhost:${opts.hostPort}/friendbot`;

  try {
    await waitHealthy(rpcUrl, friendbotUrl, opts.healthTimeoutMs, opts.healthPollIntervalMs);
  } catch (err) {
    await stopQuickstart(opts.containerName);
    throw err;
  }

  return {
    containerName: opts.containerName,
    rpcUrl,
    friendbotUrl,
    networkPassphrase: STANDALONE_NETWORK_PASSPHRASE,
    async stop() {
      await stopQuickstart(opts.containerName);
    },
  };
}

export async function stopQuickstart(containerName: string): Promise<void> {
  try {
    await runDocker(['stop', containerName]);
  } catch {
    // Already stopped or never started; --rm above means it self-removes on stop.
  }
}

/** Mirrors the health check `stellar/quickstart@main`'s own action.yml uses: poll the RPC
 * getHealth method and the friendbot endpoint until both respond as expected, or time out. */
export async function waitHealthy(
  rpcUrl: string,
  friendbotUrl: string,
  timeoutMs = 120_000,
  pollIntervalMs = 1_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: string = 'timed out waiting for health checks';

  while (Date.now() < deadline) {
    try {
      const rpcOk = await checkRpcHealth(rpcUrl);
      const friendbotOk = await checkFriendbot(friendbotUrl);
      if (rpcOk && friendbotOk) return;
    } catch (err) {
      lastError = (err as Error).message;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Network never became healthy: ${lastError}`);
}

async function checkRpcHealth(rpcUrl: string): Promise<boolean> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { result?: { status?: string } };
  return body.result?.status === 'healthy';
}

async function checkFriendbot(friendbotUrl: string): Promise<boolean> {
  // A friendbot request with no `addr` responds with an `invalid_field` error when it's up —
  // this is the exact check stellar/quickstart's own action.yml healthcheck performs.
  const response = await fetch(friendbotUrl);
  const text = await response.text();
  return text.includes('invalid_field');
}

function runDocker(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', (err) => reject(new Error(`Failed to spawn docker: ${err.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`docker ${args.join(' ')} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
