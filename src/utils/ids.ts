function fallbackRandomChunk(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 8);
  }

  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

export function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : fallbackRandomChunk();

  return `${prefix}_${Date.now()}_${random}`;
}
