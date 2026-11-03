import { NifData } from "../types";

const cache = new Map<string, { data: NifData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export function getFromCache(nif: string): NifData | null {
  const cached = cache.get(nif);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    cache.delete(nif);
  }
  return null;
}

export function saveToCache(nif: string, data: NifData): void {
  cache.set(nif, { data, timestamp: Date.now() });
}
