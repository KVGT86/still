import { mkdirSync, rmSync } from "node:fs";

export const STORAGE_RESERVE_BYTES = 2 * 1024 ** 3;

export function storageLow(available) {
  return available < STORAGE_RESERVE_BYTES;
}

export function clearRuntime(directory) {
  rmSync(directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 250,
  });
  mkdirSync(directory, { recursive: true });
}
