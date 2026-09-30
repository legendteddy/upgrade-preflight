import {
  Address,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  hash,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';

export interface DeployedContract {
  name: string;
  contractId: string;
}

/** Uploads a wasm blob, then deploys it as a new contract instance, using
 * `server.prepareTransaction` (which assembles footprint + resource fee from simulation) for
 * both steps, then waits for each submission to actually finalize. */
export async function deployContract(
  server: rpc.Server,
  networkPassphrase: string,
  deployer: Keypair,
  wasm: Uint8Array
): Promise<string> {
  await uploadWasm(server, networkPassphrase, deployer, wasm);
  const wasmHash = hash(wasm);
  return createContract(server, networkPassphrase, deployer, wasmHash);
}

async function uploadWasm(
  server: rpc.Server,
  networkPassphrase: string,
  deployer: Keypair,
  wasm: Uint8Array
): Promise<void> {
  const account = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(deployer);
  await submitAndWait(server, prepared);
}

async function createContract(
  server: rpc.Server,
  networkPassphrase: string,
  deployer: Keypair,
  wasmHash: Uint8Array
): Promise<string> {
  const account = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(deployer.publicKey()),
        wasmHash,
      })
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Contract deployment simulation failed: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error('Contract deployment simulation returned no result.');
  }
  const contractId = scValToNative(sim.result.retval) as string;

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(deployer);
  await submitAndWait(server, prepared);

  return contractId;
}

export async function submitAndWait(
  server: rpc.Server,
  tx: Parameters<rpc.Server['sendTransaction']>[0]
): Promise<void> {
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === 'ERROR') {
    const detail = sendResult.errorResult ? sendResult.errorResult.toXDR('base64') : 'unknown error';
    throw new Error(`Transaction submission was rejected: ${detail}`);
  }

  const result = await server.pollTransaction(sendResult.hash, { attempts: 30 });
  if (result.status !== 'SUCCESS') {
    throw new Error(`Transaction ${sendResult.hash} did not succeed: status=${result.status}`);
  }
}
