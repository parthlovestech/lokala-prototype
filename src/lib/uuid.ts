/**
 * RFC 4122 version-4 UUID generation for the mobile runtime.
 *
 * The payment backend validates `clientRequestId` as a strict UUID and uses it as
 * the idempotency key for a charge, so this must always produce a well-formed v4.
 *
 * It prefers the platform crypto when the runtime exposes it (`crypto.randomUUID`
 * on newer engines, or `crypto.getRandomValues` for entropy) and falls back to
 * `Math.random` only when neither is present. The fallback is weaker entropy but
 * still a valid, collision-resistant-enough v4 for a per-attempt key.
 */

type MaybeCrypto = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

const HEX_OCTETS: string[] = [];
for (let i = 0; i < 256; i += 1) {
  HEX_OCTETS.push((i + 0x100).toString(16).slice(1));
}

function getCrypto(): MaybeCrypto | undefined {
  const g = globalThis as unknown as { crypto?: MaybeCrypto };
  return g.crypto;
}

export function uuidv4(): string {
  const cryptoObj = getCrypto();

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Version (4) in the high nibble of byte 6; variant (10xx) in byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return (
    HEX_OCTETS[bytes[0]] +
    HEX_OCTETS[bytes[1]] +
    HEX_OCTETS[bytes[2]] +
    HEX_OCTETS[bytes[3]] +
    '-' +
    HEX_OCTETS[bytes[4]] +
    HEX_OCTETS[bytes[5]] +
    '-' +
    HEX_OCTETS[bytes[6]] +
    HEX_OCTETS[bytes[7]] +
    '-' +
    HEX_OCTETS[bytes[8]] +
    HEX_OCTETS[bytes[9]] +
    '-' +
    HEX_OCTETS[bytes[10]] +
    HEX_OCTETS[bytes[11]] +
    HEX_OCTETS[bytes[12]] +
    HEX_OCTETS[bytes[13]] +
    HEX_OCTETS[bytes[14]] +
    HEX_OCTETS[bytes[15]]
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
