import { Keypair } from '@stellar/stellar-sdk';

export interface FundedAccount {
  keypair: Keypair;
  publicKey: string;
}

/** Generates a fresh keypair and funds it via the network's friendbot. Never reuses or persists
 * secrets across runs — a new ephemeral keypair is created per named account per network. */
export async function createFundedAccount(friendbotUrl: string): Promise<FundedAccount> {
  const keypair = Keypair.random();
  const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(keypair.publicKey())}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Friendbot funding failed for ${keypair.publicKey()}: ${response.status} ${body}`);
  }
  return { keypair, publicKey: keypair.publicKey() };
}
