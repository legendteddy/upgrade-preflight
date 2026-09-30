import { rpc, scValToNative } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import type { ResourceUsage } from '../diff/types.js';

export interface SimulationOutcome {
  success: boolean;
  returnValue: unknown;
  contractError: string | null;
  events: string[];
  resources: ResourceUsage | null;
  minResourceFee: string | null;
}

/**
 * Runs `simulateTransaction` and normalizes the result into the shape the diff engine
 * compares. Field names below are taken directly from the installed SDK's own XDR type
 * definitions (`SorobanResources`, `LedgerFootprint`) — see PLAN.md "Verified facts": there is
 * no `cpuInsns`/`memBytes` field, only `instructions`/`diskReadBytes`/`writeBytes` plus
 * footprint entry counts.
 */
export async function simulate(server: rpc.Server, tx: Transaction): Promise<SimulationOutcome> {
  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    return {
      success: false,
      returnValue: null,
      contractError: sim.error,
      events: sim.events.map((event) => event.toXDR('base64')),
      resources: null,
      minResourceFee: null,
    };
  }

  return {
    success: true,
    returnValue: sim.result ? scValToNative(sim.result.retval) : null,
    contractError: null,
    events: sim.events.map((event) => event.toXDR('base64')),
    resources: extractResources(sim),
    minResourceFee: sim.minResourceFee,
  };
}

export function extractResources(
  sim: rpc.Api.SimulateTransactionSuccessResponse
): ResourceUsage {
  const data = sim.transactionData.build();
  const { resources } = data;
  return {
    instructions: resources.instructions,
    diskReadBytes: resources.diskReadBytes,
    writeBytes: resources.writeBytes,
    readEntries: resources.footprint.readOnly.length + resources.footprint.readWrite.length,
    writeEntries: resources.footprint.readWrite.length,
  };
}
