import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
export async function saveBackup(backup, directory, now = new Date()) {
  await mkdir(directory, { recursive: true });
  const filename = `still-${now.toISOString().slice(0, 10)}.sqlite`;
  const temporary = join(directory, filename + ".tmp");
  try {
    await backup(temporary);
    const snapshot = new DatabaseSync(temporary);
    try {
      snapshot.exec("PRAGMA journal_mode=DELETE;");
    } finally {
      snapshot.close();
    }
    await rename(temporary, join(directory, filename));
    const files = (await readdir(directory))
      .filter((name) => /^still-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
      .sort()
      .reverse();
    for (const name of files.slice(7)) await rm(join(directory, name));
  } finally {
    await rm(temporary, { force: true });
  }
}
