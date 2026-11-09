import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Windows host updater verifies release assets and rolls back an unhealthy app", async () => {
  const updater = await readFile("scripts/windows/update-host.ps1", "utf8");
  const setup = await readFile("scripts/windows/setup-host.ps1", "utf8");
  assert.match(updater, /digest -notmatch '\^sha256:/);
  assert.match(updater, /Move-Item \$previous \$app/);
  assert.match(updater, /health\.version -eq \$version/);
  assert.match(updater, /deploy-update\.ps1/);
  assert.match(setup, /New-TimeSpan -Hours 6/);
  assert.match(setup, /StillHostUpdate/);
});
