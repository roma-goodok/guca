function safeBtoa(input: string): string {
  const btoaImpl = (globalThis as any).btoa;
  if (typeof btoaImpl === 'function') return btoaImpl(input);

  const BufferImpl = (globalThis as any).Buffer;
  if (BufferImpl?.from) {
    return BufferImpl.from(input, 'binary').toString('base64');
  }

  throw new Error('No base64 encoder available');
}

function safeAtob(input: string): string {
  const atobImpl = (globalThis as any).atob;
  if (typeof atobImpl === 'function') return atobImpl(input);

  const BufferImpl = (globalThis as any).Buffer;
  if (BufferImpl?.from) {
    return BufferImpl.from(input, 'base64').toString('binary');
  }

  throw new Error('No base64 decoder available');
}

export function encodeGenomeToUrlToken(cfg: unknown): string {
  const json = JSON.stringify(cfg);
  return safeBtoa(encodeURIComponent(json));
}

function getHashString(hash?: string): string {
  if (typeof hash === 'string') return hash;
  const w = (globalThis as any).window;
  if (w?.location && typeof w.location.hash === 'string') return w.location.hash;
  return '';
}

// `hash` is optional so callers can simply do `parseGenomeFromUrlHash()`.
// In the browser this defaults to `window.location.hash`.
export function parseGenomeFromUrlHash(hash?: string): any | null {
  const h = getHashString(hash);
  if (!h || !h.startsWith('#g=')) return null;
  const token = h.slice(3);

  try {
    const json = decodeURIComponent(safeAtob(token));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
