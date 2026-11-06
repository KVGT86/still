import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearRuntime,
  storageLow,
  STORAGE_RESERVE_BYTES,
} from "../server/host-storage.mjs";

test("host preserves a 2 GiB reserve and recreates disposable Runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "still-runtime-"));
  const runtime = join(root, "Runtime");
  try {
    await writeFile(join(root, "keep"), "persistent");
    await mkdir(runtime);
    await writeFile(join(runtime, "temporary"), "temporary");
    clearRuntime(runtime);
    assert.deepEqual(await readdir(runtime), []);
    assert.equal(storageLow(STORAGE_RESERVE_BYTES - 1), true);
    assert.equal(storageLow(STORAGE_RESERVE_BYTES), false);
    assert.equal((await readdir(root)).includes("keep"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
