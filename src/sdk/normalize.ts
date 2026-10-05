import { createHash } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';

/** Every network the tool boots deploys with freshly generated accounts, so the same contract
 * gets a different contract ID on each network. Raw event XDR, return values and error text all
 * embed those IDs, which made every scenario that emits an event (every call emits diagnostic
 * events) compare as different across networks regardless of the protocol. Found by the first
 * real two-network run. Each network's own IDs are replaced with a placeholder derived from the
 * scenario-level name, so the same logical contract/account compares equal across networks. */
export interface Substitution {
  raw: Uint8Array;
  strkey: string;
  placeholderBytes: Buffer;
  placeholderText: string;
}

export function buildSubstitutions(
  contracts: Map<string, string>,
  accounts: Map<string, string>
): Substitution[] {
  const subs: Substitution[] = [];
  for (const [name, strkey] of contracts) {
    subs.push(makeSubstitution('contract', name, strkey, StrKey.decodeContract(strkey)));
  }
  for (const [name, strkey] of accounts) {
    subs.push(makeSubstitution('account', name, strkey, StrKey.decodeEd25519PublicKey(strkey)));
  }
  return subs;
}

function makeSubstitution(
  kind: 'contract' | 'account',
  name: string,
  strkey: string,
  raw: Uint8Array
): Substitution {
  return {
    raw,
    strkey,
    placeholderBytes: createHash('sha256').update(`${kind}:${name}`).digest(),
    placeholderText: `<${kind}:${name}>`,
  };
}

/** Replaces each known 32-byte identity inside the XDR with a fixed 32-byte placeholder. The
 * length is unchanged, so the result is still a structurally valid XDR value. */
export function normalizeEventXdr(base64: string, subs: Substitution[]): string {
  const buf = Buffer.from(base64, 'base64');
  for (const sub of subs) {
    const needle = Buffer.from(sub.raw);
    let at = buf.indexOf(needle);
    while (at !== -1) {
      sub.placeholderBytes.copy(buf, at);
      at = buf.indexOf(needle, at + needle.length);
    }
  }
  return buf.toString('base64');
}

export function normalizeText(text: string, subs: Substitution[]): string {
  let out = text;
  for (const sub of subs) {
    out = out.split(sub.strkey).join(sub.placeholderText);
  }
  return out;
}

/** Walks a decoded return value, swapping known IDs (as strkey strings or raw bytes). */
export function normalizeValue(value: unknown, subs: Substitution[]): unknown {
  if (typeof value === 'string') return normalizeText(value, subs);
  if (value instanceof Uint8Array) {
    const match = subs.find((s) => Buffer.from(s.raw).equals(Buffer.from(value)));
    return match ? match.placeholderText : value;
  }
  if (Array.isArray(value)) return value.map((v) => normalizeValue(v, subs));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        normalizeText(k, subs),
        normalizeValue(v, subs),
      ])
    );
  }
  return value;
}
