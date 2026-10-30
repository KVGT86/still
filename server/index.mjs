import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import express from "express";
import { createApp } from "./app.mjs";
import { saveBackup } from "./backups.mjs";
const database = process.env.DATABASE || "data/still.sqlite";
mkdirSync(dirname(resolve(database)), { recursive: true });
const { app, backup } = createApp({ database });
if (process.env.BACKUP_DIRECTORY) {
  let working = false;
  const run = async () => {
    if (working) return;
    working = true;
    try {
      await saveBackup(backup, process.env.BACKUP_DIRECTORY);
    } catch {
      console.error(
        "Still database backup failed; the live database is unchanged.",
      );
    } finally {
      working = false;
    }
  };
  setTimeout(run, 60000).unref();
  setInterval(run, 3600000).unref();
}
if (process.env.PACKAGE_DIRECTORY)
  app.use("/downloads", express.static(resolve(process.env.PACKAGE_DIRECTORY)));
app.use(express.static(resolve("dist")));
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 8787);
app.listen(port, host, () =>
  console.log(`Still profile service: http://${host}:${port}`),
);
