import { StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { buildSubstitutions, normalizeEventXdr, normalizeText, normalizeValue } from './normalize.js';

// Real diagnostic events captured by the first real 27 -> 28 run (say-hello, workflow run
// 37378874986). The two networks deployed the same contract, so the events are identical except
// for the contract ID each network assigned. Before normalization they compared as different and
// every scenario was reported BEHAVIOR_CHANGED.
const BASELINE_ID = 'ef4354c01f552934b22fcbfc8d6bf7bf194bcc9b1bab24d6fdd986bad6a67ba4';
const TARGET_ID = '045a0e4541cfab838ee965c8ea033870996fa04e63377a4ca86f5a16da21017f';

const BASELINE_EVENTS = [
  'AAAAAQAAAAAAAAAAAAAAAgAAAAAAAAADAAAADwAAAAdmbl9jYWxsAAAAAA0AAAAg70NUwB9VKTSyL8v8jWv3vxlLzJsbqyTW/dmGutame6QAAAAPAAAABWhlbGxvAAAAAAAADgAAAAlwcmVmbGlnaHQAAAA=',
  'AAAAAQAAAAAAAAAB70NUwB9VKTSyL8v8jWv3vxlLzJsbqyTW/dmGutame6QAAAACAAAAAAAAAAIAAAAPAAAACWZuX3JldHVybgAAAAAAAA8AAAAFaGVsbG8AAAAAAAAQAAAAAQAAAAIAAAAOAAAABUhlbGxvAAAAAAAADgAAAAlwcmVmbGlnaHQAAAA=',
];
const TARGET_EVENTS = [
  'AAAAAQAAAAAAAAAAAAAAAgAAAAAAAAADAAAADwAAAAdmbl9jYWxsAAAAAA0AAAAgBFoORUHPq4OO6WXI6gM4cJlvoE5jN3pMqG9aFtohAX8AAAAPAAAABWhlbGxvAAAAAAAADgAAAAlwcmVmbGlnaHQAAAA=',
  'AAAAAQAAAAAAAAABBFoORUHPq4OO6WXI6gM4cJlvoE5jN3pMqG9aFtohAX8AAAACAAAAAAAAAAIAAAAPAAAACWZuX3JldHVybgAAAAAAAA8AAAAFaGVsbG8AAAAAAAAQAAAAAQAAAAIAAAAOAAAABUhlbGxvAAAAAAAADgAAAAlwcmVmbGlnaHQAAAA=',
];

const idOf = (hex: string) => StrKey.encodeContract(Uint8Array.from(Buffer.from(hex, 'hex')));

describe('normalizeEventXdr', () => {
  it('makes the same logical events from two networks compare equal', () => {
    const baselineSubs = buildSubstitutions(new Map([['hello', idOf(BASELINE_ID)]]), new Map());
    const targetSubs = buildSubstitutions(new Map([['hello', idOf(TARGET_ID)]]), new Map());

    const baseline = BASELINE_EVENTS.map((e) => normalizeEventXdr(e, baselineSubs));
    const target = TARGET_EVENTS.map((e) => normalizeEventXdr(e, targetSubs));

    expect(baseline).toEqual(target);
    expect(baseline).not.toEqual(BASELINE_EVENTS);
  });

  it('replaces the ID everywhere it appears, including inside a topic', () => {
    const subs = buildSubstitutions(new Map([['hello', idOf(BASELINE_ID)]]), new Map());
    // The fn_call event carries no contract-ID field; the ID is only in a topic.
    const normalized = Buffer.from(normalizeEventXdr(BASELINE_EVENTS[0]!, subs), 'base64');
    expect(normalized.includes(Buffer.from(BASELINE_ID, 'hex'))).toBe(false);
  });

  it('still reports a genuine difference in event content', () => {
    const subs = buildSubstitutions(new Map([['hello', idOf(BASELINE_ID)]]), new Map());
    const a = normalizeEventXdr(BASELINE_EVENTS[1]!, subs);
    // Same event, different payload bytes (corrupt the final base64 data char region).
    const buf = Buffer.from(BASELINE_EVENTS[1]!, 'base64');
    buf[buf.length - 3] = buf[buf.length - 3]! ^ 0xff;
    const b = normalizeEventXdr(buf.toString('base64'), subs);
    expect(a).not.toEqual(b);
  });

  it('leaves events untouched when no identity matches', () => {
    expect(normalizeEventXdr(BASELINE_EVENTS[1]!, [])).toBe(BASELINE_EVENTS[1]);
  });
});

// Real events from the same run's restricted-call scenario: this contract takes the caller's
// account as an argument, so the event embeds an account key as well as the contract ID. Both
// differ per network and both must be normalized.
const RC_BASELINE = [
  'AAAAAQAAAAAAAAAAAAAAAgAAAAAAAAADAAAADwAAAAdmbl9jYWxsAAAAAA0AAAAgSfU2uDleH/+rC34socJTC2BJaBIas7IGgBfVmESJu+MAAAAPAAAACnJlc3RyaWN0ZWQAAAAAABIAAAAAAAAAAJCLDUlSk7itn5nguCapbY0NeO7R4xXPijhQmYIFoxUM',
  'AAAAAQAAAAAAAAABSfU2uDleH/+rC34socJTC2BJaBIas7IGgBfVmESJu+MAAAACAAAAAAAAAAIAAAAPAAAACWZuX3JldHVybgAAAAAAAA8AAAAKcmVzdHJpY3RlZAAAAAAAAwAAAAE=',
];
const RC_TARGET = [
  'AAAAAQAAAAAAAAAAAAAAAgAAAAAAAAADAAAADwAAAAdmbl9jYWxsAAAAAA0AAAAgZkLUNCEnwUBGBtSL/8fKxiQCYsVPzCPJjkfp4kKP6lgAAAAPAAAACnJlc3RyaWN0ZWQAAAAAABIAAAAAAAAAAKKMZn79sgAHeHxWgY7odcSif+UI8tlu2JUOgYRmAvKJ',
  'AAAAAQAAAAAAAAABZkLUNCEnwUBGBtSL/8fKxiQCYsVPzCPJjkfp4kKP6lgAAAACAAAAAAAAAAIAAAAPAAAACWZuX3JldHVybgAAAAAAAA8AAAAKcmVzdHJpY3RlZAAAAAAAAwAAAAE=',
];
const accountOf = (hex: string) => StrKey.encodeEd25519PublicKey(Uint8Array.from(Buffer.from(hex, 'hex')));

describe('normalizeEventXdr with account addresses', () => {
  it('normalizes both the contract ID and the caller account', () => {
    const baselineSubs = buildSubstitutions(
      new Map([['restricted', idOf('49f536b8395e1fffab0b7e2ca1c2530b604968121ab3b2068017d5984489bbe3')]]),
      new Map([['alice', accountOf('908b0d495293b8ad9f99e0b826a96d8d0d78eed1e315cf8a3850998205a3150c')]])
    );
    const targetSubs = buildSubstitutions(
      new Map([['restricted', idOf('6642d4342127c1404606d48bffc7cac6240262c54fcc23c98e47e9e2428fea58')]]),
      new Map([['alice', accountOf('a28c667efdb20007787c56818ee875c4a27fe508f2d96ed8950e81846602f289')]])
    );
    expect(RC_BASELINE.map((e) => normalizeEventXdr(e, baselineSubs))).toEqual(
      RC_TARGET.map((e) => normalizeEventXdr(e, targetSubs))
    );
  });

  it('would still differ if the account were not normalized', () => {
    const contractOnly = (hex: string) => buildSubstitutions(new Map([['restricted', idOf(hex)]]), new Map());
    const b = RC_BASELINE.map((e) =>
      normalizeEventXdr(e, contractOnly('49f536b8395e1fffab0b7e2ca1c2530b604968121ab3b2068017d5984489bbe3'))
    );
    const t = RC_TARGET.map((e) =>
      normalizeEventXdr(e, contractOnly('6642d4342127c1404606d48bffc7cac6240262c54fcc23c98e47e9e2428fea58'))
    );
    expect(b).not.toEqual(t);
  });
});

describe('normalizeText / normalizeValue', () => {
  const contract = idOf(BASELINE_ID);
  const subs = buildSubstitutions(new Map([['hello', contract]]), new Map());

  it('replaces a contract strkey inside an error message', () => {
    expect(normalizeText(`contract ${contract} trapped`, subs)).toBe('contract <contract:hello> trapped');
  });

  it('replaces strkeys and raw bytes nested in return values, and keeps bigints', () => {
    const value = { to: contract, raw: Uint8Array.from(Buffer.from(BASELINE_ID, 'hex')), n: 5n, list: [contract] };
    expect(normalizeValue(value, subs)).toEqual({
      to: '<contract:hello>',
      raw: '<contract:hello>',
      n: 5n,
      list: ['<contract:hello>'],
    });
  });
});
