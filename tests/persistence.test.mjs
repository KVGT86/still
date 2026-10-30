import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.mjs";
import { saveBackup } from "../server/backups.mjs";
import { blankState } from "../shared/domain.mjs";
test("Saved titles and progress survive a service restart and restore from backup", async () => {
  const root = await mkdtemp(join(tmpdir(), "still-persistence-"));
  const database = join(root, "still.sqlite");
  let service = createApp({ database, verifyAccount: async () => "fixture" });
  let server = service.app.listen(0, "127.0.0.1");
  const request = async (path, body, token = "") => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { token } = await request("/session", { authKey: "fixture" });
    const state = blankState(),
      meta = { id: "fixture", name: "Saved film", type: "movie" };
    state.saved.fixture = { meta, updatedAt: Date.now() };
    state.progress.fixture = {
      meta,
      videoId: "fixture",
      position: 50,
      duration: 100,
      completed: false,
      hidden: false,
      updatedAt: Date.now(),
    };
    const profile = await request(
      "/profiles",
      { name: "Persistent", importState: state },
      token,
    );
    await saveBackup(
      service.backup,
      join(root, "backups"),
      new Date("2026-01-01"),
    );
    await new Promise((resolve) => server.close(resolve));
    service.close();
    service = createApp({ database, verifyAccount: async () => "fixture" });
    server = service.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const restored = await request(
      `/profiles/${profile.id}/state`,
      undefined,
      token,
    );
    assert.equal(restored.saved.fixture.meta.name, "Saved film");
    assert.equal(restored.progress.fixture.position, 50);
    const backup = new DatabaseSync(
      join(root, "backups/still-2026-01-01.sqlite"),
      { readOnly: true },
    );
    assert.equal(
      JSON.parse(backup.prepare("SELECT state FROM profiles").get().state).saved
        .fixture.meta.name,
      "Saved film",
    );
    backup.close();
    for (let day = 2; day <= 9; day++)
      await saveBackup(
        service.backup,
        join(root, "backups"),
        new Date(`2026-01-${String(day).padStart(2, "0")}`),
      );
    const { readdir } = await import("node:fs/promises");
    assert.equal((await readdir(join(root, "backups"))).length, 7);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
    await rm(root, { recursive: true, force: true });
  }
});
