import { readFile } from 'node:fs/promises';
import { BASE_FEE, Operation, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import type { Keypair } from '@stellar/stellar-sdk';
import type { PreflightConfig, ScenarioEntry } from '../config/schema.js';
import type { ScenarioResult } from '../diff/types.js';
import { startQuickstart } from '../network/quickstart.js';
import { createFundedAccount, type FundedAccount } from '../sdk/accounts.js';
import { toScVal } from '../sdk/args.js';
import { deployContract, submitAndWait } from '../sdk/deploy.js';
import { simulate } from '../sdk/simulate.js';

export interface RunOptions {
  hostPort: number;
  containerName: string;
  protocolVersion: number;
  configDir: string;
}

/** Runs an entire config (fund accounts, deploy contracts, execute every scenario) against one
 * protocol version on its own local quickstart network, always tearing the network down. */
export async function runAgainstProtocol(
  config: PreflightConfig,
  opts: RunOptions
): Promise<ScenarioResult[]> {
  const network = await startQuickstart({
    containerName: opts.containerName,
    hostPort: opts.hostPort,
    protocolVersion: opts.protocolVersion,
  });

  try {
    const server = new rpc.Server(network.rpcUrl, { allowHttp: true });

    const accounts = new Map<string, FundedAccount>();
    for (const name of config.accounts) {
      accounts.set(name, await createFundedAccount(network.friendbotUrl));
    }

    const deployerName = config.accounts[0];
    if (!deployerName) throw new Error('config.accounts must declare at least one account.');
    const deployer = accounts.get(deployerName)!.keypair;

    const contracts = new Map<string, string>();
    for (const contractEntry of config.contracts) {
      const wasm = await readFile(resolveWasmPath(opts.configDir, contractEntry.wasm));
      const contractId = await deployContract(server, network.networkPassphrase, deployer, wasm);
      contracts.set(contractEntry.name, contractId);
    }

    const results: ScenarioResult[] = [];
    for (const scenario of config.scenarios) {
      results.push(
        await runScenario(server, network.networkPassphrase, scenario, accounts, contracts)
      );
    }
    return results;
  } finally {
    await network.stop();
  }
}

function resolveWasmPath(configDir: string, wasmPath: string): string {
  return wasmPath.startsWith('/') || /^[A-Za-z]:/.test(wasmPath)
    ? wasmPath
    : `${configDir}/${wasmPath}`;
}

async function runScenario(
  server: rpc.Server,
  networkPassphrase: string,
  scenario: ScenarioEntry,
  accounts: Map<string, FundedAccount>,
  contracts: Map<string, string>
): Promise<ScenarioResult> {
  try {
    const account = accounts.get(scenario.sourceAccount);
    if (!account) throw new Error(`No funded account named "${scenario.sourceAccount}".`);
    const contractId = contracts.get(scenario.contract);
    if (!contractId) throw new Error(`No deployed contract named "${scenario.contract}".`);

    const tx = await buildInvocation(server, networkPassphrase, account.keypair, contractId, scenario);
    const outcome = await simulate(server, tx);

    if (scenario.submit && outcome.success) {
      const prepared = await server.prepareTransaction(tx);
      prepared.sign(account.keypair);
      await submitAndWait(server, prepared);
    }

    return {
      scenario: scenario.name,
      status: 'ok',
      success: outcome.success,
      returnValue: outcome.returnValue,
      contractError: outcome.contractError,
      events: outcome.events,
      resources: outcome.resources,
      minResourceFee: outcome.minResourceFee,
    };
  } catch (err) {
    return {
      scenario: scenario.name,
      status: 'error',
      toolError: (err as Error).message,
      success: false,
      returnValue: null,
      contractError: null,
      events: [],
      resources: null,
      minResourceFee: null,
    };
  }
}

async function buildInvocation(
  server: rpc.Server,
  networkPassphrase: string,
  source: Keypair,
  contractId: string,
  scenario: ScenarioEntry
) {
  const account = await server.getAccount(source.publicKey());
  const args = scenario.args.map((arg) => toScVal(arg, source.publicKey()));
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: scenario.function,
        args,
      })
    )
    .setTimeout(30)
    .build();
}
